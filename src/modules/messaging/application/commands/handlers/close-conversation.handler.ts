import { Inject, Optional, Logger } from '@nestjs/common';
import type { ICommandHandler } from 'src/libs/core/application';
import type { IRequestContextProvider } from 'src/libs/core/common';
import { NotFoundException } from 'src/libs/core/common';
import { REQUEST_CONTEXT_TOKEN } from 'src/libs/core/constants';
import { CommandHandler } from 'src/libs/shared/cqrs';
import type { IConversationRepository } from '../../../domain';
import { CONVERSATION_REPOSITORY_TOKEN } from '../../../constants/tokens';
import { CloseConversationCommand } from '../close-conversation.command';

/**
 * Close Conversation Command Handler (FR18).
 *
 * Loads conversation → close() → save. Distinct from ticket resolution
 * (which is in the Ticketing service).
 */
@CommandHandler(CloseConversationCommand)
export class CloseConversationHandler
  implements ICommandHandler<CloseConversationCommand, void>
{
  private readonly logger = new Logger(CloseConversationHandler.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY_TOKEN)
    private readonly conversationRepository: IConversationRepository,
    @Optional()
    @Inject(REQUEST_CONTEXT_TOKEN)
    private readonly requestContext?: IRequestContextProvider,
  ) {}

  async execute(command: CloseConversationCommand): Promise<void> {
    const conversation = await this.conversationRepository.getById(command.conversationId);
    if (!conversation) {
      throw NotFoundException.entity('Conversation', command.conversationId);
    }

    conversation.close();
    await this.conversationRepository.save(conversation);

    this.logger.log(`Conversation closed: ${command.conversationId} by agent ${command.agentId}`);
  }
}
