import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetLeakageAlertsQuery, GetLeakageAlertsResult } from '../get-leakage-alerts.query';
import type { LeakageAlertsResponse } from '../../dtos/leakage-alert.dto';

@QueryHandler(GetLeakageAlertsQuery)
export class GetLeakageAlertsHandler implements IQueryHandler<GetLeakageAlertsQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetLeakageAlertsQuery): Promise<GetLeakageAlertsResult> {
    const r = await this.portRegistry.execute<LeakageAlertsResponse>(
      'leakage-alert',
      'get-leakage-alerts',
      { customerId: query.customerId },
    );
    if (!r?.data) throw new PortFallbackException('leakage-alert');
    return r.data;
  }
}
