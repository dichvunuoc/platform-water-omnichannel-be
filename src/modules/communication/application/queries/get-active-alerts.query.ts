/**
 * Get Active Alerts Query (AC#1)
 *
 * Returns active alerts for customer's area via PortRegistry → proactive-notification port.
 * cacheTier: dynamic — cached 5-15 min.
 */

import { IQuery } from '@core/application';
import type { GetActiveAlertsResponse } from '../dtos/proactive-notification.dto';

export class GetActiveAlertsQuery extends IQuery<GetActiveAlertsResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}

export type GetActiveAlertsResult = GetActiveAlertsResponse;
