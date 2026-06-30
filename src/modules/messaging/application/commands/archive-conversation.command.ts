/**
 * Archive Conversation Command (FR18 — archive, distinct from close + ticket resolution).
 */
export class ArchiveConversationCommand {
  constructor(
    public readonly conversationId: string,
    public readonly agentId: string,
  ) {}
}
