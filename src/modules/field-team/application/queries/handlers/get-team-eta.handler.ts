import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetTeamEtaQuery, GetTeamEtaResult } from '../get-team-eta.query';
import type { TeamEta } from '../../dtos/field-team.dto';

@QueryHandler(GetTeamEtaQuery)
export class GetTeamEtaHandler implements IQueryHandler<GetTeamEtaQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetTeamEtaQuery): Promise<GetTeamEtaResult> {
    const r = await this.portRegistry.execute<TeamEta>('field-team', 'get-team-eta', {
      ticketId: query.ticketId,
    });
    if (!r?.data) throw new PortFallbackException('field-team');
    return r.data;
  }
}
