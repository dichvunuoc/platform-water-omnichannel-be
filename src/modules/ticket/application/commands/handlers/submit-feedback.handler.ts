/**
 * Submit Feedback Handler (AC#2, #3 — FR45)
 *
 * Submits CSAT feedback to downstream Ticketing Service via PortRegistry.
 * Flags low-score tickets (< 3) for follow-up.
 *
 * Pattern: CreateTicketHandler (PortRegistry execute + null guard).
 */

import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { SubmitFeedbackCommand, SubmitFeedbackResult } from '../submit-feedback.command';
import type { SubmitFeedbackResponse } from '../../dtos/ticket.dto';
import { CSAT_LOW_SCORE_THRESHOLD } from '../../dtos/ticket.dto';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';

@CommandHandler(SubmitFeedbackCommand)
export class SubmitFeedbackHandler implements ICommandHandler<SubmitFeedbackCommand> {
  private readonly logger = new Logger(SubmitFeedbackHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: SubmitFeedbackCommand): Promise<SubmitFeedbackResult> {
    const { ticketId, customerId, score, comment } = command;

    this.logger.log(`Submitting CSAT feedback for ticket: ${ticketId}, score: ${score}`);

    const result: PortResult<SubmitFeedbackResponse> =
      await this.portRegistry.execute<SubmitFeedbackResponse>(
        'ticket',
        'submit-feedback',
        { ticketId, customerId, score, comment, useCache: false },
      );

    const feedback = result?.data;

    if (!feedback) {
      throw new PortFallbackException('ticket');
    }

    // AC#3: Flag low-score tickets for follow-up
    if (score < CSAT_LOW_SCORE_THRESHOLD) {
      this.logger.warn(
        `Low CSAT alert: ticket ${ticketId} scored ${score}/5 — flagged for follow-up`,
      );
      // TODO: Record session event when session module is built (Epic 7)
      // { type: "ticket_flagged_low_csat", ticketId, score }
    }

    this.logger.log(`CSAT feedback submitted: ${ticketId} → ${score}/5`);
    return feedback;
  }
}
