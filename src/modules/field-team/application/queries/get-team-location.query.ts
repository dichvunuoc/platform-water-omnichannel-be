import { IQuery } from '@core/application';
import type { TeamLocation } from '../dtos/field-team.dto';

export class GetTeamLocationQuery extends IQuery<TeamLocation> {
  constructor(public readonly ticketId: string) {
    super();
  }
}
export type GetTeamLocationResult = TeamLocation;
