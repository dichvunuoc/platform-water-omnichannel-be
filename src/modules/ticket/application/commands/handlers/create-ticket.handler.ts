/**
 * Create Ticket Command Handler (AC#3, #4 — FR41, FR42)
 *
 * Calls Ticketing Service via PortRegistry to create an incident ticket.
 * useCache: false — ticket creation must hit downstream live.
 *
 * After creation, records a `ticket_created` session event so the customer's
 * 360° interaction timeline stays consistent (matches payment/ticket-webhook
 * handlers). Recording is wrapped — a session-store failure must NOT fail the
 * ticket creation the customer already received.
 *
 * Pattern: CreatePaymentHandler + HandleTicketWebhookHandler (port call + session event).
 */

import { ICommandHandler, CommandHandler, CommandBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { CreateTicketCommand, CreateTicketResult } from '../create-ticket.command';
import type { CreateTicketResponse } from '../../dtos/ticket.dto';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { RecordSessionEventCommand } from '@modules/session/application/commands/record-session-event.command';

/** Default priority per incident type — can be extended as business rules evolve */
const INCIDENT_PRIORITY_DEFAULT = 'normal' as const;

@CommandHandler(CreateTicketCommand)
export class CreateTicketHandler implements ICommandHandler<CreateTicketCommand> {
  private readonly logger = new Logger(CreateTicketHandler.name);

  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly commandBus: CommandBus,
  ) {}

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

    // Record the interaction on the customer's 360° timeline.
    try {
      await this.commandBus.execute(
        new RecordSessionEventCommand({
          userId: customerId,
          eventType: 'ticket_created',
          channel: 'web',
          content: { trackingId: ticket.trackingId, type, status: ticket.status },
        }),
      );
    } catch (err) {
      this.logger.warn(`Session event recording failed: ${(err as Error).message}`);
    }

    this.logger.log(`Ticket created: ${ticket.trackingId}`);
    return ticket;
  }
}
