import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetAnomalyDetailQuery, GetAnomalyDetailResult } from '../get-anomaly-detail.query';
import type { AnomalyDetail } from '../../dtos/meter-anomaly.dto';

@QueryHandler(GetAnomalyDetailQuery)
export class GetAnomalyDetailHandler implements IQueryHandler<GetAnomalyDetailQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetAnomalyDetailQuery): Promise<GetAnomalyDetailResult> {
    const r = await this.portRegistry.execute<AnomalyDetail>('meter-anomaly', 'get-anomaly-detail', {
      alertId: query.alertId,
    });
    if (!r?.data) throw new PortFallbackException('meter-anomaly');
    return r.data;
  }
}
