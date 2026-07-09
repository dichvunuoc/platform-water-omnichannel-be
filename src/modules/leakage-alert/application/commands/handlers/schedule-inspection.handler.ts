import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { ScheduleInspectionCommand, ScheduleInspectionResultType } from '../schedule-inspection.command';
import type { ScheduleInspectionResult } from '../../dtos/leakage-alert.dto';

@CommandHandler(ScheduleInspectionCommand)
export class ScheduleInspectionHandler implements ICommandHandler<ScheduleInspectionCommand> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: ScheduleInspectionCommand): Promise<ScheduleInspectionResultType> {
    const result = await this.portRegistry.execute<ScheduleInspectionResult>(
      'leakage-alert',
      'schedule-inspection',
      { alertId: command.alertId, customerId: command.customerId, preferredSlot: command.preferredSlot, useCache: false },
    );
    if (!result?.data) throw new PortFallbackException('leakage-alert');
    return result.data;
  }
}
