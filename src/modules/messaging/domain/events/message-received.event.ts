import { BaseDomainEvent, type IEventMetadata } from 'src/libs/core/domain';
import { MessageDirection, SenderType } from '../entities/message.entity';
import { ChannelEnum } from '../value-objects/channel.value-object';

/**
 * MessageReceived Event Payload
 *
 * Emitted when a new (normalized) message lands in a conversation — the keystone
 * event of the ingestion spine. Consumed by: the realtime gateway (push to agent,
 * FR12/NFR1), the outbox publisher, and (later) the Ticketing/CX flows.
 */
export interface MessageReceivedPayload {
  conversationId: string;
  messageId: string;
  channel: ChannelEnum;
  direction: MessageDirection;
  senderType: SenderType;
  content: string;
  attachments: string[];
  externalId?: string;
  metadata?: IEventMetadata;
}

/**
 * MessageReceived Event
 *
 * Emitted by the Conversation aggregate on inbound (and outbound) messages.
 */
export class MessageReceivedEvent extends BaseDomainEvent<MessageReceivedPayload> {
  constructor(payload: MessageReceivedPayload) {
    super(
      payload.conversationId,
      'Conversation',
      'MessageReceived',
      payload,
      payload.metadata,
    );
  }

  get conversationId(): string {
    return this.data.conversationId;
  }
  get messageId(): string {
    return this.data.messageId;
  }
  get channel(): ChannelEnum {
    return this.data.channel;
  }
  get isInbound(): boolean {
    return this.data.direction === MessageDirection.INBOUND;
  }
}
