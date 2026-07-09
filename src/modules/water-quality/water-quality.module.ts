import { Module, OnModuleInit } from '@nestjs/common';
import { WaterQualityController } from './infrastructure/http/water-quality.controller';
import { MockWaterQualityAdapter } from './infrastructure/ports/water-quality.port';
import { WATER_QUALITY_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetQualityAtLocationHandler } from './application/queries/handlers/get-quality-at-location.handler';
import { GetQualityAlertsHandler } from './application/queries/handlers/get-quality-alerts.handler';

@Module({
  controllers: [WaterQualityController],
  providers: [
    MockWaterQualityAdapter,
    { provide: WATER_QUALITY_PORT_TOKEN, useExisting: MockWaterQualityAdapter },
    GetQualityAtLocationHandler,
    GetQualityAlertsHandler,
  ],
  exports: [WATER_QUALITY_PORT_TOKEN],
})
export class WaterQualityModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockWaterQualityAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register('water-quality', this.mockAdapter, this.mockAdapter);
  }
}
