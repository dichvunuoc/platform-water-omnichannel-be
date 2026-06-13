/**
 * Handle Ticket Webhook Command (AC#3 — FR44)
 *
 * Processes ticket status change webhook from Ticketing Service.
 * Carries validated payload to the handler.
 *
 * Pattern: HandlePaymentWebhookCommand (idempotency via IdempotencyService).
 */

import { ICommand } from '@core/application';
import type { TicketWebhookPayload } from '../dtos/ticket.dto';

export class HandleTicketWebhookCommand implements ICommand {
  constructor(public readonly payload: TicketWebhookPayload) {}
}

export type HandleTicketWebhookResult = {
  processed: boolean;
  ticketId: string;
  status: string;
};
