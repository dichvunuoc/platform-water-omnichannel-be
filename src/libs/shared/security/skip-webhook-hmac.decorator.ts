/**
 * @SkipWebhookHmac() — route-level opt-out of WebhookHmacGuard.
 *
 * Escape hatch cho webhooks có verification riêng của provider (Zalo OA MAC,
 * Facebook X-Hub-Signature, email inbound SPF/DKIM gateways…): khi build kênh
 * đó, đánh dấu route này rồi verify theo cơ chế của provider trong handler/guard
 * riêng. KHÔNG dùng cho /webhooks/app — wire nội bộ luôn HMAC.
 */
import { SetMetadata } from '@nestjs/common';

export const SKIP_WEBHOOK_HMAC_KEY = 'skipWebhookHmac';
export const SkipWebhookHmac = () => SetMetadata(SKIP_WEBHOOK_HMAC_KEY, true);
