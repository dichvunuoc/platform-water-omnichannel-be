import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { IEventBus } from 'src/libs/core/infrastructure';
import { EVENT_BUS_TOKEN } from 'src/libs/core/constants';
import type { ITicketRepository } from '../../domain';
import { TICKET_REPOSITORY_TOKEN } from '../../constants';
import { SlaCalculator } from '../../domain/services/sla-calculator.domain-service';

/**
 * SLA Background Worker (FR24)
 *
 * Runs every 60 seconds via @nestjs/schedule.
 * Scans all open tickets → computes remaining SLA via SlaCalculator → emits events.
 *
 * Dual-clock logic (PRD §2.1):
 *   - Ack clock: from createdAt → stops at acknowledgedAt (first agent response)
 *   - Resolve clock: from createdAt → stops at RESOLVED/CLOSED
 *
 * Events emitted (contract — Architecture §5):
 *   - SlaWarning: <30 min remaining (once per ticket per clock)
 *   - SlaBreached: past deadline
 *
 * Escalation triggers (PRD §2.4 — handled by EscalationService in T-3):
 *   - Warning → TEAM_LEAD
 *   - Breach → DEPT_HEAD
 */
@Injectable()
export class SlaWorkerService {
  private readonly logger = new Logger(SlaWorkerService.name);

  /** Track warned tickets to avoid re-emitting every tick */
  private readonly ackWarned = new Set<string>();
  private readonly resolveWarned = new Set<string>();

  constructor(
    @Inject(TICKET_REPOSITORY_TOKEN)
    private readonly repo: ITicketRepository,
    @Optional()
    @Inject(EVENT_BUS_TOKEN)
    private readonly eventBus?: IEventBus,
  ) {}

  /**
   * Scan all open tickets every 60 seconds (FR-T3.1, NFR-T2).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkSla(): Promise<void> {
    const tickets = await this.repo.findOpenTickets();
    if (tickets.length === 0) return;

    let warnings = 0;
    let breaches = 0;

    for (const ticket of tickets) {
      const schedule = ticket.priority.schedule;

      // ── Ack clock (only if not yet acknowledged) ──
      if (!ticket.acknowledgedAt) {
        const ackRemaining = SlaCalculator.calculateRemaining(
          ticket.createdAt,
          ticket.ackDeadline,
          schedule,
        );

        if (ackRemaining <= 0) {
          // Ack breached
          await this.emitEvent('SlaWarning', {
            ticketId: ticket.id,
            conversationId: ticket.conversationId,
            slaDeadline: ticket.ackDeadline,
            remainingMs: 0,
            severity: 'BREACHED',
            clock: 'ACK',
            stage: ticket.stage.value,
            assignee: ticket.assignee,
          });
          breaches++;
        } else if (ackRemaining < 30 * 60 * 1000 && !this.ackWarned.has(ticket.id)) {
          this.ackWarned.add(ticket.id);
          await this.emitEvent('SlaWarning', {
            ticketId: ticket.id,
            conversationId: ticket.conversationId,
            slaDeadline: ticket.ackDeadline,
            remainingMs: ackRemaining,
            severity: 'WARNING',
            clock: 'ACK',
            stage: ticket.stage.value,
            assignee: ticket.assignee,
          });
          warnings++;
        }
      }

      // ── Resolve clock ──
      const resolveRemaining = SlaCalculator.calculateRemaining(
        ticket.createdAt,
        ticket.resolveDeadline,
        schedule,
      );

      if (resolveRemaining <= 0) {
        // Resolve breached
        if (!this.resolveWarned.has(ticket.id + ':breached')) {
          this.resolveWarned.add(ticket.id + ':breached');
          await this.emitEvent('SlaBreached', {
            ticketId: ticket.id,
            conversationId: ticket.conversationId,
            slaDeadline: ticket.resolveDeadline,
            remainingMs: 0,
            severity: 'BREACHED',
            clock: 'RESOLVE',
            stage: ticket.stage.value,
            assignee: ticket.assignee,
          });
          breaches++;
        }
      } else if (resolveRemaining < 30 * 60 * 1000 && !this.resolveWarned.has(ticket.id)) {
        this.resolveWarned.add(ticket.id);
        await this.emitEvent('SlaWarning', {
          ticketId: ticket.id,
          conversationId: ticket.conversationId,
          slaDeadline: ticket.resolveDeadline,
          remainingMs: resolveRemaining,
          severity: 'WARNING',
          clock: 'RESOLVE',
          stage: ticket.stage.value,
          assignee: ticket.assignee,
        });
        warnings++;
      }
    }

    if (warnings > 0 || breaches > 0) {
      this.logger.warn(`SLA scan complete: ${tickets.length} open tickets, ${warnings} warnings, ${breaches} breaches`);
    }
  }

  private async emitEvent(eventType: string, payload: any): Promise<void> {
    if (!this.eventBus) {
      this.logger.debug(`EventBus unavailable — '${eventType}' logged only`);
      return;
    }
    await this.eventBus.publish({ eventType, aggregateId: payload.ticketId, data: payload } as any);
  }
}
