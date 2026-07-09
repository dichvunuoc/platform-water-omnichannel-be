import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetLeakageAlertsQuery } from '../../application/queries/get-leakage-alerts.query';
import { GetLeakageDetailQuery } from '../../application/queries/get-leakage-detail.query';

@ApiTags('Leakage Alert')
@ApiBearerAuth('JWT-auth')
@Controller('leakage-alerts')
export class LeakageAlertController {
  constructor(@Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus) {}

  @Get()
  async alerts(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetLeakageAlertsQuery(userId));
  }

  @Get(':alertId')
  async detail(@Param('alertId') alertId: string) {
    return this.queryBus.execute(new GetLeakageDetailQuery(alertId));
  }
}
