/**
 * Zalo Webhook Controller
 *
 * Receives inbound Zalo OA webhook callbacks. Guarded by ZaloSignatureGuard
 * (HMAC SHA-256 over the RAW body — FR71).
 *
 * This controller is intentionally THIN and FAST (plan hardening #4):
 *   verify HMAC (guard) → idempotency check → enqueue raw payload to Outbox → 200 OK.
 * The actual processing (parse, resolve/link user, RecordSessionEvent, OA reply)
 * happens ASYNCHRONOUSLY in ZaloWebhookService via the Outbox → EventBus → subscriber.
 * This guarantees Zalo never times out (it requires <1–2s responses).
 */

import { Controller, Post, Req, Inject, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { ZaloSignatureGuard } from '@shared/security';
import { OUTBOX_REPOSITORY_TOKEN } from '@core';
import type { IOutboxRepository } from '@core/infrastructure';
import { InboundIdempotencyService } from '@shared/port/inbound-idempotency.service';
import { Public } from '@modules/auth/infrastructure/decorators/public.decorator';
import { ZaloInboundReceivedEvent } from '../../domain/events/zalo-inbound-received.event';
import { normaliseZaloInbound } from '../../application/dtos/zalo-webhook.dto';

@Public()
@ApiTags('Webhooks — Zalo')
@Controller('webhooks/zalo')
@UseGuards(ZaloSignatureGuard) // AC#1: HMAC SHA-256 verification (FR71), over rawBody
export class ZaloWebhookController {
  private readonly logger = new Logger(ZaloWebhookController.name);

  constructor(
    @Inject(OUTBOX_REPOSITORY_TOKEN) private readonly outbox: IOutboxRepository,
    private readonly idempotency: InboundIdempotencyService,
  ) {}

  /**
   * POST /webhooks/zalo/callback
   * HMAC is already verified by ZaloSignatureGuard over request.rawBody.
   */
  @Post('callback')
  @ApiOperation({ summary: 'Zalo OA webhook callback' })
  @ApiHeader({ name: 'X-ZECA-Signature', description: 'Zalo HMAC SHA-256 signature' })
  async handleZaloCallback(@Req() req: FastifyRequest): Promise<{ received: true }> {
    // rawBody is the exact bytes Zalo signed (retained by fastify-raw-body).
    const rawBody = (req as FastifyRequest & { rawBody?: string }).rawBody ?? '';

    // Extract the message id (idempotency key). If absent/unparseable we still
    // ack 200 (Zalo retries on non-2xx) but skip enqueuing — we cannot safely
    // deduplicate Zalo retries without a message id.
    let messageId = '';
    try {
      messageId = normaliseZaloInbound(JSON.parse(rawBody) as Record<string, unknown>).messageId;
    } catch (err) {
      this.logger.warn(
        `Zalo webhook: could not extract message id — dropping: ${(err as Error).message}`,
      );
      return { received: true };
    }

    // Idempotency: atomically CLAIM the message id (SETNX). The FIRST concurrent
    // caller wins and enqueues; Zalo retries / concurrent duplicates lose and are
    // dropped — no duplicate outbox rows (plan hardening #1).
    const won = await this.idempotency.claim(messageId);
    if (!won) {
      this.logger.debug(`Zalo webhook duplicate ${messageId} dropped at ingress`);
      return { received: true };
    }

    // Enqueue to the outbox; the subscriber processes it off the HTTP path.
    await this.outbox.add(
      new ZaloInboundReceivedEvent(messageId, { rawPayload: rawBody, messageId }),
    );

    return { received: true };
  }
}
