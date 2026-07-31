/**
 * TicketClosedCsatHandler (Phase 3 Step 2 — CSAT Close-loop).
 *
 * Event-driven: subscribe TicketClosed → trigger CSAT survey via notification gRPC.
 * Hoàn toàn decoupled (giống ConversationStartedTicketHandler + IdentityResolutionHandler).
 *
 * Flow:
 *   Ticket.advanceStage(CLOSED) → TicketClosed event (via outbox)
 *   → TicketClosedCsatHandler subscribe
 *   → INotificationPort.send(cskh.csat_request) → SMS/Zalo cho KH
 *
 * FR27: KH rate < 3★ → reopen ticket (chưa wire ở handler này — cần CSAT submit endpoint).
 */
import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import type { IEventBus } from 'src/libs/core/infrastructure';
import { EVENT_BUS_TOKEN } from 'src/libs/core/constants';
import type { INotificationPort, NotificationSendRequest } from '../../../notification/notification.port';
import { NOTIFICATION_PORT_TOKEN } from '../../../notification/notification.tokens';
import type { ITicketRepository } from '../../domain';
import { TICKET_REPOSITORY_TOKEN } from '../../constants';

@Injectable()
export class TicketClosedCsatHandler implements OnModuleInit {
  private readonly logger = new Logger('TicketClosedCsatHandler');

  constructor(
    @Inject(EVENT_BUS_TOKEN) private readonly eventBus: IEventBus,
    @Inject(NOTIFICATION_PORT_TOKEN) private readonly notifications: INotificationPort,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(
      'TicketClosed',
      async (event: any) => {
        await this.handleCsat(event).catch((e) =>
          this.logger.error(`CSAT trigger failed: ${e.message}`),
        );
      },
      { queueName: 'TicketClosed.csat', durable: true },
    );
  }

  private async handleCsat(event: any): Promise<void> {
    const data = event.data ?? event;
    const ticketId = data.ticketId ?? event.aggregateId;
    const conversationId = data.conversationId;

    this.logger.log(`Ticket closed: ${ticketId} (conv=${conversationId}) → triggering CSAT survey`);

    // FR42: Gửi CSAT survey qua notification-be-rs (template cskh.csat_request)
    // Phone: tạm dùng placeholder '0900000000' (real: resolve từ conversation.customerId → Customer360)
    const req: NotificationSendRequest = {
      templateKey: 'cskh.csat_request',
      recipients: [{ phone: '0900000000' }],
      data: {
        ticketId,
        conversationId,
        csatLink: `https://cskh.dichvunuoc.vn/csat/${ticketId}`,
      },
      idempotencyKey: `cskh.csat:${ticketId}`,
    };

    const result = await this.notifications.send(req);
    if (result.sent) {
      this.logger.log(`CSAT survey sent: ticket=${ticketId} (${result.status ?? 'sent'})`);
    } else {
      this.logger.warn(`CSAT survey failed: ticket=${ticketId} (${result.error ?? 'unknown'})`);
    }
  }
}
