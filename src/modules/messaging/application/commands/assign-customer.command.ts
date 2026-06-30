/**
 * Assign Customer Command (FR31 — assign resolved customerId to a conversation).
 *
 * Triggered by identity resolution (Epic 2) or agent manual creation.
 */
export class AssignCustomerCommand {
  constructor(
    public readonly conversationId: string,
    public readonly customerId?: string,
    public readonly agentId?: string,
  ) {}
}
