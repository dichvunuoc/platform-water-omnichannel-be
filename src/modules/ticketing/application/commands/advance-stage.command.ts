import type { TicketStageEnum } from '../../domain';

export class AdvanceStageCommand {
  constructor(
    public readonly ticketId: string,
    public readonly newStage: TicketStageEnum,
  ) {}
}
