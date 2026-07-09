import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetQualityAlertsQuery, GetQualityAlertsResult } from '../get-quality-alerts.query';
import type { QualityAlertsResponse } from '../../dtos/water-quality.dto';

@QueryHandler(GetQualityAlertsQuery)
export class GetQualityAlertsHandler implements IQueryHandler<GetQualityAlertsQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetQualityAlertsQuery): Promise<GetQualityAlertsResult> {
    const r = await this.portRegistry.execute<QualityAlertsResponse>(
      'water-quality',
      'get-quality-alerts',
      query.area ? { area: query.area } : {},
    );
    if (!r?.data) throw new PortFallbackException('water-quality');
    return r.data;
  }
}
