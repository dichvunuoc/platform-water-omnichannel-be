/**
 * Get Ticket Status Query (AC#1 — FR43)
 *
 * Fetches ticket status with full timeline, ETA, and assigned team info.
 */

import { IQuery } from '@core/application';
import type { TicketStatusResponse } from '../dtos/ticket.dto';

export class GetTicketStatusQuery extends IQuery<TicketStatusResponse> {
  constructor(
    public readonly ticketId: string,
  ) {
    super();
  }
}

export type GetTicketStatusResult = TicketStatusResponse;
