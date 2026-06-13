/**
 * Get Notification History Handler (AC#3 — FR57)
 *
 * Returns paginated notification history via PortRegistry → notification port.
 * Supports filters: date range, channel, type.
 * cacheTier: dynamic — 300s TTL.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetNotificationHistoryQuery } from '../get-notification-history.query';
import type { NotificationHistoryResponse } from '../../dtos/notification-preferences.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

@QueryHandler(GetNotificationHistoryQuery)
export class GetNotificationHistoryHandler implements IQueryHandler<GetNotificationHistoryQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetNotificationHistoryQuery): Promise<NotificationHistoryResponse> {
    const result = await this.portRegistry.execute<NotificationHistoryResponse>(
      'notification',
      'get-notification-history',
      {
        customerId: query.customerId,
        ...query.filters,
      },
    );

    if (!result?.data) {
      throw new PortFallbackException('notification');
    }

    return result.data;
  }
}
