import { BaseDomainEvent, type IEventMetadata } from 'src/libs/core/domain';

export interface TicketClosedPayload {
  ticketId: string;
  conversationId: string | null;
  closedAt: Date;
  metadata?: IEventMetadata;
}

export class TicketClosedEvent extends BaseDomainEvent<TicketClosedPayload> {
  constructor(payload: TicketClosedPayload) {
    super(payload.ticketId, 'Ticket', 'TicketClosed', payload, payload.metadata);
  }
}
