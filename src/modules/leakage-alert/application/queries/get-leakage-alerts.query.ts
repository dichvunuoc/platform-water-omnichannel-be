import { IQuery } from '@core/application';
import type { LeakageAlertsResponse } from '../dtos/leakage-alert.dto';

export class GetLeakageAlertsQuery extends IQuery<LeakageAlertsResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}
export type GetLeakageAlertsResult = LeakageAlertsResponse;
