import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { ICommandBus, IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetLeakageAlertsQuery } from '../../application/queries/get-leakage-alerts.query';
import { GetLeakageDetailQuery } from '../../application/queries/get-leakage-detail.query';
import { GetInspectionResultQuery } from '../../application/queries/get-inspection-result.query';
import { ScheduleInspectionCommand } from '../../application/commands/schedule-inspection.command';

@ApiTags('Leakage Alert')
@ApiBearerAuth('JWT-auth')
@Controller('leakage-alerts')
export class LeakageAlertController {
  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  @Get()
  async alerts(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetLeakageAlertsQuery(userId));
  }

  @Post(':alertId/inspection')
  async schedule(
    @CurrentUser('id') userId: string,
    @Param('alertId') alertId: string,
    @Body() body: { preferredSlot?: string },
  ) {
    return this.commandBus.execute(
      new ScheduleInspectionCommand(alertId, userId, body?.preferredSlot),
    );
  }

  @Get(':alertId/inspection/result')
  async inspectionResult(@Param('alertId') alertId: string) {
    return this.queryBus.execute(new GetInspectionResultQuery(alertId));
  }

  @Get(':alertId')
  async detail(@Param('alertId') alertId: string) {
    return this.queryBus.execute(new GetLeakageDetailQuery(alertId));
  }
}
