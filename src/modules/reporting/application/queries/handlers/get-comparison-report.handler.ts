import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetComparisonReportQuery, GetComparisonReportResult } from '../get-comparison-report.query';
import type { ComparisonReport } from '../../dtos/reporting.dto';

@QueryHandler(GetComparisonReportQuery)
export class GetComparisonReportHandler implements IQueryHandler<GetComparisonReportQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetComparisonReportQuery): Promise<GetComparisonReportResult> {
    const result: PortResult<ComparisonReport> =
      await this.portRegistry.execute<ComparisonReport>('reporting', 'get-comparison-report', {
        customerId: query.customerId,
        comparisonType: query.comparisonType,
      });
    if (!result?.data) throw new PortFallbackException('reporting');
    return result.data;
  }
}
