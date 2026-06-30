import { BaseDomainEvent, type IEventMetadata } from 'src/libs/core/domain';
import { ChannelEnum } from '../value-objects/channel.value-object';

/**
 * ConversationStarted Event Payload
 */
export interface ConversationStartedPayload {
  conversationId: string;
  customerChannelId: string;
  channel: ChannelEnum;
  metadata?: IEventMetadata;
}

/**
 * ConversationStarted Event
 *
 * Emitted when a new conversation is created — triggers identity-resolution
 * handoff (Epic 2: resolve customerChannelId → GlobalCustomerID) and inbox
 * read-model projection.
 */
export class ConversationStartedEvent extends BaseDomainEvent<ConversationStartedPayload> {
  constructor(payload: ConversationStartedPayload) {
    super(
      payload.conversationId,
      'Conversation',
      'ConversationStarted',
      payload,
      payload.metadata,
    );
  }

  get conversationId(): string {
    return this.data.conversationId;
  }
  get customerChannelId(): string {
    return this.data.customerChannelId;
  }
  get channel(): ChannelEnum {
    return this.data.channel;
  }
}
