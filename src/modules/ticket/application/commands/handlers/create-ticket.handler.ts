/**
 * Create Ticket Command Handler (AC#3, #4 — FR41, FR42)
 *
 * Calls Ticketing Service via PortRegistry to create an incident ticket.
 * useCache: false — ticket creation must hit downstream live.
 *
 * Pattern: CreatePaymentHandler (single port call, null guard).
 *
 * TODO: Record session event when session module is built (Epic 7)
 * { type: "ticket_created", ticketId: ticket.trackingId, channel }
 */

import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { CreateTicketCommand, CreateTicketResult } from '../create-ticket.command';
import type { CreateTicketResponse } from '../../dtos/ticket.dto';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';

/** Default priority per incident type — can be extended as business rules evolve */
const INCIDENT_PRIORITY_DEFAULT = 'normal' as const;

@CommandHandler(CreateTicketCommand)
export class CreateTicketHandler implements ICommandHandler<CreateTicketCommand> {
  private readonly logger = new Logger(CreateTicketHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: CreateTicketCommand): Promise<CreateTicketResult> {
    const { customerId, type, description, imageUrls } = command;

    this.logger.log(`Creating ticket for customer: ${customerId}, type: ${type}`);

    const result: PortResult<CreateTicketResponse> =
      await this.portRegistry.execute<CreateTicketResponse>(
        'ticket',
        'create-ticket',
        {
          customerId,
          type,
          description,
          imageUrls,
          priority: INCIDENT_PRIORITY_DEFAULT,
          useCache: false,
        },
      );

    const ticket = result?.data;

    if (!ticket) {
      throw new PortFallbackException('ticket');
    }

    // TODO: Record session event when session module is built (Epic 7)
    // { type: "ticket_created", ticketId: ticket.trackingId, channel }

    this.logger.log(`Ticket created: ${ticket.trackingId}`);
    return ticket;
  }
}
