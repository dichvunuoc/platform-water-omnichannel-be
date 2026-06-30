import { Inject, Logger } from '@nestjs/common';
import type { ICommandHandler } from 'src/libs/core/application';
import { CommandHandler } from 'src/libs/shared/cqrs';
import {
  Ticket,
  TicketPriority,
  type ITicketRepository,
} from '../../../domain';
import { TICKET_REPOSITORY_TOKEN } from '../../../constants';
import { CreateTicketCommand } from '../create-ticket.command';

@CommandHandler(CreateTicketCommand)
export class CreateTicketHandler
  implements ICommandHandler<CreateTicketCommand, { ticketId: string }>
{
  private readonly logger = new Logger(CreateTicketHandler.name);

  constructor(
    @Inject(TICKET_REPOSITORY_TOKEN)
    private readonly repo: ITicketRepository,
  ) {}

  async execute(command: CreateTicketCommand): Promise<{ ticketId: string }> {
    const id = `SC-${Date.now().toString(36).toUpperCase()}`;
    const priority = TicketPriority.create(command.priority);

    const ticket = Ticket.create(id, {
      conversationId: command.conversationId ?? undefined,
      customerId: command.customerId ?? undefined,
      channel: command.channel,
      title: command.title,
      description: command.description,
      priority,
    });

    await this.repo.save(ticket);
    this.logger.log(`Ticket created: ${id} (${command.priority})`);
    return { ticketId: id };
  }
}
