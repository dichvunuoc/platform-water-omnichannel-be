import { Module, OnModuleInit } from '@nestjs/common';
import { WaterCutoffController } from './infrastructure/http/water-cutoff.controller';
import { MockWaterCutoffAdapter } from './infrastructure/ports/water-cutoff.port';
import { WATER_CUTOFF_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetCutoffStatusHandler } from './application/queries/handlers/get-cutoff-status.handler';
import { GetCutoffScheduleHandler } from './application/queries/handlers/get-cutoff-schedule.handler';

@Module({
  controllers: [WaterCutoffController],
  providers: [
    MockWaterCutoffAdapter,
    { provide: WATER_CUTOFF_PORT_TOKEN, useExisting: MockWaterCutoffAdapter },
    GetCutoffStatusHandler,
    GetCutoffScheduleHandler,
  ],
  exports: [WATER_CUTOFF_PORT_TOKEN],
})
export class WaterCutoffModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockWaterCutoffAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register('water-cutoff', this.mockAdapter, this.mockAdapter);
  }
}
