import { Inject, Optional, Logger } from '@nestjs/common';
import type { ICommandHandler } from 'src/libs/core/application';
import { NotFoundException } from 'src/libs/core/common';
import { REQUEST_CONTEXT_TOKEN } from 'src/libs/core/constants';
import type { IRequestContextProvider } from 'src/libs/core/common';
import { CommandHandler } from 'src/libs/shared/cqrs';
import type { IConversationRepository } from '../../../domain';
import type { ICustomer360Port } from '../../../domain/ports/customer-360.port';
import { CONVERSATION_REPOSITORY_TOKEN } from '../../../constants/tokens';
import { CUSTOMER_360_PORT_TOKEN } from '../../../constants/customer-tokens';
import { AssignCustomerCommand } from '../assign-customer.command';

/**
 * Assign Customer Command Handler (FR28/FR29/FR31)
 *
 * Resolves customer identity → assigns to conversation → saves.
 * If identity can't be resolved, conversation retains null customerId (FR30 fallback).
 */
@CommandHandler(AssignCustomerCommand)
export class AssignCustomerHandler
  implements ICommandHandler<AssignCustomerCommand, { resolved: boolean; customerId: string | null }>
{
  private readonly logger = new Logger(AssignCustomerHandler.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY_TOKEN)
    private readonly conversationRepository: IConversationRepository,
    @Inject(CUSTOMER_360_PORT_TOKEN)
    private readonly customer360: ICustomer360Port,
    @Optional()
    @Inject(REQUEST_CONTEXT_TOKEN)
    private readonly requestContext?: IRequestContextProvider,
  ) {}

  async execute(
    command: AssignCustomerCommand,
  ): Promise<{ resolved: boolean; customerId: string | null }> {
    // 1. Load conversation
    const conversation = await this.conversationRepository.getById(command.conversationId);
    if (!conversation) {
      throw NotFoundException.entity('Conversation', command.conversationId);
    }

    // 2. If customerId is provided directly (manual / already resolved), assign + save
    if (command.customerId) {
      conversation.assignCustomer(command.customerId);
      await this.conversationRepository.save(conversation);
      this.logger.log(`Customer assigned (direct): conv=${conversation.id} customer=${command.customerId}`);
      return { resolved: true, customerId: command.customerId };
    }

    // 3. Resolve identity via Customer 360 port (FR28)
    const profile = await this.customer360.resolveIdentity(
      conversation.channel.value,
      conversation.customerChannelId,
    );

    if (!profile) {
      // FR30 — fallback: conversation retains null customerId
      this.logger.warn(
        `Identity NOT resolved: conv=${conversation.id} channel=${conversation.channel.value} cid=${conversation.customerChannelId}`,
      );
      return { resolved: false, customerId: null };
    }

    // 4. Assign + save
    conversation.assignCustomer(profile.id);
    await this.conversationRepository.save(conversation);

    this.logger.log(`Identity resolved: conv=${conversation.id} → ${profile.name} (${profile.id})`);
    return { resolved: true, customerId: profile.id };
  }
}
