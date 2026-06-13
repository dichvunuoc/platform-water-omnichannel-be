/**
 * Get Notification Preferences Handler (AC#1 — FR56)
 *
 * Reads customer notification preferences via PortRegistry → notification port.
 * cacheTier: dynamic — 300s TTL.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetNotificationPreferencesQuery } from '../get-notification-preferences.query';
import type { NotificationPreferencesResponse } from '../../dtos/notification-preferences.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

@QueryHandler(GetNotificationPreferencesQuery)
export class GetNotificationPreferencesHandler implements IQueryHandler<GetNotificationPreferencesQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetNotificationPreferencesQuery): Promise<NotificationPreferencesResponse> {
    const result = await this.portRegistry.execute<NotificationPreferencesResponse>(
      'notification',
      'get-notification-preferences',
      { customerId: query.customerId },
    );

    if (!result?.data) {
      throw new PortFallbackException('notification');
    }

    return result.data;
  }
}
