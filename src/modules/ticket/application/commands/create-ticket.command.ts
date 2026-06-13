/**
 * Create Ticket Command (AC#3,#4)
 *
 * Creates a new support ticket / incident report.
 *
 * Flow:
 * 1. Customer submits ticket with type, description, and optional images
 * 2. Backend creates ticket and assigns tracking ID (TK-YYYY-NNN)
 * 3. Return tracking ID + initial status
 */

import { ICommand } from '@core/application';
import type {
  IncidentType,
  CreateTicketResponse,
} from '../dtos/ticket.dto';

export class CreateTicketCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly type: IncidentType,
    public readonly description: string,
    public readonly imageUrls?: string[],
  ) {}
}

export type CreateTicketResult = CreateTicketResponse;
