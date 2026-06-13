/**
 * Handle Ticket Webhook Command Handler (AC#3 — FR44)
 *
 * Processes ticket status change webhook with:
 * 1. Idempotency check — duplicate webhooks return cached result
 * 2. Pattern-based cache invalidation (ticket cache)
 * 3. Session event recording via RecordSessionEventCommand
 * 4. Notification dispatch (Story 6.2 — replaces stub)
 *
 * Pattern: HandlePaymentWebhookHandler (idempotency + cache invalidation + notification).
 */

import { Inject, Logger } from '@nestjs/common';
import { ICommandHandler, CommandHandler, CommandBus } from '@nestjs/cqrs';
import { CACHE_SERVICE_TOKEN } from '@core/constants/tokens';
import type { ICacheService } from '@shared/caching/cache.interface';
import { IdempotencyService } from '@shared/cqrs/idempotency';
import { HandleTicketWebhookCommand, HandleTicketWebhookResult } from '../handle-ticket-webhook.command';
import { DispatchNotificationCommand } from '@modules/communication/application/commands/dispatch-notification.command';
import { RecordSessionEventCommand } from '@modules/session/application/commands/record-session-event.command';

@CommandHandler(HandleTicketWebhookCommand)
export class HandleTicketWebhookHandler implements ICommandHandler<HandleTicketWebhookCommand> {
  private readonly logger = new Logger(HandleTicketWebhookHandler.name);

  constructor(
    @Inject(CACHE_SERVICE_TOKEN)
    private readonly cacheService: ICacheService,
    private readonly idempotencyService: IdempotencyService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: HandleTicketWebhookCommand): Promise<HandleTicketWebhookResult> {
    const { payload } = command;
    const { ticketId, trackingId, customerId, oldStatus, newStatus } = payload;

    // Idempotency check — duplicate webhook?
    const existing = await this.idempotencyService.getExisting<HandleTicketWebhookResult>(ticketId);
    if (existing) {
      this.logger.log(`Duplicate webhook ignored: ${ticketId}`);
      return { processed: false, ticketId, status: 'duplicate' };
    }

    this.logger.log(
      `Ticket webhook: ${trackingId} ${oldStatus} → ${newStatus} (customer: ${customerId})`,
    );

    // AC#3: Pattern-based cache invalidation for ticket cache
    const pattern = 'cache:v2:port:ticket:*';
    const deletedCount = await this.cacheService.deleteByPattern(pattern);
    this.logger.log(`Invalidated ${deletedCount} ticket cache keys`);

    // AC#3: Record session event via RecordSessionEventCommand
    try {
      await this.commandBus.execute(
        new RecordSessionEventCommand({
          userId: customerId,
          eventType: 'ticket_status_changed',
          channel: 'web',
          content: { ticketId, trackingId, oldStatus, newStatus },
        }),
      );
    } catch (err) {
      this.logger.warn(`Session event recording failed: ${(err as Error).message}`);
    }

    // AC#6: Notification dispatch (Story 6.2 — replaces stub)
    try {
      await this.commandBus.execute(
        new DispatchNotificationCommand({
          customerId,
          type: 'ticket_status_changed',
          isCritical: false,
          ticketId,
          trackingId,
          oldStatus,
          newStatus,
        }),
      );
    } catch (err) {
      this.logger.warn(`Notification dispatch failed for ticket_status_changed: ${(err as Error).message}`);
    }

    // Store idempotency result
    const result: HandleTicketWebhookResult = {
      processed: true,
      ticketId,
      status: newStatus,
    };
    await this.idempotencyService.store(ticketId, result, 'HandleTicketWebhook');

    return result;
  }
}
