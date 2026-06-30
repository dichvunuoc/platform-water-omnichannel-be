import { AggregateRoot, DomainException, type IEventMetadata } from 'src/libs/core/domain';
import { Channel } from '../value-objects/channel.value-object';
import { Message, MessageDirection, SenderType } from './message.entity';
import { MessageReceivedEvent } from '../events/message-received.event';
import { ConversationStartedEvent } from '../events/conversation-started.event';

/**
 * Conversation lifecycle (FR18 — close/archive distinct from ticket resolution).
 */
export enum ConversationStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

/**
 * Create Conversation Props
 */
export interface CreateConversationProps {
  /** Raw channel-side customer id (e.g. zalo_user_id, phone) — pre identity resolution. */
  customerChannelId: string;
  /** Primary channel of the conversation. */
  channel: Channel;
  /** First inbound message (if any) that started this conversation. */
  firstMessage?: Message;
}

/**
 * Conversation Aggregate Root
 *
 * The unified inbox thread — one per customer per channel-context. Holds
 * normalized Messages (OmniMessage) and is the consistency boundary for the
 * messaging domain. Only the Conversation can emit messaging domain events.
 *
 * NOTE: `customerId` (the resolved GlobalCustomerID) is set later by the
 * identity-resolution flow (Epic 2); until then the conversation is keyed by
 * `customerChannelId` + channel.
 */
export class Conversation extends AggregateRoot {
  private _customerChannelId: string;
  private _channel: Channel;
  private _customerId: string | null = null; // resolved later (Epic 2)
  private _ticketId: string | null = null; // linked ticket (Epic 3 — FR19)
  private _messages: Message[] = [];
  private _status: ConversationStatus = ConversationStatus.ACTIVE;

  private constructor(
    id: string,
    version?: number,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, version, createdAt, updatedAt);
  }

  /**
   * Factory: start a new conversation (optionally with the first inbound message).
   */
  static create(
    id: string,
    props: CreateConversationProps,
    metadata?: IEventMetadata,
  ): Conversation {
    if (!props.customerChannelId) {
      throw new DomainException(
        'customerChannelId is required',
        'CUSTOMER_CHANNEL_ID_REQUIRED',
      );
    }

    const conversation = new Conversation(id);
    conversation._customerChannelId = props.customerChannelId;
    conversation._channel = props.channel;

    if (props.firstMessage) {
      conversation._messages.push(props.firstMessage);
    }

    conversation.addDomainEvent(
      new ConversationStartedEvent({
        conversationId: conversation.id,
        customerChannelId: conversation._customerChannelId,
        channel: conversation._channel.value,
        metadata,
      }),
    );

    if (props.firstMessage) {
      conversation.emitMessageReceived(props.firstMessage, metadata);
    }

    return conversation;
  }

  /**
   * Reconstitute from persistence.
   */
  static reconstitute(
    id: string,
    customerChannelId: string,
    channel: Channel,
    customerId: string | null,
    messages: Message[],
    status: ConversationStatus,
    version: number,
    createdAt: Date,
    updatedAt: Date,
    ticketId: string | null = null,
  ): Conversation {
    const conversation = new Conversation(id, version, createdAt, updatedAt);
    conversation._customerChannelId = customerChannelId;
    conversation._channel = channel;
    conversation._customerId = customerId;
    conversation._messages = messages;
    conversation._status = status;
    conversation._ticketId = ticketId;
    return conversation;
  }

  // --- Behavior ---

  /**
   * Receive a new inbound message into the thread (FR1/FR8).
   */
  receiveMessage(message: Message, metadata?: IEventMetadata): void {
    if (this._status !== ConversationStatus.ACTIVE) {
      throw new DomainException(
        `Cannot receive message: conversation is ${this._status}`,
        'CONVERSATION_NOT_ACTIVE',
      );
    }
    this._messages.push(message);
    this.emitMessageReceived(message, metadata);
  }

  /**
   * Resolve the customer identity (Epic 2 sets the GlobalCustomerID).
   */
  assignCustomer(customerId: string): void {
    if (!customerId) {
      throw new DomainException('customerId is required', 'CUSTOMER_ID_REQUIRED');
    }
    this._customerId = customerId;
    this.markAsModified(); // increment version for OCC
  }

  /**
   * Link a ticket to this conversation (FR19 — Epic 3).
   * One-to-one for MVP: a conversation can spawn one ticket.
   */
  linkTicket(ticketId: string): void {
    if (!ticketId) {
      throw new DomainException('ticketId is required', 'TICKET_ID_REQUIRED');
    }
    if (this._ticketId) {
      // Already linked — idempotent (don't overwrite)
      return;
    }
    this._ticketId = ticketId;
    this.markAsModified(); // increment version for OCC
  }

  /**
   * Close the conversation (FR18 — distinct from ticket resolution).
   */
  close(): void {
    if (this._status !== ConversationStatus.ACTIVE) {
      throw new DomainException(
        `Cannot close conversation in ${this._status}`,
        'INVALID_CONVERSATION_OPERATION',
      );
    }
    this._status = ConversationStatus.CLOSED;
    this.markAsModified(); // increment version for OCC
  }

  archive(): void {
    if (this._status !== ConversationStatus.CLOSED) {
      throw new DomainException(
        `Cannot archive conversation in ${this._status} — must be CLOSED first`,
        'INVALID_CONVERSATION_OPERATION',
      );
    }
    this._status = ConversationStatus.ARCHIVED;
    this.markAsModified(); // increment version for OCC
  }

  // --- Helpers ---

  private emitMessageReceived(message: Message, metadata?: IEventMetadata): void {
    this.addDomainEvent(
      new MessageReceivedEvent({
        conversationId: this.id,
        messageId: message.id,
        channel: message.channel.value,
        direction: message.direction,
        senderType: message.senderType,
        content: message.content,
        attachments: [...message.attachments],
        externalId: message.externalId,
        metadata,
      }),
    );
  }

  // --- Getters ---

  get customerChannelId(): string {
    return this._customerChannelId;
  }
  get channel(): Channel {
    return this._channel;
  }
  get customerId(): string | null {
    return this._customerId;
  }
  get ticketId(): string | null {
    return this._ticketId;
  }
  get messages(): readonly Message[] {
    return [...this._messages];
  }
  get status(): ConversationStatus {
    return this._status;
  }
  get isActive(): boolean {
    return this._status === ConversationStatus.ACTIVE;
  }
  get lastMessage(): Message | undefined {
    return this._messages[this._messages.length - 1];
  }
}

// Re-export enums for convenience
export { MessageDirection, SenderType };
