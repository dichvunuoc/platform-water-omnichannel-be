import type { IAggregateRepository } from 'src/libs/core/domain';
import type { Ticket } from '../entities/ticket.entity';
import type { TicketStageEnum } from '../value-objects/ticket-stage.value-object';
import type { TicketPriorityEnum } from '../value-objects/ticket-priority.value-object';

export interface ITicketRepository extends IAggregateRepository<Ticket> {
  findByConversationId(conversationId: string): Promise<Ticket | null>;
  findOpenTickets(): Promise<Ticket[]>;
  findByParentId(parentId: string): Promise<Ticket[]>;
}
