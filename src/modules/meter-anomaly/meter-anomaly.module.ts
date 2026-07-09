import { Module, OnModuleInit } from '@nestjs/common';
import { MeterAnomalyController } from './infrastructure/http/meter-anomaly.controller';
import { MockMeterAnomalyAdapter } from './infrastructure/ports/meter-anomaly.port';
import { METER_ANOMALY_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetAnomalyAlertsHandler } from './application/queries/handlers/get-anomaly-alerts.handler';
import { GetAnomalyDetailHandler } from './application/queries/handlers/get-anomaly-detail.handler';

@Module({
  controllers: [MeterAnomalyController],
  providers: [
    MockMeterAnomalyAdapter,
    { provide: METER_ANOMALY_PORT_TOKEN, useExisting: MockMeterAnomalyAdapter },
    GetAnomalyAlertsHandler,
    GetAnomalyDetailHandler,
  ],
  exports: [METER_ANOMALY_PORT_TOKEN],
})
export class MeterAnomalyModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockMeterAnomalyAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register('meter-anomaly', this.mockAdapter, this.mockAdapter);
  }
}
