import { BaseEntity, DomainException } from 'src/libs/core/domain';
import { Channel } from '../value-objects/channel.value-object';

/**
 * Message direction.
 */
export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

/**
 * Who sent the message.
 */
export enum SenderType {
  CUSTOMER = 'CUSTOMER',
  AGENT = 'AGENT',
  BOT = 'BOT',
  SYSTEM = 'SYSTEM',
}

/**
 * Message Props (for create)
 */
export interface CreateMessageProps {
  id: string;
  conversationId: string;
  channel: Channel;
  direction: MessageDirection;
  senderType: SenderType;
  content: string;
  /** Channel-side message id — used for idempotency / dedup (FR3). */
  externalId?: string;
  /** Attachment refs (photo URLs, recording refs, etc.). */
  attachments?: string[];
}

/**
 * Message Entity (child of Conversation aggregate)
 *
 * This IS the normalized `OmniMessage` — channel-agnostic, the single
 * internal format every channel's payload is normalized into (FR4).
 * Child entity: only accessible through its Conversation (cannot emit events).
 */
export class Message extends BaseEntity {
  private _conversationId: string;
  private _channel: Channel;
  private _direction: MessageDirection;
  private _senderType: SenderType;
  private _content: string;
  private _externalId?: string;
  private _attachments: string[];

  private constructor(
    id: string,
    conversationId: string,
    channel: Channel,
    direction: MessageDirection,
    senderType: SenderType,
    content: string,
    externalId: string | undefined,
    attachments: string[],
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
    this._conversationId = conversationId;
    this._channel = channel;
    this._direction = direction;
    this._senderType = senderType;
    this._content = content;
    this._externalId = externalId;
    this._attachments = attachments;
  }

  static create(props: CreateMessageProps): Message {
    if (!props.conversationId) {
      throw new DomainException('Conversation ID is required', 'CONVERSATION_ID_REQUIRED');
    }
    if (!props.content || props.content.trim().length === 0) {
      // Voice/call events may carry empty text (metadata-only); allow only for INBOUND voice.
      if (!(props.channel.isVoice && props.direction === MessageDirection.INBOUND)) {
        throw new DomainException('Message content is required', 'MESSAGE_CONTENT_REQUIRED');
      }
    }
    return new Message(
      props.id,
      props.conversationId,
      props.channel,
      props.direction,
      props.senderType,
      props.content,
      props.externalId,
      props.attachments ?? [],
    );
  }

  static reconstitute(
    id: string,
    conversationId: string,
    channel: Channel,
    direction: MessageDirection,
    senderType: SenderType,
    content: string,
    externalId: string | undefined,
    attachments: string[],
    createdAt: Date,
    updatedAt: Date,
  ): Message {
    return new Message(
      id,
      conversationId,
      channel,
      direction,
      senderType,
      content,
      externalId,
      attachments,
      createdAt,
      updatedAt,
    );
  }

  get conversationId(): string {
    return this._conversationId;
  }
  get channel(): Channel {
    return this._channel;
  }
  get direction(): MessageDirection {
    return this._direction;
  }
  get senderType(): SenderType {
    return this._senderType;
  }
  get content(): string {
    return this._content;
  }
  get externalId(): string | undefined {
    return this._externalId;
  }
  get attachments(): readonly string[] {
    return [...this._attachments];
  }
  get isInbound(): boolean {
    return this._direction === MessageDirection.INBOUND;
  }
}
