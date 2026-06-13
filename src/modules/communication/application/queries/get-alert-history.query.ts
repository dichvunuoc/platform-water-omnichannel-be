/**
 * Get Alert History Query (AC#2)
 *
 * Returns chronological alert history via PortRegistry → proactive-notification port.
 * cacheTier: dynamic — cached 5-15 min.
 */

import { IQuery } from '@core/application';
import type { AlertHistoryResponse, AlertHistoryQuery } from '../dtos/proactive-notification.dto';

export class GetAlertHistoryQuery extends IQuery<AlertHistoryResponse> {
  constructor(
    public readonly customerId: string,
    public readonly filters?: Partial<AlertHistoryQuery>,
  ) {
    super();
  }
}

export type GetAlertHistoryResult = AlertHistoryResponse;
