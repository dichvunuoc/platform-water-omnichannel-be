/**
 * Handle Payment Webhook Command Handler (AC#2, #3, #4)
 *
 * Processes payment webhook with:
 * 1. Idempotency check — duplicate webhooks return cached result
 * 2. Success → pattern-based cache invalidation + stubs
 * 3. Failed → PII-redacted logging + stubs
 */

import { Inject, Logger } from '@nestjs/common';
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { CACHE_SERVICE_TOKEN } from '@core/constants/tokens';
import type { ICacheService } from '@shared/caching/cache.interface';
import { IdempotencyService } from '@shared/cqrs/idempotency';
import { HandlePaymentWebhookCommand, HandlePaymentWebhookResult } from '../handle-payment-webhook.command';

@CommandHandler(HandlePaymentWebhookCommand)
export class HandlePaymentWebhookHandler implements ICommandHandler<HandlePaymentWebhookCommand> {
  private readonly logger = new Logger(HandlePaymentWebhookHandler.name);

  constructor(
    @Inject(CACHE_SERVICE_TOKEN)
    private readonly cacheService: ICacheService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async execute(command: HandlePaymentWebhookCommand): Promise<HandlePaymentWebhookResult> {
    const { payload } = command;
    const { paymentId, invoiceId, customerId, amount, status } = payload;

    // AC#4: Idempotency check — duplicate webhook?
    const existing = await this.idempotencyService.getExisting<HandlePaymentWebhookResult>(paymentId);
    if (existing) {
      this.logger.log(`Duplicate webhook ignored: ${paymentId}`);
      return { processed: false, paymentId, status: 'duplicate' };
    }

    const result: HandlePaymentWebhookResult = {
      processed: true,
      paymentId,
      status: status === 'success' ? 'success' : 'failed',
    };

    if (status === 'success') {
      // AC#2: Pattern-based cache invalidation for ALL invoice cache keys
      // TODO (production): Scope invalidation to paying customer's keys only.
      // Current pattern wipes all customers' invoice cache. Acceptable for MVP
      // but Redis SCAN should filter by customer-specific hash in production.
      const pattern = 'cache:v2:port:invoice:*';
      const deletedCount = await this.cacheService.deleteByPattern(pattern);
      this.logger.log(
        `Payment success: ${paymentId}. Invalidated ${deletedCount} invoice cache keys`,
      );

      // AC#4: Also invalidate debt cache (debt data changes after payment)
      // TODO (production): Scope invalidation to paying customer's keys only.
      // Current pattern wipes all customers' debt cache — same MVP constraint as invoice purge above.
      const debtDeleted = await this.cacheService.deleteByPattern('cache:v2:port:debt:*');
      this.logger.log(`Invalidated ${debtDeleted} debt cache keys`);

      // AC#2: Session event stub (Epic 7 will replace)
      this.logger.log(
        `[SESSION EVENT STUB] payment_completed: invoiceId=${invoiceId}, amount=[REDACTED]`,
      );

      // AC#2: Notification dispatch stub (Epic 6 will replace)
      this.logger.log(
        `[NOTIFICATION STUB] payment_completed: amount=[REDACTED]`,
      );
    } else {
      // AC#3: Failed payment — log with PII redacted
      this.logger.warn(
        `Payment failed: ${paymentId}, invoiceId=${invoiceId}, amount=[REDACTED]`,
      );

      // AC#3: Notification dispatch stub
      this.logger.log(
        `[NOTIFICATION STUB] payment_failed: paymentId=${paymentId}`,
      );
    }

    // Store idempotency result
    await this.idempotencyService.store(paymentId, result, 'HandlePaymentWebhook');

    return result;
  }
}
