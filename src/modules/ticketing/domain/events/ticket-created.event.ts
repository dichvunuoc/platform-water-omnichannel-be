import { BaseDomainEvent, type IEventMetadata } from 'src/libs/core/domain';

export interface TicketCreatedPayload {
  ticketId: string;
  conversationId: string | null;
  customerId: string | null;
  channel: string;
  priority: string;
  title: string;
  ackDeadline: Date;
  resolveDeadline: Date;
  schedule: string;
  metadata?: IEventMetadata;
}

export class TicketCreatedEvent extends BaseDomainEvent<TicketCreatedPayload> {
  constructor(payload: TicketCreatedPayload) {
    super(payload.ticketId, 'Ticket', 'TicketCreated', payload, payload.metadata);
  }
}
