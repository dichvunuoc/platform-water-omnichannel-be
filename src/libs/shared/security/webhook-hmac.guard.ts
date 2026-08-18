/**
 * Webhook HMAC Guard (v1 scheme) — authenticates internal callers of /webhooks/*.
 *
 * Trước guard này, TOÀN BỘ /webhooks/* (app/zalo/facebook/email/inbound) không auth
 * và reachable từ internet qua ingress — `userId`/`customerChannelId` trong payload
 * là identity duy nhất → impersonation + thread disclosure (IDOR). Giờ mọi route
 * webhook yêu cầu chữ ký HMAC của một internal caller đã share secret (hiện tại:
 * app-tu-phuc-vu BFF, secret CSKH_WEBHOOK_HMAC_SECRET bên gọi — cùng giá trị với
 * WEBHOOK_HMAC_SECRET bên này).
 *
 * Scheme (byte-identical với signer app-tu-phuc-vu
 * src/libs/shared/security/hmac-sign.util.ts — KHÔNG shared lib giữa 2 repo, đổi
 * canonical thì đổi CẢ HAI):
 *
 *   canonical = v1:{x-timestamp}:{METHOD}:{request-target}:{sha256Hex(rawBody | "")}
 *   x-signature = "v1=" + HMAC-SHA256(WEBHOOK_HMAC_SECRET, canonical) (hex)
 *
 * - request-target = request.raw.url — Fastify giữ nguyên bytes gốc (kể cả query
 *   encoding) → KHÔNG BAO GIỜ re-encode; query nằm trong canonical nên identity
 *   param (?userId=) của GET tamper-proof.
 * - rawBody (buffer, bật bằng rawBody:true ở main.ts) — sha256 theo bytes; GET
 *   hoặc request thiếu rawBody → hash chuỗi rỗng (fail-closed: POST có body mà
 *   thiếu rawBody sẽ mismatch chữ ký → 401).
 *
 * Verify order (fail-closed):
 *   1. WEBHOOK_HMAC_SECRET unset → 403 "Service configuration error" (config
 *      alarm — mirror InterServiceApiKeyGuard của app BFF; deploy thiếu secret =
 *      mọi webhook reject ồ ạt, phát hiện ngay chứ không phải lỗ hổng thầm lặng).
 *   2. Thiếu/malformed x-timestamp / x-signature → 401.
 *   3. |now − ts| > 300s → 401 (replay window ±5 phút; log delta để phát hiện
 *      clock skew giữa node. POST replay trong window bị idempotency key
 *      ${channel}:${externalMessageId} trung hòa).
 *   4. Recompute MAC → crypto.timingSafeEqual → mismatch 401.
 *
 * 403 = receiver config problem (alarm) ≠ 401 = auth failure — caller (BFF)
 * phân biệt được để log/log-monitor đúng loại lỗi.
 *
 * @SkipWebhookHmac() — escape hatch cho provider webhook riêng (Zalo OA MAC,
 * Facebook X-Hub-Signature…) khi build kênh đó: verification của provider thay
 * HMAC nội bộ. KHÔNG dùng cho /webhooks/app.
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { SKIP_WEBHOOK_HMAC_KEY, SkipWebhookHmac } from './skip-webhook-hmac.decorator';

/** Replay window (giây) — signature hợp lệ trong ±5 phút. */
export const WEBHOOK_HMAC_MAX_AGE_SECONDS = 300;

/** Header Fastify value có thể là string[] — normalize về string đầu tiên. */
function headerAsString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

@Injectable()
export class WebhookHmacGuard implements CanActivate {
  private readonly logger = new Logger('WebhookHmacGuard');

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_WEBHOOK_HMAC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req = context.switchToHttp().getRequest();

    const secret = process.env.WEBHOOK_HMAC_SECRET;
    if (!secret) {
      this.logger.error(
        'WEBHOOK_HMAC_SECRET env var not configured — rejecting all webhook requests (fail-closed)',
      );
      throw new ForbiddenException('Service configuration error');
    }

    const timestamp = headerAsString(req.headers?.['x-timestamp']);
    const signature = headerAsString(req.headers?.['x-signature']);
    const target = req.raw?.url as string | undefined;

    if (!timestamp || !signature || !/^\d+$/.test(timestamp) || !target) {
      this.logger.warn(
        `Missing/malformed signature headers. Path: ${target ?? '(?)'}`,
      );
      throw new UnauthorizedException('Missing or malformed signature headers');
    }

    const now = Math.floor(Date.now() / 1000);
    const delta = Math.abs(now - Number(timestamp));
    if (delta > WEBHOOK_HMAC_MAX_AGE_SECONDS) {
      this.logger.warn(
        `Webhook timestamp outside ±${WEBHOOK_HMAC_MAX_AGE_SECONDS}s window (delta=${delta}s — replay hoặc clock skew). Path: ${target}`,
      );
      throw new UnauthorizedException('Signature timestamp outside allowed window');
    }

    // Canonical v1 — method + exact request-target + sha256(rawBody|'')
    const bodyHash = createHash('sha256')
      .update((req.rawBody as Buffer | undefined) ?? '')
      .digest('hex');
    const canonical = `v1:${timestamp}:${req.method}:${target}:${bodyHash}`;
    const expected =
      'v1=' + createHmac('sha256', secret).update(canonical).digest('hex');

    // Timing-safe so sánh 2 hex digest (64 chars, bằng length theo cấu trúc —
    // check length trước để timingSafeEqual không throw trên length lệch).
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      this.logger.warn(`Invalid webhook signature. Path: ${target}`);
      throw new UnauthorizedException('Invalid signature');
    }

    return true;
  }
}

// re-export cho tiện import một chỗ (giống Public của jwt-auth.guard)
export { SkipWebhookHmac };
