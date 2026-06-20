/**
 * Create Ticket Command Handler (AC#3, #4 — FR41, FR42)
 *
 * Thin orchestrator: calls the downstream Ticketing Service via PortRegistry to
 * create an incident ticket, and returns the result. useCache: false — ticket
 * creation must hit downstream live.
 *
 * NOTE on session timeline: the `ticket_created` interaction event is NOT recorded
 * here. Per the architecture, the Ticketing Service OWNS the ticket lifecycle and
 * emits lifecycle events back to the BFF via webhooks — exactly how
 * `ticket_status_changed` flows through HandleTicketWebhookHandler. A `ticket_created`
 * event should be emitted by the downstream service the same way (and recorded by
 * the ticket-webhook path), NOT synthesised inside this BFF command handler.
 *
 * Pattern: single port call + null guard.
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

    this.logger.log(`Ticket created: ${ticket.trackingId}`);
    return ticket;
  }
}
