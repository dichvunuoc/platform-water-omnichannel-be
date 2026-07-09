import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { ICommandBus, IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetAnomalyAlertsQuery } from '../../application/queries/get-anomaly-alerts.query';
import { GetAnomalyDetailQuery } from '../../application/queries/get-anomaly-detail.query';
import { ReportAnomalyStatusCommand } from '../../application/commands/report-anomaly-status.command';

@ApiTags('Meter Anomaly')
@ApiBearerAuth('JWT-auth')
@Controller('meter-anomalies')
export class MeterAnomalyController {
  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  @Get()
  async alerts(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetAnomalyAlertsQuery(userId));
  }

  @Get(':alertId')
  async detail(@Param('alertId') alertId: string) {
    return this.queryBus.execute(new GetAnomalyDetailQuery(alertId));
  }

  @Post(':alertId/status')
  async reportStatus(
    @CurrentUser('id') userId: string,
    @Param('alertId') alertId: string,
    @Body() body: { status: 'acknowledged' | 'false_alarm' | 'resolved' },
  ) {
    return this.commandBus.execute(
      new ReportAnomalyStatusCommand(alertId, userId, body.status),
    );
  }
}
