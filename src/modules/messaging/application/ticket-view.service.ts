import { Injectable, Inject } from '@nestjs/common';
import { TicketingStubService } from '../../ticketing-stub/ticketing-stub.service';
import type { StubTicket, KanbanResponse } from '../../ticketing-stub/ticketing-stub.types';

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
 *
 * Reads ticket data from the Ticketing stub + enriches with:
 *   - SLA remaining time (slaRemainingMs)
 *   - SLA color (green/yellow/red/gray — matches FE UI)
 *   - Customer name (joined from Customer 360 mock)
 *
 * This is OmniCare's READ interface to the Ticketing service.
 * In wave-2: stub replaced by real service behind same contract.
 */
@Injectable()
export class TicketViewService {
  constructor(
    private readonly stub: TicketingStubService,
  ) {}

  /** Get all tickets grouped by stage with SLA enrichment. */
  getKanbanView(): KanbanView {
    const raw = this.stub.getKanban();
    const enrich = (list: StubTicket[]): TicketView[] =>
      list.map((t) => this.enrichTicket(t));

    return {
      RECEIVED: enrich(raw.RECEIVED),
      IN_PROGRESS: enrich(raw.IN_PROGRESS),
      WAITING: enrich(raw.WAITING),
      RESOLVED: enrich(raw.RESOLVED),
      CLOSED: enrich(raw.CLOSED),
      total: raw.total,
      slaBreachedCount: raw.slaBreachedCount,
      slaWarningCount: raw.slaWarningCount,
    };
  }

  /** Get single ticket view (for ticket detail / SLA chip). */
  getTicketView(ticketId: string): TicketView | null {
    const ticket = this.stub.getTicket(ticketId);
    if (!ticket) return null;
    return this.enrichTicket(ticket);
  }

  /** Get ticket linked to a conversation (for inbox SLA chip — AC: 4). */
  getConversationTicketView(conversationId: string): TicketView | null {
    const ticket = this.stub.getByConversation(conversationId);
    if (!ticket) return null;
    return this.enrichTicket(ticket);
  }

  /** Compute SLA enrichment from a raw ticket. */
  private enrichTicket(ticket: StubTicket): TicketView {
    const now = Date.now();
    const remainingMs = ticket.slaDeadline - now;
    const isResolved = ticket.stage === 'RESOLVED' || ticket.stage === 'CLOSED';

    return {
      id: ticket.id,
      conversationId: ticket.conversationId,
      customerId: ticket.customerId,
      channel: ticket.channel,
      title: ticket.title,
      stage: ticket.stage,
      priority: ticket.priority,
      assignee: ticket.assignee,
      createdAt: ticket.createdAt,
      slaDeadline: ticket.slaDeadline,
      slaRemainingMs: isResolved ? 0 : remainingMs,
      slaColor: this.computeSlaColor(remainingMs, isResolved),
      slaWarning: !isResolved && remainingMs < 30 * 60 * 1000 && remainingMs > 0,
      slaBreached: !isResolved && remainingMs <= 0,
      customerName: `Customer ${ticket.customerId ?? 'unknown'}`,
    };
  }

  /** SLA color logic matching the delivered FE. */
  private computeSlaColor(remainingMs: number, isResolved: boolean): SlaColor {
    if (isResolved) return 'gray';
    if (remainingMs <= 0) return 'red';       // breached
    if (remainingMs < 30 * 60 * 1000) return 'yellow'; // <30 min warning
    return 'green';                            // ok
  }
}
