import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetQualityAtLocationQuery, GetQualityAtLocationResult } from '../get-quality-at-location.query';
import type { QualityAtLocation } from '../../dtos/water-quality.dto';

@QueryHandler(GetQualityAtLocationQuery)
export class GetQualityAtLocationHandler implements IQueryHandler<GetQualityAtLocationQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetQualityAtLocationQuery): Promise<GetQualityAtLocationResult> {
    const r = await this.portRegistry.execute<QualityAtLocation>(
      'water-quality',
      'get-quality-at-location',
      { location: query.location },
    );
    if (!r?.data) throw new PortFallbackException('water-quality');
    return r.data;
  }
}
