import { IQuery } from '@core/application';
import type { AnomalyAlertsResponse } from '../dtos/meter-anomaly.dto';

export class GetAnomalyAlertsQuery extends IQuery<AnomalyAlertsResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}
export type GetAnomalyAlertsResult = AnomalyAlertsResponse;
