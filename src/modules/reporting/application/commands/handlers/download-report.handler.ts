import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { DownloadReportCommand, DownloadReportResultType } from '../download-report.command';
import type { DownloadReportResult } from '../../dtos/reporting.dto';

@CommandHandler(DownloadReportCommand)
export class DownloadReportHandler implements ICommandHandler<DownloadReportCommand> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: DownloadReportCommand): Promise<DownloadReportResultType> {
    const result = await this.portRegistry.execute<DownloadReportResult>(
      'reporting',
      'download-report',
      { customerId: command.customerId, period: command.period, format: command.format, useCache: false },
    );
    if (!result?.data) throw new PortFallbackException('reporting');
    return result.data;
  }
}
