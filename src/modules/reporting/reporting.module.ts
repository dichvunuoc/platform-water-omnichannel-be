import { Module, OnModuleInit } from '@nestjs/common';
import { ReportingController } from './infrastructure/http/reporting.controller';
import { MockReportingAdapter } from './infrastructure/ports/reporting.port';
import { REPORTING_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetConsumptionReportHandler } from './application/queries/handlers/get-consumption-report.handler';
import { GetComparisonReportHandler } from './application/queries/handlers/get-comparison-report.handler';
import { GetSavingsTipsHandler } from './application/queries/handlers/get-savings-tips.handler';
import { DownloadReportHandler } from './application/commands/handlers/download-report.handler';

@Module({
  controllers: [ReportingController],
  providers: [
    MockReportingAdapter,
    { provide: REPORTING_PORT_TOKEN, useExisting: MockReportingAdapter },
    GetConsumptionReportHandler,
    GetComparisonReportHandler,
    GetSavingsTipsHandler,
    DownloadReportHandler,
  ],
  exports: [REPORTING_PORT_TOKEN],
})
export class ReportingModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockReportingAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register('reporting', this.mockAdapter, this.mockAdapter);
  }
}
