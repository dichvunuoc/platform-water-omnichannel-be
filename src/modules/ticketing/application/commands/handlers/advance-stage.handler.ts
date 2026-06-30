import { Inject, Logger } from '@nestjs/common';
import type { ICommandHandler } from 'src/libs/core/application';
import { NotFoundException } from 'src/libs/core/common';
import { CommandHandler } from 'src/libs/shared/cqrs';
import type { ITicketRepository } from '../../../domain';
import { TICKET_REPOSITORY_TOKEN } from '../../../constants';
import { AdvanceStageCommand } from '../advance-stage.command';

@CommandHandler(AdvanceStageCommand)
export class AdvanceStageHandler
  implements ICommandHandler<AdvanceStageCommand, void>
{
  private readonly logger = new Logger(AdvanceStageHandler.name);

  constructor(
    @Inject(TICKET_REPOSITORY_TOKEN)
    private readonly repo: ITicketRepository,
  ) {}

  async execute(command: AdvanceStageCommand): Promise<void> {
    const ticket = await this.repo.getById(command.ticketId);
    if (!ticket) {
      throw NotFoundException.entity('Ticket', command.ticketId);
    }

    ticket.advanceStage(command.newStage);
    await this.repo.save(ticket);
    this.logger.log(`Ticket ${command.ticketId} → ${command.newStage}`);
  }
}
