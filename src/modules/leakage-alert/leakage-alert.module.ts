import { Module, OnModuleInit } from '@nestjs/common';
import { LeakageAlertController } from './infrastructure/http/leakage-alert.controller';
import { MockLeakageAlertAdapter } from './infrastructure/ports/leakage-alert.port';
import { LEAKAGE_ALERT_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetLeakageAlertsHandler } from './application/queries/handlers/get-leakage-alerts.handler';
import { GetLeakageDetailHandler } from './application/queries/handlers/get-leakage-detail.handler';

@Module({
  controllers: [LeakageAlertController],
  providers: [
    MockLeakageAlertAdapter,
    { provide: LEAKAGE_ALERT_PORT_TOKEN, useExisting: MockLeakageAlertAdapter },
    GetLeakageAlertsHandler,
    GetLeakageDetailHandler,
  ],
  exports: [LEAKAGE_ALERT_PORT_TOKEN],
})
export class LeakageAlertModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockLeakageAlertAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register('leakage-alert', this.mockAdapter, this.mockAdapter);
  }
}
