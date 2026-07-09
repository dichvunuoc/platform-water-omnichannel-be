import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetLeakageDetailQuery, GetLeakageDetailResult } from '../get-leakage-detail.query';
import type { LeakageDetail } from '../../dtos/leakage-alert.dto';

@QueryHandler(GetLeakageDetailQuery)
export class GetLeakageDetailHandler implements IQueryHandler<GetLeakageDetailQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetLeakageDetailQuery): Promise<GetLeakageDetailResult> {
    const r = await this.portRegistry.execute<LeakageDetail>('leakage-alert', 'get-leakage-detail', {
      alertId: query.alertId,
    });
    if (!r?.data) throw new PortFallbackException('leakage-alert');
    return r.data;
  }
}
