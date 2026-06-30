import { ChannelEnum } from '../../domain';

/**
 * Receive Inbound Message Command
 *
 * Ingest a normalized inbound message into a conversation (FR1/FR2/FR3/FR4/FR7/FR8).
 * Handler: idempotency check → find-or-create Conversation → receiveMessage → save
 * (events to outbox) → return ids.
 */
export class ReceiveInboundMessageCommand {
  constructor(
    public readonly channel: ChannelEnum,
    public readonly customerChannelId: string,
    public readonly externalMessageId: string,
    public readonly content: string,
    public readonly attachments: string[] = [],
  ) {}
}
