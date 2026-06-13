/**
 * Get Ticket History Handler (AC#2 — FR46)
 *
 * Calls Ticketing Service via PortRegistry to fetch paginated ticket list.
 * Pattern: CreateTicketHandler (PortRegistry execute + null guard).
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { GetTicketHistoryQuery, GetTicketHistoryResult } from '../get-ticket-history.query';
import type { TicketHistoryResponse } from '../../dtos/ticket.dto';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';

@QueryHandler(GetTicketHistoryQuery)
export class GetTicketHistoryHandler implements IQueryHandler<GetTicketHistoryQuery> {
  private readonly logger = new Logger(GetTicketHistoryHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetTicketHistoryQuery): Promise<GetTicketHistoryResult> {
    const { customerId, status, page, pageSize } = query;

    this.logger.log(`Fetching ticket history for customer: ${customerId}`);

    const result: PortResult<TicketHistoryResponse> =
      await this.portRegistry.execute<TicketHistoryResponse>(
        'ticket',
        'get-ticket-history',
        { customerId, status, page, pageSize },
      );

    const history = result?.data;

    if (!history) {
      throw new PortFallbackException('ticket');
    }

    return history;
  }
}
