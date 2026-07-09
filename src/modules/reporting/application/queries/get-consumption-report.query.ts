import { IQuery } from '@core/application';
import type { ConsumptionReport } from '../dtos/reporting.dto';

export class GetConsumptionReportQuery extends IQuery<ConsumptionReport> {
  constructor(
    public readonly customerId: string,
    public readonly period: string,
  ) {
    super();
  }
}
export type GetConsumptionReportResult = ConsumptionReport;
