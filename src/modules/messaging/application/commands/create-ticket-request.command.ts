import type { TicketPriority } from '../../domain/contracts';

/**
 * Create Ticket Request Command (FR19 — OmniCare side only).
 *
 * Requests ticket creation from the Ticketing service via the broker/HTTP.
 * Does NOT create the ticket itself (FR21-23 = Ticketing service [TKT-SVC]).
 */
export class CreateTicketRequestCommand {
  constructor(
    public readonly conversationId: string,
    public readonly priority?: TicketPriority,
    public readonly title?: string,
    public readonly description?: string,
    public readonly fastForwardSla?: boolean,
  ) {}
}
