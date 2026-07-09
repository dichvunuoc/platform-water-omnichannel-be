import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetConsumptionReportQuery, GetConsumptionReportResult } from '../get-consumption-report.query';
import type { ConsumptionReport } from '../../dtos/reporting.dto';

@QueryHandler(GetConsumptionReportQuery)
export class GetConsumptionReportHandler implements IQueryHandler<GetConsumptionReportQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetConsumptionReportQuery): Promise<GetConsumptionReportResult> {
    const result: PortResult<ConsumptionReport> =
      await this.portRegistry.execute<ConsumptionReport>('reporting', 'get-consumption-report', {
        customerId: query.customerId,
        period: query.period,
      });
    if (!result?.data) throw new PortFallbackException('reporting');
    return result.data;
  }
}
