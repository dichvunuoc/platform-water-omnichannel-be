import { ICommand } from '@core/application';
import type { ScheduleInspectionResult } from '../dtos/leakage-alert.dto';

export class ScheduleInspectionCommand implements ICommand {
  constructor(
    public readonly alertId: string,
    public readonly customerId: string,
    public readonly preferredSlot?: string,
  ) {}
}
export type ScheduleInspectionResultType = ScheduleInspectionResult;
