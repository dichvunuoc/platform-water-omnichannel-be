import type { TicketPriorityEnum } from '../../domain';

export class CreateTicketCommand {
  constructor(
    public readonly conversationId: string | null,
    public readonly customerId: string | null,
    public readonly channel: string,
    public readonly title: string,
    public readonly description: string,
    public readonly priority: TicketPriorityEnum,
  ) {}
}
