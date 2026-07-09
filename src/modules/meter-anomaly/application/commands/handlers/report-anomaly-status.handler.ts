import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { ReportAnomalyStatusCommand, ReportAnomalyStatusResultType } from '../report-anomaly-status.command';
import type { ReportAnomalyStatusResult } from '../../dtos/meter-anomaly.dto';

@CommandHandler(ReportAnomalyStatusCommand)
export class ReportAnomalyStatusHandler implements ICommandHandler<ReportAnomalyStatusCommand> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: ReportAnomalyStatusCommand): Promise<ReportAnomalyStatusResultType> {
    const result = await this.portRegistry.execute<ReportAnomalyStatusResult>(
      'meter-anomaly',
      'report-anomaly-status',
      { alertId: command.alertId, customerId: command.customerId, status: command.status, useCache: false },
    );
    if (!result?.data) throw new PortFallbackException('meter-anomaly');
    return result.data;
  }
}
