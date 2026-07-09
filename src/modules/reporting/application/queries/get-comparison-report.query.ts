import { IQuery } from '@core/application';
import type { ComparisonReport } from '../dtos/reporting.dto';

export class GetComparisonReportQuery extends IQuery<ComparisonReport> {
  constructor(
    public readonly customerId: string,
    public readonly comparisonType: 'previous_period' | 'same_period_last_year' | 'area_average',
  ) {
    super();
  }
}
export type GetComparisonReportResult = ComparisonReport;
