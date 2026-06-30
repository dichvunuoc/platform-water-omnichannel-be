import { BaseDomainEvent, type IEventMetadata } from 'src/libs/core/domain';

export interface TicketStageChangedPayload {
  ticketId: string;
  newStage: string;
  previousStage?: string;
  reason?: string;
  metadata?: IEventMetadata;
}

export class TicketStageChangedEvent extends BaseDomainEvent<TicketStageChangedPayload> {
  constructor(payload: TicketStageChangedPayload) {
    super(
      payload.ticketId,
      'Ticket',
      'TicketStateChanged',
      payload,
      payload.metadata,
    );
  }
}
