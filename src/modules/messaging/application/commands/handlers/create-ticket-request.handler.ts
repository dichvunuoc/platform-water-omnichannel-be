import { Inject, Logger } from '@nestjs/common';
import type { ICommandHandler } from 'src/libs/core/application';
import { NotFoundException } from 'src/libs/core/common';
import { CommandHandler } from 'src/libs/shared/cqrs';
import type { IConversationRepository } from '../../../domain';
import { CONVERSATION_REPOSITORY_TOKEN } from '../../../constants/tokens';
import { CreateTicketRequestCommand } from '../create-ticket-request.command';
import type { ITicketRepository } from '../../../../ticketing/domain';
import { TICKET_REPOSITORY_TOKEN } from '../../../../ticketing/constants';
import { Ticket, TicketPriority } from '../../../../ticketing/domain';

/**
 * Create Ticket Request Handler (FR19) — real ticketing (Phase 2, stub removed).
 * Loads conversation → creates Ticket via real TicketRepository → links conversation.
 */
@CommandHandler(CreateTicketRequestCommand)
export class CreateTicketRequestHandler implements ICommandHandler<
  CreateTicketRequestCommand,
  { ok: true; ticketId: string }
> {
  private readonly logger = new Logger(CreateTicketRequestHandler.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY_TOKEN)
    private readonly conversationRepository: IConversationRepository,
    @Inject(TICKET_REPOSITORY_TOKEN)
    private readonly ticketRepo: ITicketRepository,
  ) {}

  async execute(
    command: CreateTicketRequestCommand,
  ): Promise<{ ok: true; ticketId: string }> {
    const conversation = await this.conversationRepository.getById(
      command.conversationId,
    );
    if (!conversation) {
      throw NotFoundException.entity('Conversation', command.conversationId);
    }

    if (conversation.ticketId) {
      this.logger.debug(
        `Conversation ${command.conversationId} already linked to ticket ${conversation.ticketId}`,
      );
      return { ok: true, ticketId: conversation.ticketId };
    }

    const id = `SC-${Date.now().toString(36).toUpperCase()}`;
    const priority = TicketPriority.create(command.priority ?? 'P2');

    const ticket = Ticket.create(id, {
      conversationId: command.conversationId,
      customerId: conversation.customerId ?? undefined,
      channel: conversation.channel.value,
      title:
        command.title ?? `Ticket from conversation ${command.conversationId}`,
      description: command.description,
      priority,
    });

    await this.ticketRepo.save(ticket);

    conversation.linkTicket(ticket.id);
    await this.conversationRepository.save(conversation);

    this.logger.log(
      `Ticket created + linked: conv=${command.conversationId} → ticket=${ticket.id}`,
    );
    return { ok: true, ticketId: ticket.id };
  }
}
