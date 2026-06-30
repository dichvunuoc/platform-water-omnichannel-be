import { Inject, Optional, Logger } from '@nestjs/common';
import type { ICommandHandler } from 'src/libs/core/application';
import type { IRequestContextProvider } from 'src/libs/core/common';
import { NotFoundException } from 'src/libs/core/common';
import { REQUEST_CONTEXT_TOKEN } from 'src/libs/core/constants';
import { CommandHandler } from 'src/libs/shared/cqrs';
import type { IConversationRepository } from '../../../domain';
import { CONVERSATION_REPOSITORY_TOKEN } from '../../../constants/tokens';
import { ArchiveConversationCommand } from '../archive-conversation.command';

/**
 * Archive Conversation Command Handler (FR18).
 *
 * Loads conversation → close() → archive() → save.
 * A conversation must be CLOSED before it can be ARCHIVED.
 */
@CommandHandler(ArchiveConversationCommand)
export class ArchiveConversationHandler
  implements ICommandHandler<ArchiveConversationCommand, void>
{
  private readonly logger = new Logger(ArchiveConversationHandler.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY_TOKEN)
    private readonly conversationRepository: IConversationRepository,
    @Optional()
    @Inject(REQUEST_CONTEXT_TOKEN)
    private readonly requestContext?: IRequestContextProvider,
  ) {}

  async execute(command: ArchiveConversationCommand): Promise<void> {
    const conversation = await this.conversationRepository.getById(command.conversationId);
    if (!conversation) {
      throw NotFoundException.entity('Conversation', command.conversationId);
    }

    // Close first (if still active), then archive
    if (conversation.isActive) {
      conversation.close();
    }
    conversation.archive();
    await this.conversationRepository.save(conversation);

    this.logger.log(`Conversation archived: ${command.conversationId} by agent ${command.agentId}`);
  }
}
