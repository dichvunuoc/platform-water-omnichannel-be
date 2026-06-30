import { IsIn } from 'class-validator';
import type { TicketStageEnum } from '../../domain';

export class AdvanceStageDto {
  @IsIn(['RECEIVED', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'])
  newStage!: TicketStageEnum;
}
