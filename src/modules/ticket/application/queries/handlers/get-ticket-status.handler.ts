/**
 * Get Ticket Status Handler (AC#1 — FR43)
 *
 * Calls Ticketing Service via PortRegistry to fetch ticket status + timeline.
 * Pattern: CreateTicketHandler (PortRegistry execute + null guard).
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { GetTicketStatusQuery, GetTicketStatusResult } from '../get-ticket-status.query';
import type { TicketStatusResponse } from '../../dtos/ticket.dto';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';

@QueryHandler(GetTicketStatusQuery)
export class GetTicketStatusHandler implements IQueryHandler<GetTicketStatusQuery> {
  private readonly logger = new Logger(GetTicketStatusHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetTicketStatusQuery): Promise<GetTicketStatusResult> {
    const { ticketId } = query;

    this.logger.log(`Fetching ticket status: ${ticketId}`);

    const result: PortResult<TicketStatusResponse> =
      await this.portRegistry.execute<TicketStatusResponse>(
        'ticket',
        'get-ticket-status',
        { ticketId },
      );

    const ticket = result?.data;

    if (!ticket) {
      throw new PortFallbackException('ticket');
    }

    return ticket;
  }
}
