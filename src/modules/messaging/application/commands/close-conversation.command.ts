/**
 * Close Conversation Command (FR18 — close, distinct from ticket resolution).
 */
export class CloseConversationCommand {
  constructor(
    public readonly conversationId: string,
    public readonly agentId: string,
  ) {}
}
