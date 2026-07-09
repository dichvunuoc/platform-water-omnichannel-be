import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetRealtimeConsumptionQuery } from '../../application/queries/get-realtime-consumption.query';
import { GetMeterStatusQuery } from '../../application/queries/get-meter-status.query';

@ApiTags('Smart Meter')
@ApiBearerAuth('JWT-auth')
@Controller('smart-meter')
export class SmartMeterController {
  constructor(@Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus) {}

  @Get('consumption')
  async consumption(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetRealtimeConsumptionQuery(userId));
  }

  @Get(':meterId/status')
  async status(@Param('meterId') meterId: string) {
    return this.queryBus.execute(new GetMeterStatusQuery(meterId));
  }
}
