/**
 * Handle Payment Webhook Command Handler (AC#2, #3, #4)
 *
 * Processes payment webhook with:
 * 1. Idempotency check — duplicate webhooks return cached result
 * 2. Success → pattern-based cache invalidation + notification dispatch
 * 3. Failed → PII-redacted logging + notification dispatch
 */

import { Inject, Logger } from '@nestjs/common';
import { ICommandHandler, CommandHandler, CommandBus } from '@nestjs/cqrs';
import { CACHE_SERVICE_TOKEN } from '@core/constants/tokens';
import type { ICacheService } from '@shared/caching/cache.interface';
import { IdempotencyService } from '@shared/cqrs/idempotency';
import { HandlePaymentWebhookCommand, HandlePaymentWebhookResult } from '../handle-payment-webhook.command';
import { DispatchNotificationCommand } from '@modules/communication/application/commands/dispatch-notification.command';
import { RecordSessionEventCommand } from '@modules/session/application/commands/record-session-event.command';

@CommandHandler(HandlePaymentWebhookCommand)
export class HandlePaymentWebhookHandler implements ICommandHandler<HandlePaymentWebhookCommand> {
  private readonly logger = new Logger(HandlePaymentWebhookHandler.name);

  constructor(
    @Inject(CACHE_SERVICE_TOKEN)
    private readonly cacheService: ICacheService,
    private readonly idempotencyService: IdempotencyService,
    private readonly commandBus: CommandBus,
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
      const pattern = 'cache:v2:port:invoice:*';
      const deletedCount = await this.cacheService.deleteByPattern(pattern);
      this.logger.log(
        `Payment success: ${paymentId}. Invalidated ${deletedCount} invoice cache keys`,
      );

      // AC#4: Also invalidate debt cache (debt data changes after payment)
      const debtDeleted = await this.cacheService.deleteByPattern('cache:v2:port:debt:*');
      this.logger.log(`Invalidated ${debtDeleted} debt cache keys`);

      // AC#2: Record session event via RecordSessionEventCommand
      try {
        await this.commandBus.execute(
          new RecordSessionEventCommand({
            userId: customerId,
            eventType: 'payment_completed',
            channel: 'web',
            content: { invoiceId },
          }),
        );
      } catch (err) {
        this.logger.warn(`Session event recording failed: ${(err as Error).message}`);
      }

      // AC#5: Notification dispatch (Story 6.2 — replaces stub)
      try {
        await this.commandBus.execute(
          new DispatchNotificationCommand({
            customerId,
            type: 'payment_completed',
            isCritical: true,
            invoiceId,
            amount,
            metadata: { paymentId },
          }),
        );
      } catch (err) {
        this.logger.warn(`Notification dispatch failed for payment_completed: ${(err as Error).message}`);
      }
    } else {
      // AC#3: Failed payment — log with PII redacted
      this.logger.warn(
        `Payment failed: ${paymentId}, invoiceId=${invoiceId}, amount=[REDACTED]`,
      );

      // AC#5: Notification dispatch (Story 6.2 — replaces stub)
      try {
        await this.commandBus.execute(
          new DispatchNotificationCommand({
            customerId,
            type: 'payment_failed',
            isCritical: true,
            invoiceId,
            metadata: { paymentId, status },
          }),
        );
      } catch (err) {
        this.logger.warn(`Notification dispatch failed for payment_failed: ${(err as Error).message}`);
      }
    }

    // Store idempotency result
    await this.idempotencyService.store(paymentId, result, 'HandlePaymentWebhook');

    return result;
  }
}
