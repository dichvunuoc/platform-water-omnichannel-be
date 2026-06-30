/**
 * Dispatch Work Order Command (FR62 — Epic 7).
 *
 * Agent confirms a field incident → backend dispatches a Work Order
 * to the Field-team App via the port (mock wave-1 → real wave-3).
 */
export class DispatchWorkOrderCommand {
  constructor(
    public readonly conversationId: string,
    public readonly agentId: string,
    public readonly incidentType: string,
    public readonly priority: string,
    public readonly address: string,
    public readonly photoUrls: string[] = [],
    public readonly customerId?: string,
  ) {}
}
