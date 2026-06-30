import { AggregateRoot, DomainException, type IEventMetadata } from 'src/libs/core/domain';
import { TicketId } from '../value-objects/ticket-id.value-object';
import {
  TicketPriority,
  TicketPriorityEnum,
  SLA_POLICIES,
} from '../value-objects/ticket-priority.value-object';
import {
  TicketStage,
  TicketStageEnum,
} from '../value-objects/ticket-stage.value-object';
import { TicketCreatedEvent } from '../events/ticket-created.event';
import { TicketStageChangedEvent } from '../events/ticket-stage-changed.event';
import { TicketClosedEvent } from '../events/ticket-closed.event';

export type EscalationLevel = 'NONE' | 'TEAM_LEAD' | 'DEPT_HEAD' | 'URGENT';

export interface CreateTicketProps {
  conversationId?: string;
  customerId?: string;
  channel: string;
  title: string;
  description?: string;
  priority: TicketPriority;
}

/**
 * Ticket Aggregate Root (FR21-24, FR20, FR26, FR27)
 *
 * Owns:
 *   - Ticket lifecycle state machine (RECEIVED → IN_PROGRESS → WAITING → RESOLVED → CLOSED)
 *   - Dual SLA clocks (ack + resolve deadlines, computed from priority policy)
 *   - Escalation level (NONE → TEAM_LEAD → DEPT_HEAD → URGENT)
 *   - CSAT reopen (CLOSED → IN_PROGRESS with new 24h SLA)
 *   - Parent-Incident linkage (parentId)
 */
export class Ticket extends AggregateRoot {
  private _ticketId: TicketId;
  private _conversationId: string | null;
  private _customerId: string | null;
  private _channel: string;
  private _title: string;
  private _description: string;
  private _priority: TicketPriority;
  private _stage: TicketStage;
  private _assignee: string | null = null;
  private _parentId: string | null = null;
  private _escalated: boolean = false;
  private _escalationLevel: EscalationLevel = 'NONE';
  private _reopenedFromCsat: boolean = false;

  // SLA dual-clock
  private _ackDeadline: Date;
  private _resolveDeadline: Date;
  private _acknowledgedAt: Date | null = null;
  private _closedAt: Date | null = null;

