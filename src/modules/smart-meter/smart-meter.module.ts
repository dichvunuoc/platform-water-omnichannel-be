import { Module, OnModuleInit } from '@nestjs/common';
import { SmartMeterController } from './infrastructure/http/smart-meter.controller';
import { MockSmartMeterAdapter } from './infrastructure/ports/smart-meter.port';
import { SMART_METER_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetRealtimeConsumptionHandler } from './application/queries/handlers/get-realtime-consumption.handler';
import { GetMeterStatusHandler } from './application/queries/handlers/get-meter-status.handler';

@Module({
  controllers: [SmartMeterController],
  providers: [
    MockSmartMeterAdapter,
    { provide: SMART_METER_PORT_TOKEN, useExisting: MockSmartMeterAdapter },
    GetRealtimeConsumptionHandler,
    GetMeterStatusHandler,
  ],
  exports: [SMART_METER_PORT_TOKEN],
})
export class SmartMeterModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockSmartMeterAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register('smart-meter', this.mockAdapter, this.mockAdapter);
  }
}
