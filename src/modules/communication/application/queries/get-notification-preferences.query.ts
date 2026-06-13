/**
 * Get Notification Preferences Query (AC#1 — FR56)
 *
 * Returns customer notification preferences via PortRegistry → notification port.
 * cacheTier: dynamic — 300s TTL.
 */

import { IQuery } from '@core/application';
import type { NotificationPreferencesResponse } from '../dtos/notification-preferences.dto';

export class GetNotificationPreferencesQuery extends IQuery<NotificationPreferencesResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}

export type GetNotificationPreferencesResult = NotificationPreferencesResponse;
