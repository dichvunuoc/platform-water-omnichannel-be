import { Inject, Optional, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { ICommandHandler } from 'src/libs/core/application';
import type { IRequestContextProvider } from 'src/libs/core/common';
import { NotFoundException, DomainException } from 'src/libs/core/common';
import { REQUEST_CONTEXT_TOKEN } from 'src/libs/core/constants';
import { CommandHandler } from 'src/libs/shared/cqrs';
import {
  Message,
  MessageDirection,
  SenderType,
  type ChannelEnum,
} from '../../../domain';
import type { IConversationRepository } from '../../../domain';
import type { IOutboundChannelAdapter } from '../../ports/outbound-channel.port';
import { CONVERSATION_REPOSITORY_TOKEN } from '../../../constants/tokens';
import { SendReplyCommand } from '../send-reply.command';
import { OUTBOUND_ADAPTERS_TOKEN } from '../../../constants/outbound-tokens';

/**
 * Send Reply Command Handler
 *
 * Agent replies to a customer on the conversation's origin channel (FR5/FR11).
 *
 * Flow:
 *  1. Load conversation by ID (throw if not found / not ACTIVE).
 *  2. Create an OUTBOUND Message (direction=OUTBOUND, senderType=AGENT).
 *  3. Append to conversation → enqueues MessageReceived event (realtime echo).
 *  4. Save (persist + outbox → realtime gateway pushes echo to agent).
 *  5. Fire-and-forget outbound channel send (non-blocking; failure → logged, not thrown).
 */
@CommandHandler(SendReplyCommand)
export class SendReplyHandler
  implements ICommandHandler<SendReplyCommand, { messageId: string }>
{
  private readonly logger = new Logger(SendReplyHandler.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY_TOKEN)
    private readonly conversationRepository: IConversationRepository,
    @Inject(OUTBOUND_ADAPTERS_TOKEN)
    private readonly outboundAdapters: Map<ChannelEnum, IOutboundChannelAdapter>,
    @Optional()
    @Inject(REQUEST_CONTEXT_TOKEN)
    private readonly requestContext?: IRequestContextProvider,
  ) {}

  async execute(command: SendReplyCommand): Promise<{ messageId: string }> {
    const ctx = this.requestContext?.current();
    const metadata = ctx
      ? { correlationId: ctx.correlationId, causationId: ctx.causationId, userId: command.agentId }
      : { userId: command.agentId };

    // 1. Load conversation
    const conversation = await this.conversationRepository.getById(command.conversationId);
    if (!conversation) {
      throw NotFoundException.entity('Conversation', command.conversationId);
    }
    if (!conversation.isActive) {
      throw new DomainException(
        `Conversation ${command.conversationId} is not active (status: ${conversation.status})`,
        'CONVERSATION_NOT_ACTIVE',
      );
    }

    // 2. Create OUTBOUND message
    const message = Message.create({
      id: randomUUID(),
      conversationId: conversation.id,
      channel: conversation.channel,
      direction: MessageDirection.OUTBOUND,
      senderType: SenderType.AGENT,
      content: command.content,
      attachments: command.attachments,
    });

    // 3. Append → enqueues MessageReceived (realtime echo fires via outbox→bus→gateway)
    conversation.receiveMessage(message, metadata);

    // 4. Save (persist + outbox)
    await this.conversationRepository.save(conversation);

    // 5. Fire-and-forget outbound channel send (AC: 2 + AC4 note below)
    //    Non-blocking: if the send fails, the message is ALREADY persisted + the
    //    agent sees the echo. The outbox already holds the MessageReceived event.
    //
    //    AC4 (retry on failure): the message is persisted + echoed (no silent loss
    //    from the agent's perspective). Full outbound retry (re-send to the channel)
    //    requires an outbound-queue consumer reading "OutboundSendFailed" events —
    //    deferred to wave-2 when the outbox consumer infrastructure is in place.
    //    For MVP: failures are logged + the message remains in the conversation
    //    (agent can manually re-send). The customer-facing send is best-effort.
    this.sendToChannel(
      conversation.channel.value,
      conversation.customerChannelId,
      command.content,
      command.attachments,
    ).catch((err) => {
      this.logger.error(
        `Outbound send failed (non-blocking — message persisted): conv=${conversation.id} err=${err}`,
      );
    });

    this.logger.log(
      `Reply sent: conv=${conversation.id} msg=${message.id} agent=${command.agentId}`,
    );

    return { messageId: message.id };
  }

  /**
   * Send the message to the customer's channel (fire-and-forget).
   */
  private async sendToChannel(
    channel: ChannelEnum,
    customerChannelId: string,
    content: string,
    attachments: string[],
  ): Promise<void> {
    const adapter = this.outboundAdapters.get(channel);
    if (!adapter) {
      this.logger.warn(`No outbound adapter for channel ${channel} — skipping send`);
      return;
    }

    const result = await adapter.send(customerChannelId, content, attachments);
    if (!result.success) {
      this.logger.warn(`Outbound send failed for ${channel}: ${result.error}`);
      // FR7: message is persisted + echoed. Retry consumer (future) can re-attempt.
    } else {
      this.logger.debug(`Outbound sent: ${channel} → ${customerChannelId} extId=${result.externalId}`);
    }
  }
}
