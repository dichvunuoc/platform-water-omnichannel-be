/**
 * Get Alert History Handler (AC#2)
 *
 * Reads chronological alert history via PortRegistry → proactive-notification port.
 * cacheTier: dynamic — cached 5-15 min.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetAlertHistoryQuery } from '../get-alert-history.query';
import type { AlertHistoryResponse } from '../../dtos/proactive-notification.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

@QueryHandler(GetAlertHistoryQuery)
export class GetAlertHistoryHandler implements IQueryHandler<GetAlertHistoryQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetAlertHistoryQuery): Promise<AlertHistoryResponse> {
    const result = await this.portRegistry.execute<AlertHistoryResponse>(
      'proactive-notification',
      'get-alert-history',
      { customerId: query.customerId, ...query.filters },
    );

    if (!result?.data) {
      throw new PortFallbackException('proactive-notification');
    }

    return result.data;
  }
}
