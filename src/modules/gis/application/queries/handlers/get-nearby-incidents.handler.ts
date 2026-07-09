import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetNearbyIncidentsQuery, GetNearbyIncidentsResult } from '../get-nearby-incidents.query';
import type { GetNearbyIncidentsResponse } from '../../dtos/gis.dto';

@QueryHandler(GetNearbyIncidentsQuery)
export class GetNearbyIncidentsHandler implements IQueryHandler<GetNearbyIncidentsQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetNearbyIncidentsQuery): Promise<GetNearbyIncidentsResult> {
    const result = await this.portRegistry.execute<GetNearbyIncidentsResponse>(
      'gis',
      'get-nearby-incidents',
      { latitude: query.latitude, longitude: query.longitude, radiusMeters: query.radiusMeters },
    );
    if (!result?.data) throw new PortFallbackException('gis');
    return result.data;
  }
}
