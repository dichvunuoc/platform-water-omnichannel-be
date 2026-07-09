import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetCutoffStatusQuery, GetCutoffStatusResult } from '../get-cutoff-status.query';
import type { CutoffStatus } from '../../dtos/water-cutoff.dto';

@QueryHandler(GetCutoffStatusQuery)
export class GetCutoffStatusHandler implements IQueryHandler<GetCutoffStatusQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetCutoffStatusQuery): Promise<GetCutoffStatusResult> {
    const r = await this.portRegistry.execute<CutoffStatus>('water-cutoff', 'get-cutoff-status', {
      customerId: query.customerId,
    });
    if (!r?.data) throw new PortFallbackException('water-cutoff');
    return r.data;
  }
}
