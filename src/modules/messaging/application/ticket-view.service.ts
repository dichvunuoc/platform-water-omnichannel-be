import { Injectable, Inject } from '@nestjs/common';
import type { ITicketRepository, Ticket } from '../../ticketing/domain';
import { TICKET_REPOSITORY_TOKEN } from '../../ticketing/constants';

/** SLA color computed from remaining time (matches FE UI). */
export type SlaColor = 'green' | 'yellow' | 'red' | 'gray';

/** Ticket view enriched with SLA countdown for BFF display. */
export interface TicketView {
  id: string;
  conversationId: string | null;
  customerId: string | null;
  channel: string;
  title: string;
  stage: string;
  priority: string;
  assignee: string | null;
  createdAt: number;
  slaDeadline: number;
  slaRemainingMs: number;
  slaColor: SlaColor;
  slaWarning: boolean;
  slaBreached: boolean;
  customerName?: string;
}

/** Kanban view = grouped tickets with SLA enrichment. */
export interface KanbanView {
  RECEIVED: TicketView[];
  IN_PROGRESS: TicketView[];
  WAITING: TicketView[];
  RESOLVED: TicketView[];
  CLOSED: TicketView[];
  total: number;
  slaBreachedCount: number;
  slaWarningCount: number;
}

/**
 * Ticket View Service (FR20/FR60 — BFF read side).
 * Reads từ real TicketRepository (Phase 2 — stub removed).
 */
@Injectable()
export class TicketViewService {
  constructor(
    @Inject(TICKET_REPOSITORY_TOKEN)
    private readonly repo: ITicketRepository,
  ) {}

  async getKanbanView(): Promise<KanbanView> {
    const tickets = await this.repo.findAll();
    const views = tickets.map((t) => this.enrichTicket(t));
    const group = (stage: string) => views.filter((v) => v.stage === stage);
    return {
      RECEIVED: group('RECEIVED'),
      IN_PROGRESS: group('IN_PROGRESS'),
      WAITING: group('WAITING'),
      RESOLVED: group('RESOLVED'),
      CLOSED: group('CLOSED'),
      total: views.length,
      slaBreachedCount: views.filter((v) => v.slaBreached).length,
      slaWarningCount: views.filter((v) => v.slaWarning).length,
    };
  }

  async getTicketView(ticketId: string): Promise<TicketView | null> {
    const ticket = await this.repo.getById(ticketId);
    return ticket ? this.enrichTicket(ticket) : null;
  }

  async getConversationTicketView(conversationId: string): Promise<TicketView | null> {
    const ticket = await this.repo.findByConversationId(conversationId);
    return ticket ? this.enrichTicket(ticket) : null;
  }

  private enrichTicket(ticket: Ticket): TicketView {
    const now = Date.now();
    const rd = ticket.resolveDeadline;
    const resolveMs = rd instanceof Date ? rd.getTime() : new Date(rd).getTime();
    const remainingMs = resolveMs - now;
    const isResolved = ticket.stage.value === 'RESOLVED' || ticket.stage.value === 'CLOSED';
    return {
      id: ticket.id,
      conversationId: ticket.conversationId,
      customerId: ticket.customerId,
      channel: ticket.channel,
      title: ticket.title,
      stage: ticket.stage.value,
      priority: ticket.priority.value,
      assignee: ticket.assignee,
      createdAt: ticket.createdAt instanceof Date ? ticket.createdAt.getTime() : new Date(ticket.createdAt).getTime(),
      slaDeadline: resolveMs,
      slaRemainingMs: isResolved ? 0 : remainingMs,
      slaColor: isResolved ? 'gray' : remainingMs <= 0 ? 'red' : remainingMs < 30 * 60 * 1000 ? 'yellow' : 'green',
      slaWarning: !isResolved && remainingMs < 30 * 60 * 1000 && remainingMs > 0,
      slaBreached: !isResolved && remainingMs <= 0,
      customerName: `Customer ${ticket.customerId ?? 'unknown'}`,
    };
  }
}
