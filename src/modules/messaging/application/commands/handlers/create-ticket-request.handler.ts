import { Inject, Logger } from '@nestjs/common';
import type { ICommandHandler } from 'src/libs/core/application';
import { NotFoundException } from 'src/libs/core/common';
import { CommandHandler } from 'src/libs/shared/cqrs';
import type { IConversationRepository } from '../../../domain';
import { CONVERSATION_REPOSITORY_TOKEN } from '../../../constants/tokens';
import { CreateTicketRequestCommand } from '../create-ticket-request.command';
import { TicketingStubService } from '../../../../ticketing-stub/ticketing-stub.service';

/**
 * Create Ticket Request Handler (FR19)
 *
 * OmniCare's side of the ticket-creation boundary:
 *   1. Load conversation (throw if not found).
 *   2. If conversation already has a ticketId → return it (duplicate guard).
 *   3. Call the Ticketing stub (simulates publishing TicketCreateRequested to the broker).
 *   4. Link the conversation to the returned ticket ID.
 *   5. Return { ok, ticketId }.
 *
 * NOTE: The actual ticket creation logic (FR21-23: assign ID, classify, SLA policy)
 * is the Ticketing & SLA service's responsibility — NOT here.
 */
@CommandHandler(CreateTicketRequestCommand)
export class CreateTicketRequestHandler
  implements ICommandHandler<CreateTicketRequestCommand, { ok: true; ticketId: string }>
{
  private readonly logger = new Logger(CreateTicketRequestHandler.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY_TOKEN)
    private readonly conversationRepository: IConversationRepository,
    private readonly ticketingStub: TicketingStubService,
  ) {}

  async execute(
    command: CreateTicketRequestCommand,
  ): Promise<{ ok: true; ticketId: string }> {
    // 1. Load conversation
    const conversation = await this.conversationRepository.getById(command.conversationId);
    if (!conversation) {
      throw NotFoundException.entity('Conversation', command.conversationId);
    }

    // 2. Duplicate guard — already has a ticket
    if (conversation.ticketId) {
      this.logger.debug(`Conversation ${command.conversationId} already linked to ticket ${conversation.ticketId}`);
      return { ok: true, ticketId: conversation.ticketId };
    }

    // 3. Request ticket creation from the Ticketing service (stub)
    //    In production: this publishes TicketCreateRequested to the broker.
    //    For wave-1: we call the stub directly (synchronous — stub is in-process).
    const ticket = this.ticketingStub.createTicket({
      conversationId: command.conversationId,
      customerId: conversation.customerId ?? undefined,
      channel: conversation.channel.value,
      priority: command.priority,
      title: command.title ?? `Ticket from conversation ${command.conversationId}`,
      description: command.description,
      fastForwardSla: command.fastForwardSla ?? false,
    });

    // 4. Link conversation → ticket
    conversation.linkTicket(ticket.id);
    await this.conversationRepository.save(conversation);

    this.logger.log(`Ticket requested + linked: conv=${command.conversationId} → ticket=${ticket.id} (priority=${ticket.priority})`);

    return { ok: true, ticketId: ticket.id };
  }
}
