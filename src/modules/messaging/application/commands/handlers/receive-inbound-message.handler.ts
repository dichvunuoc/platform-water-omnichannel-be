import { Inject, Optional, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { ICommandHandler } from 'src/libs/core/application';
import type { IRequestContextProvider } from 'src/libs/core/common';
import { REQUEST_CONTEXT_TOKEN } from 'src/libs/core/constants';
import { CommandHandler, IdempotencyService } from 'src/libs/shared/cqrs';
import {
  Channel,
  Conversation,
  Message,
  MessageDirection,
  SenderType,
} from '../../../domain';
import type { IConversationRepository } from '../../../domain';
import { CONVERSATION_REPOSITORY_TOKEN } from '../../../constants/tokens';
import { ReceiveInboundMessageCommand } from '../receive-inbound-message.command';

/**
 * Receive Inbound Message Command Handler
 *
 * The ingestion pipeline (story 1.1):
 *  1. Idempotency check (FR3) — dedup by channel + externalMessageId.
 *  2. Find active conversation by (channel, customerChannelId) or start a new one.
 *  3. Normalize to a Message (OmniMessage), attach to the conversation (FR4/FR8).
 *  4. Save the conversation — domain events (MessageReceived/ConversationStarted)
 *     are written to the transactional outbox by the repository (FR7/NFR9).
 *  5. Return { conversationId, messageId }.
 *
 * 200-OK independence (NFR4): this handler only does a fast DB write + outbox;
 * downstream consumers (realtime push, Ticketing, CSAT) receive via the outbox→bus
 * asynchronously, so they never block webhook acknowledgement.
 */
@CommandHandler(ReceiveInboundMessageCommand)
export class ReceiveInboundMessageHandler
  implements ICommandHandler<ReceiveInboundMessageCommand, { conversationId: string; messageId: string }>
{
  private readonly logger = new Logger(ReceiveInboundMessageHandler.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY_TOKEN)
    private readonly conversationRepository: IConversationRepository,
    private readonly idempotency: IdempotencyService,
    @Optional()
    @Inject(REQUEST_CONTEXT_TOKEN)
    private readonly requestContext?: IRequestContextProvider,
  ) {}

  async execute(
    command: ReceiveInboundMessageCommand,
  ): Promise<{ conversationId: string; messageId: string }> {
    // 0. Trace metadata (F.3 — correlationId flows into events)
    const ctx = this.requestContext?.current();
    const metadata = ctx
      ? { correlationId: ctx.correlationId, causationId: ctx.causationId, userId: ctx.userId }
      : undefined;

    // 1. Idempotency (FR3) — dedup on channel + externalMessageId
    const idempotencyKey = `${command.channel}:${command.externalMessageId}`;
    const existing = await this.idempotency.getExisting<{ conversationId: string; messageId: string }>(
      idempotencyKey,
    );
    if (existing) {
      this.logger.debug(`Idempotency HIT — dropping duplicate inbound: ${idempotencyKey}`);
      return existing.result;
    }

    // 2. Find active conversation or prepare a new one
    const channel = Channel.create(command.channel);
    const existingConversation =
      await this.conversationRepository.findActiveByCustomerChannel(
        channel.value,
        command.customerChannelId,
      );
    const conversationId = existingConversation?.id ?? randomUUID();

    // 3. Normalize to OmniMessage (FR4)
    const message = Message.create({
      id: randomUUID(),
      conversationId,
      channel,
      direction: MessageDirection.INBOUND,
      senderType: SenderType.CUSTOMER,
      content: command.content ?? '',
      externalId: command.externalMessageId,
      attachments: command.attachments,
    });

    // 4. Attach to conversation or start a new one — aggregate enqueues domain events
    let conversation = existingConversation;
    if (conversation) {
      conversation.receiveMessage(message, metadata); // MessageReceived enqueued
    } else {
      // Conversation.create enqueues ConversationStarted + MessageReceived
      conversation = Conversation.create(
        conversationId,
        { customerChannelId: command.customerChannelId, channel, firstMessage: message },
        metadata,
      );
    }

    // 5. Optimistic idempotency: store BEFORE save to close the race window.
    //    If save fails, rollback the idempotency entry so retry can re-process.
    const result = { conversationId, messageId: message.id };
    await this.idempotency.store(idempotencyKey, result, 'ReceiveInboundMessage');

    try {
      // Save (repo writes aggregate + events to outbox in one tx — FR7/NFR9)
      await this.conversationRepository.save(conversation);
    } catch (err) {
      // Rollback idempotency on save failure — allow retry to re-process
      await this.idempotency.remove(idempotencyKey);
      throw err;
    }

    this.logger.log(
      `Inbound ingested: conversation=${conversationId} message=${message.id} channel=${command.channel}`,
    );
    return result;
  }
}