  private constructor(
    id: string,
    version?: number,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, version, createdAt, updatedAt);
  }

  // ─── Factory ───

  static create(id: string, props: CreateTicketProps, metadata?: IEventMetadata): Ticket {
    const ticket = new Ticket(id);
    ticket._ticketId = TicketId.create(id);
    ticket._conversationId = props.conversationId ?? null;
    ticket._customerId = props.customerId ?? null;
    ticket._channel = props.channel;
    ticket._title = props.title;
    ticket._description = props.description ?? '';
    ticket._priority = props.priority;
    ticket._stage = TicketStage.create(TicketStageEnum.RECEIVED);

    const now = new Date();
    const policy = SLA_POLICIES[props.priority.value];
    ticket._ackDeadline = new Date(now.getTime() + policy.ackMs);
    ticket._resolveDeadline = new Date(now.getTime() + policy.resolveMs);

    ticket.addDomainEvent(
      new TicketCreatedEvent({
        ticketId: id,
        conversationId: props.conversationId ?? null,
        customerId: props.customerId ?? null,
        channel: props.channel,
        priority: props.priority.value,
        title: props.title,
        ackDeadline: ticket._ackDeadline,
        resolveDeadline: ticket._resolveDeadline,
        schedule: policy.schedule,
        metadata,
      }),
    );

    return ticket;
  }

  // ─── Reconstitute ───

  static reconstitute(
    id: string,
    conversationId: string | null,
    customerId: string | null,
    channel: string,
    title: string,
    description: string,
    priority: TicketPriorityEnum,
    stage: TicketStageEnum,
    assignee: string | null,
    parentId: string | null,
    ackDeadline: Date,
    resolveDeadline: Date,
    acknowledgedAt: Date | null,
    closedAt: Date | null,
    escalated: boolean,
    escalationLevel: EscalationLevel,
    reopenedFromCsat: boolean,
    version: number,
    createdAt: Date,
    updatedAt: Date,
  ): Ticket {
    const ticket = new Ticket(id, version, createdAt, updatedAt);
    ticket._ticketId = TicketId.create(id);
    ticket._conversationId = conversationId;
    ticket._customerId = customerId;
    ticket._channel = channel;
    ticket._title = title;
    ticket._description = description;
    ticket._priority = TicketPriority.create(priority);
    ticket._stage = TicketStage.create(stage);
    ticket._assignee = assignee;
    ticket._parentId = parentId;
    ticket._ackDeadline = ackDeadline;
    ticket._resolveDeadline = resolveDeadline;
    ticket._acknowledgedAt = acknowledgedAt;
    ticket._closedAt = closedAt;
    ticket._escalated = escalated;
    ticket._escalationLevel = escalationLevel;
    ticket._reopenedFromCsat = reopenedFromCsat;
    return ticket;
  }

  // ─── Behavior ───

  /**
   * Advance to a new stage (FR20). Enforces valid transitions.
   * Auto-sets acknowledgedAt on first IN_PROGRESS (stops Ack clock).
   */
  advanceStage(target: TicketStageEnum, metadata?: IEventMetadata): void {
    const targetStage = TicketStage.create(target);

    if (!this._stage.canTransitionTo(target)) {
      throw new DomainException(
        `Invalid transition: ${this._stage.value} → ${target}. Allowed: ${STAGE_TRANSITIONS[this._stage.value]?.join(', ') ?? 'none'}`,
        'INVALID_TRANSITION',
      );
    }

    const previousStage = this._stage.value;
    this._stage = targetStage;

    // Auto-stop Ack clock on first IN_PROGRESS
    if (target === TicketStageEnum.IN_PROGRESS && !this._acknowledgedAt) {
      this._acknowledgedAt = new Date();
    }

    // Set closedAt on CLOSE
    if (target === TicketStageEnum.CLOSED) {
      this._closedAt = new Date();
      this.addDomainEvent(
        new TicketClosedEvent({
          ticketId: this.id,
          conversationId: this._conversationId,
          closedAt: this._closedAt,
          metadata,
        }),
      );
    }

    this.addDomainEvent(
      new TicketStageChangedEvent({
        ticketId: this.id,
        newStage: target,
        previousStage,
        metadata,
      }),
    );
  }

  /**
   * Reassign ticket to another agent (FR54).
   */
  reassign(assignee: string): void {
    if (!assignee) {
      throw new DomainException('Assignee is required', 'ASSIGNEE_REQUIRED');
    }
    this._assignee = assignee;
    this.markAsModified();
  }

  /**
   * Escalate the ticket (FR26). Idempotent per level.
   */
  escalate(level: EscalationLevel): void {
    if (this._escalationLevel === level) return; // idempotent
    this._escalated = true;
    this._escalationLevel = level;
    this.markAsModified();
  }

  /**
   * Reopen from CSAT <3 stars (FR27).
   * CLOSED → IN_PROGRESS + escalate(URGENT) + new 24h SLA.
   * Time limit: 30 days after CLOSE.
   */
  reopenFromCsat(metadata?: IEventMetadata): void {
    if (this._stage.value !== TicketStageEnum.CLOSED) {
      throw new DomainException(
        `Cannot reopen: ticket is ${this._stage.value} (must be CLOSED)`,
        'INVALID_REOPEN',
      );
    }

    // 30-day limit
    if (this._closedAt) {
      const daysSinceClose = (Date.now() - this._closedAt.getTime()) / (24 * 3600 * 1000);
      if (daysSinceClose > 30) {
        throw new DomainException(
          `Cannot reopen: ticket closed ${Math.floor(daysSinceClose)} days ago (limit: 30 days)`,
          'REOPEN_TIME_LIMIT',
        );
      }
    }

    this._stage = TicketStage.create(TicketStageEnum.IN_PROGRESS);
    this._reopenedFromCsat = true;
    this._closedAt = null;
    this._escalated = true;
    this._escalationLevel = 'URGENT';

    // New 24h SLA (24/7, hard)
    const now = new Date();
    this._resolveDeadline = new Date(now.getTime() + 24 * 3600 * 1000);

    this.addDomainEvent(
      new TicketStageChangedEvent({
        ticketId: this.id,
        newStage: TicketStageEnum.IN_PROGRESS,
        previousStage: TicketStageEnum.CLOSED,
        reason: 'CSAT_REOPEN',
        metadata,
      }),
    );
  }

  /**
   * Attach to a parent incident (FR61).
   */
  attachToParent(parentId: string): void {
    if (!parentId) {
      throw new DomainException('Parent ID is required', 'PARENT_ID_REQUIRED');
    }
    this._parentId = parentId;
    this.markAsModified();
  }

  /**
   * Detach from parent (FR61).
   */
  detachFromParent(): void {
    this._parentId = null;
    this.markAsModified();
  }

  // ─── Getters ───

  get ticketId(): TicketId { return this._ticketId; }
  get conversationId(): string | null { return this._conversationId; }
  get customerId(): string | null { return this._customerId; }
  get channel(): string { return this._channel; }
  get title(): string { return this._title; }
  get description(): string { return this._description; }
  get priority(): TicketPriority { return this._priority; }
  get stage(): TicketStage { return this._stage; }
  get assignee(): string | null { return this._assignee; }
  get parentId(): string | null { return this._parentId; }
  get escalated(): boolean { return this._escalated; }
  get escalationLevel(): EscalationLevel { return this._escalationLevel; }
  get reopenedFromCsat(): boolean { return this._reopenedFromCsat; }
  get ackDeadline(): Date { return this._ackDeadline; }
  get resolveDeadline(): Date { return this._resolveDeadline; }
  get acknowledgedAt(): Date | null { return this._acknowledgedAt; }
  get closedAt(): Date | null { return this._closedAt; }

  get isAckBreached(): boolean {
    return !this._acknowledgedAt && this._ackDeadline.getTime() < Date.now();
  }
  get isResolveBreached(): boolean {
    return this._resolveDeadline.getTime() < Date.now() && !this._stage.isResolved;
  }
  get ackRemainingMs(): number {
    return this._acknowledgedAt ? 0 : this._ackDeadline.getTime() - Date.now();
  }
  get resolveRemainingMs(): number {
    return this._stage.isResolved ? 0 : this._resolveDeadline.getTime() - Date.now();
  }
}

// Import here to avoid circular dependency in canTransitionTo error message
import { STAGE_TRANSITIONS } from '../value-objects/ticket-stage.value-object';
