import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetTeamLocationQuery, GetTeamLocationResult } from '../get-team-location.query';
import type { TeamLocation } from '../../dtos/field-team.dto';

@QueryHandler(GetTeamLocationQuery)
export class GetTeamLocationHandler implements IQueryHandler<GetTeamLocationQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetTeamLocationQuery): Promise<GetTeamLocationResult> {
    const r = await this.portRegistry.execute<TeamLocation>('field-team', 'get-team-location', {
      ticketId: query.ticketId,
    });
    if (!r?.data) throw new PortFallbackException('field-team');
    return r.data;
  }
}
