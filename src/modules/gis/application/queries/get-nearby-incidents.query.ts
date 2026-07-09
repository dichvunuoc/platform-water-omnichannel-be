import { IQuery } from '@core/application';
import type { GetNearbyIncidentsResponse } from '../dtos/gis.dto';

export class GetNearbyIncidentsQuery extends IQuery<GetNearbyIncidentsResponse> {
  constructor(
    public readonly latitude: number,
    public readonly longitude: number,
    public readonly radiusMeters = 2000,
  ) {
    super();
  }
}
export type GetNearbyIncidentsResult = GetNearbyIncidentsResponse;
