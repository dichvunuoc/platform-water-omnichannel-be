import { IQuery } from '@core/application';
import type { TeamEta } from '../dtos/field-team.dto';

export class GetTeamEtaQuery extends IQuery<TeamEta> {
  constructor(public readonly ticketId: string) {
    super();
  }
}
export type GetTeamEtaResult = TeamEta;
