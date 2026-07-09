import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetCutoffStatusQuery } from '../../application/queries/get-cutoff-status.query';
import { GetCutoffScheduleQuery } from '../../application/queries/get-cutoff-schedule.query';

@ApiTags('Water Cutoff')
@ApiBearerAuth('JWT-auth')
@Controller('water-cutoff')
export class WaterCutoffController {
  constructor(@Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus) {}

  @Get('status')
  async status(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetCutoffStatusQuery(userId));
  }

  @Get('schedule/:areaId')
  async schedule(@Param('areaId') areaId: string) {
    return this.queryBus.execute(new GetCutoffScheduleQuery(areaId));
  }
}
