import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetAnomalyAlertsQuery, GetAnomalyAlertsResult } from '../get-anomaly-alerts.query';
import type { AnomalyAlertsResponse } from '../../dtos/meter-anomaly.dto';

@QueryHandler(GetAnomalyAlertsQuery)
export class GetAnomalyAlertsHandler implements IQueryHandler<GetAnomalyAlertsQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetAnomalyAlertsQuery): Promise<GetAnomalyAlertsResult> {
    const r = await this.portRegistry.execute<AnomalyAlertsResponse>(
      'meter-anomaly',
      'get-anomaly-alerts',
      { customerId: query.customerId },
    );
    if (!r?.data) throw new PortFallbackException('meter-anomaly');
    return r.data;
  }
}
