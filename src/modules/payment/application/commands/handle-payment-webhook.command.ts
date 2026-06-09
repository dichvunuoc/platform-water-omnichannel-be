/**
 * Handle Payment Webhook Command (AC#1-4)
 *
 * Processes inbound webhook from Payment Service:
 * - Idempotency check (AC#4)
 * - Cache invalidation on success (AC#2)
 * - Failure logging on failed (AC#3)
 * - Stub: session event + notification (Epic 6 & 7)
 */

import { ICommand } from '@core/application';
import type { PaymentWebhookPayload } from '../dtos/payment.dto';

export class HandlePaymentWebhookCommand implements ICommand {
  constructor(public readonly payload: PaymentWebhookPayload) {}
}

export type HandlePaymentWebhookResult = {
  processed: boolean;
  paymentId: string;
  status: 'success' | 'failed' | 'duplicate';
};
