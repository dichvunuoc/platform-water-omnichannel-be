import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { GetQualityAtLocationQuery } from '../../application/queries/get-quality-at-location.query';
import { GetQualityAlertsQuery } from '../../application/queries/get-quality-alerts.query';

@ApiTags('Water Quality')
@ApiBearerAuth('JWT-auth')
@Controller('water-quality')
export class WaterQualityController {
  constructor(@Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus) {}

  @Get('location')
  async atLocation(@Query('location') location: string) {
    return this.queryBus.execute(new GetQualityAtLocationQuery(location));
  }

  @Get('alerts')
  async alerts(@Query('area') area?: string) {
    return this.queryBus.execute(new GetQualityAlertsQuery(area));
  }
}
