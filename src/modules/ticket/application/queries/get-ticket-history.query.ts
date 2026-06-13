/**
 * Get Ticket History Query (AC#2 — FR46)
 *
 * Fetches paginated ticket history list for a customer with optional status filter.
 */

import { IQuery } from '@core/application';
import type { TicketHistoryResponse } from '../dtos/ticket.dto';

export class GetTicketHistoryQuery extends IQuery<TicketHistoryResponse> {
  constructor(
    public readonly customerId: string,
    public readonly status?: string,
    public readonly page?: number,
    public readonly pageSize?: number,
  ) {
    super();
  }
}

export type GetTicketHistoryResult = TicketHistoryResponse;
