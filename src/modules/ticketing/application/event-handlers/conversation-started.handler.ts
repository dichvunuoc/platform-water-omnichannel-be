/**
 * ConversationStarted → auto-create Ticket (Phase 2 link conversation→ticket).
 *
 * Event-driven (a): messaging phát ConversationStarted, ticketing subscribe.
 * KHÔNG import messaging — hoàn toàn decoupled qua IEventBus.
 * Khi conversation mới được ingest → tự động mở ticket P2 (default) liên kết.
 */
import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import type { IEventBus } from 'src/libs/core/infrastructure';
import { EVENT_BUS_TOKEN } from 'src/libs/core/constants';
import type { ITicketRepository } from '../../domain';
import { TICKET_REPOSITORY_TOKEN } from '../../constants';
import { Ticket, TicketPriority } from '../../domain';

@Injectable()
export class ConversationStartedTicketHandler implements OnModuleInit {
  private readonly logger = new Logger('ConversationStartedTicketHandler');

  constructor(
    @Inject(EVENT_BUS_TOKEN) private readonly eventBus: IEventBus,
    @Inject(TICKET_REPOSITORY_TOKEN) private readonly repo: ITicketRepository,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('ConversationStarted', async (event: any) => {
      await this.handleConversationStarted(event).catch((e) =>
        this.logger.error(`Auto-ticket failed: ${e.message}`),
      );
    });
  }

  private async handleConversationStarted(event: any): Promise<void> {
    const data = event.data ?? event;
    const conversationId = data.conversationId ?? data.aggregateId;
    const customerChannelId = data.customerChannelId ?? 'unknown';
    const channel = data.channel ?? 'APP';

    // Idempotent: skip nếu conversation đã có ticket
    const existing = await this.repo.findByConversationId(conversationId);
    if (existing) {
      this.logger.debug(`Ticket đã tồn tại cho conv=${conversationId}, skip`);
      return;
    }

    const id = `SC-${Date.now().toString(36).toUpperCase()}`;
    const priority = TicketPriority.create('P2');

    const ticket = Ticket.create(id, {
      conversationId,
      customerId: undefined,
      channel,
      title: `Hội thoại ${channel} — ${customerChannelId}`,
      description: '',
      priority,
    });

    await this.repo.save(ticket);
    this.logger.log(
      `Auto-ticket: ${id} → conv=${conversationId} (channel=${channel})`,
    );
  }
}
