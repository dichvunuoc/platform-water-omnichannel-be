/**
 * Submit Feedback Command (AC#2 — FR45)
 *
 * Submits CSAT feedback (1-5 star rating + optional comment) for a ticket.
 */

import { ICommand } from '@core/application';
import type { CsatScore, SubmitFeedbackResponse } from '../dtos/ticket.dto';

export class SubmitFeedbackCommand implements ICommand {
  constructor(
    public readonly ticketId: string,
    public readonly customerId: string,
    public readonly score: CsatScore,
    public readonly comment?: string,
  ) {}
}

export type SubmitFeedbackResult = SubmitFeedbackResponse;
