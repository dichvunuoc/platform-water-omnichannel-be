/**
 * Send Reply Command
 *
 * Agent replies to a customer on the conversation's origin channel (FR5/FR11).
 */
export class SendReplyCommand {
  constructor(
    public readonly conversationId: string,
    public readonly agentId: string,
    public readonly content: string,
    public readonly attachments: string[] = [],
  ) {}
}
