import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetAnomalyAlertsQuery } from '../../application/queries/get-anomaly-alerts.query';
import { GetAnomalyDetailQuery } from '../../application/queries/get-anomaly-detail.query';

@ApiTags('Meter Anomaly')
@ApiBearerAuth('JWT-auth')
@Controller('meter-anomalies')
export class MeterAnomalyController {
  constructor(@Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus) {}

  @Get()
  async alerts(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetAnomalyAlertsQuery(userId));
  }

  @Get(':alertId')
  async detail(@Param('alertId') alertId: string) {
    return this.queryBus.execute(new GetAnomalyDetailQuery(alertId));
  }
}
