import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { GetTeamEtaQuery } from '../../application/queries/get-team-eta.query';
import { GetTeamLocationQuery } from '../../application/queries/get-team-location.query';

@ApiTags('Field Team')
@ApiBearerAuth('JWT-auth')
@Controller('field-team')
export class FieldTeamController {
  constructor(@Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus) {}

  @Get(':ticketId/eta')
  async eta(@Param('ticketId') ticketId: string) {
    return this.queryBus.execute(new GetTeamEtaQuery(ticketId));
  }

  @Get(':ticketId/location')
  async location(@Param('ticketId') ticketId: string) {
    return this.queryBus.execute(new GetTeamLocationQuery(ticketId));
  }
}
