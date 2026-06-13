/**
 * Get Notification History Query (AC#3 — FR57)
 *
 * Returns paginated notification history via PortRegistry → notification port.
 * cacheTier: dynamic — 300s TTL.
 */

import { IQuery } from '@core/application';
import type { NotificationHistoryQuery, NotificationHistoryResponse } from '../dtos/notification-preferences.dto';

export class GetNotificationHistoryQuery extends IQuery<NotificationHistoryResponse> {
  constructor(
    public readonly customerId: string,
    public readonly filters: NotificationHistoryQuery,
  ) {
    super();
  }
}

export type GetNotificationHistoryResult = NotificationHistoryResponse;
