/**
 * Get Active Alerts Handler (AC#1)
 *
 * Reads active alerts for customer's area via PortRegistry → proactive-notification port.
 * cacheTier: dynamic — cached 5-15 min.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetActiveAlertsQuery } from '../get-active-alerts.query';
import type { GetActiveAlertsResponse } from '../../dtos/proactive-notification.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

@QueryHandler(GetActiveAlertsQuery)
export class GetActiveAlertsHandler implements IQueryHandler<GetActiveAlertsQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetActiveAlertsQuery): Promise<GetActiveAlertsResponse> {
    const result = await this.portRegistry.execute<GetActiveAlertsResponse>(
      'proactive-notification',
      'get-active-alerts',
      { customerId: query.customerId },
    );

    if (!result?.data) {
      throw new PortFallbackException('proactive-notification');
    }

    return result.data;
  }
}
