import { Injectable, Logger } from '@nestjs/common';
import { Inject, Optional } from '@nestjs/common';
import type { IEventBus } from 'src/libs/core/infrastructure';
import { EVENT_BUS_TOKEN } from 'src/libs/core/constants';
import {
  StubTicket,
  TicketStage,
  TicketPriority,
  KanbanResponse,
  CreateTicketRequest,
  SLA_POLICIES,
  SlaWarningPayload,
  TicketStateChangedPayload,
  TicketClosedPayload,
  TicketCreateRequestedPayload,
} from './ticketing-stub.types';

/**
 * Ticketing Stub Service
 *
 * In-memory ticket store that simulates the real Ticketing & SLA service.
 * Wave-1 only — replaced by a real NestJS microservice in wave-2.
 *
 * Capabilities:
 *   - Create tickets (assign ID, classify, apply SLA policy)
 *   - Advance stage / reassign
 *   - SLA simulation (deadline + warning/breach detection)
 *   - Emit events to IEventBus (SlaWarning, TicketStateChanged, TicketClosed)
 *   - Seed mock data matching the delivered FE Kanban mockup
 */
@Injectable()
export class TicketingStubService {
  private readonly logger = new Logger(TicketingStubService.name);
  private readonly tickets = new Map<string, StubTicket>();
  private readonly idCounter = { current: 2041 };
  private slaCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Optional()
    @Inject(EVENT_BUS_TOKEN)
    private readonly eventBus?: IEventBus,
  ) {
    this.seedMockData();
    this.startSlaChecker();
  }

  // ─── CRUD ───

  createTicket(req: CreateTicketRequest): StubTicket {
    const id = `SC-${++this.idCounter.current}`;
    const now = Date.now();
    const priority = req.priority ?? 'P2';
    const slaOffset = req.fastForwardSla
      ? 5 * 60 * 1000  // 5 min for demo
      : SLA_POLICIES[priority];

    const ticket: StubTicket = {
      id,
      conversationId: req.conversationId ?? null,
      customerId: req.customerId ?? null,
      channel: req.channel ?? 'ZALO',
      title: req.title ?? `Ticket ${id}`,
      description: req.description ?? '',
      stage: 'RECEIVED',
      priority,
      assignee: null,
      createdAt: now,
      updatedAt: now,
      slaDeadline: now + slaOffset,
      closedAt: null,
    };

    this.tickets.set(id, ticket);
    this.logger.log(`Ticket created: ${id} (priority=${priority}, SLA=${slaOffset / 60000}min)`);

    // Emit TicketStateChanged (creation = first state)
    this.emitEvent('TicketStateChanged', {
      ticketId: id,
      newStage: 'RECEIVED',
    } as TicketStateChangedPayload);

    return ticket;
  }

  getTicket(id: string): StubTicket | null {
    return this.tickets.get(id) ?? null;
  }

  advanceStage(ticketId: string, newStage: TicketStage): StubTicket {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    const previousStage = ticket.stage;
    ticket.stage = newStage;
    ticket.updatedAt = Date.now();

    if (newStage === 'CLOSED' || newStage === 'RESOLVED') {
      ticket.closedAt = Date.now();
      this.emitEvent('TicketClosed', {
        ticketId,
        conversationId: ticket.conversationId,
        closedAt: ticket.closedAt,
      } as TicketClosedPayload);
    }

    this.emitEvent('TicketStateChanged', {
      ticketId,
      newStage,
      previousStage,
    } as TicketStateChangedPayload);

    this.logger.log(`Ticket ${ticketId}: ${previousStage} → ${newStage}`);
    return ticket;
  }

  reassign(ticketId: string, assignee: string): StubTicket {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }
    ticket.assignee = assignee;
    ticket.updatedAt = Date.now();
    this.logger.log(`Ticket ${ticketId} reassigned to ${assignee}`);
    return ticket;
  }

  getKanban(): KanbanResponse {
    const stages: TicketStage[] = ['RECEIVED', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'];
    const result: any = { total: 0, slaBreachedCount: 0, slaWarningCount: 0 };

    for (const stage of stages) {
      result[stage] = [];
    }

    const now = Date.now();
    for (const ticket of this.tickets.values()) {
      const list = result[ticket.stage] ?? [];
      list.push(ticket);
      result[ticket.stage] = list;
      result.total++;

      const remaining = ticket.slaDeadline - now;
      if (ticket.stage !== 'CLOSED' && ticket.stage !== 'RESOLVED') {
        if (remaining < 0) result.slaBreachedCount++;
        else if (remaining < 30 * 60 * 1000) result.slaWarningCount++;
      }
    }

    return result as KanbanResponse;
  }

  /** Get tickets for a specific conversation (for SLA chip on inbox). */
  getByConversation(conversationId: string): StubTicket | null {
    for (const ticket of this.tickets.values()) {
      if (ticket.conversationId === conversationId) return ticket;
    }
    return null;
  }

  // ─── SLA Simulation ───

  /**
   * Fast-forward a ticket's SLA deadline for demo purposes (J3).
   * Sets deadline to `now + minutes` so SlaWarning fires quickly.
   */
  fastForwardSla(ticketId: string, minutesToDeadline = 3): StubTicket {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }
    ticket.slaDeadline = Date.now() + minutesToDeadline * 60 * 1000;
    this.logger.warn(`Ticket ${ticketId} SLA fast-forwarded: ${minutesToDeadline}min to deadline`);
    return ticket;
  }

  /**
   * Manually trigger an SlaWarning event for a ticket (J3 demo).
   */
  triggerSlaWarning(ticketId: string, severity: 'WARNING' | 'BREACHED' = 'WARNING'): void {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    const now = Date.now();
    const remainingMs = ticket.slaDeadline - now;

    this.emitSlaWarning(ticket, severity);
    this.logger.warn(`Manual SLA ${severity} triggered for ticket ${ticketId}`);
  }

  /**
   * Background SLA checker — runs every 60s, emits SlaWarning for tickets
   * approaching breach (<30 min) and SlaBreached for past-deadline tickets.
   */
  private startSlaChecker(): void {
    this.slaCheckInterval = setInterval(() => {
      const now = Date.now();
      for (const ticket of this.tickets.values()) {
        if (ticket.stage === 'CLOSED' || ticket.stage === 'RESOLVED') continue;

        const remainingMs = ticket.slaDeadline - now;
        if (remainingMs < 0) {
          this.emitSlaWarning(ticket, 'BREACHED');
        } else if (remainingMs < 30 * 60 * 1000 && remainingMs > 29 * 60 * 1000) {
          // Only emit warning when crossing the 30-min threshold (not every tick)
          this.emitSlaWarning(ticket, 'WARNING');
        }
      }
    }, 60_000); // check every 60s
  }

  private emitSlaWarning(ticket: StubTicket, severity: 'WARNING' | 'BREACHED'): void {
    const now = Date.now();
    const payload: SlaWarningPayload = {
      ticketId: ticket.id,
      conversationId: ticket.conversationId,
      slaDeadline: ticket.slaDeadline,
      remainingMs: ticket.slaDeadline - now,
      severity,
      stage: ticket.stage,
      assignee: ticket.assignee,
    };
    this.emitEvent('SlaWarning', payload);
  }

  // ─── Event Bus ───

  private emitEvent(eventType: string, payload: any): void {
    if (!this.eventBus) {
      this.logger.debug(`EventBus not available — event '${eventType}' logged only`);
      return;
    }
    // IEventBus.publish takes a single IDomainEvent object
    const event = {
      eventType,
      aggregateType: 'Ticket',
      aggregateId: payload.ticketId ?? payload.conversationId ?? 'unknown',
      occurredAt: Date.now(),
      data: payload,
    };
    this.eventBus.publish(event as any);
  }

  // ─── Mock Seed Data ───

  /**
   * Pre-seeds tickets matching the delivered FE Kanban mockup:
   * RECEIVED: 6, IN_PROGRESS: 11, WAITING: 2, RESOLVED: 7
   */
  private seedMockData(): void {
    const now = Date.now();
    const channels = ['ZALO', 'APP', 'TOTAL_1900', 'EMAIL'];
    const priorities: TicketPriority[] = ['P0', 'P1', 'P2', 'P3'];
    const stages: TicketStage[] = ['RECEIVED', 'IN_PROGRESS', 'WAITING', 'RESOLVED'];
    const counts = [6, 11, 2, 7]; // matches UI mockup

    let id = 2035;
    for (let s = 0; s < stages.length; s++) {
      for (let i = 0; i < counts[s]; i++) {
        const priority = priorities[Math.floor(Math.random() * priorities.length)];
        const channel = channels[Math.floor(Math.random() * channels.length)];
        const createdOffset = Math.floor(Math.random() * 3 * 3600 * 1000); // up to 3h ago
        const slaOffset = SLA_POLICIES[priority];
        const ticket: StubTicket = {
          id: `SC-${id++}`,
          conversationId: null,
          customerId: `cust-${100 + Math.floor(Math.random() * 50)}`,
          channel,
          title: `Báo sự cố ${channel === 'TOTAL_1900' ? 'tổng đài' : channel}`,
          description: 'Khách hàng phản ánh sự cố cấp nước',
          stage: stages[s],
          priority,
          assignee: i % 3 === 0 ? `agent-${100 + (i % 5)}` : null,
          createdAt: now - createdOffset,
          updatedAt: now - createdOffset + Math.floor(Math.random() * 3600 * 1000),
          slaDeadline: now - createdOffset + slaOffset,
          closedAt: stages[s] === 'RESOLVED' ? now - Math.floor(Math.random() * 3600 * 1000) : null,
        };
        this.tickets.set(ticket.id, ticket);
      }
    }

    this.idCounter.current = id;
    this.logger.log(`Seeded ${this.tickets.size} mock tickets (RECEIVED=6, IN_PROGRESS=11, WAITING=2, RESOLVED=7)`);
  }

  /** Cleanup interval on module destroy */
  onModuleDestroy(): void {
    if (this.slaCheckInterval) {
      clearInterval(this.slaCheckInterval);
    }
  }
}
