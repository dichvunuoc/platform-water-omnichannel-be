/**
 * Meter Module
 *
 * NestJS module for meter operations.
 * Registers both meter and meter-reading ports with PortRegistry via onModuleInit.
 *
 * Two ports, one module:
 *   - meter (static cache, 12-24h) — meter info, calibration, history (Story 2.3)
 *   - meter-reading (dynamic cache, 5-15 min) — consumption, comparison, detail (Story 3.1)
 *
 * Pattern: AuthModule → CustomerModule → ContractModule → MeterModule → AuthPropagationModule → PortModule
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { MeterController } from './infrastructure/http/meter.controller';
import { MockMeterAdapter } from './infrastructure/ports/meter.port';
import { MockMeterReadingAdapter } from './infrastructure/ports/meter-reading.port';
import { METER_PORT_TOKEN, METER_READING_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetMeterByCustomerHandler } from './application/queries/handlers/get-meter-by-customer.handler';
import { GetCalibrationStatusHandler } from './application/queries/handlers/get-calibration-status.handler';
import { GetMeterHistoryHandler } from './application/queries/handlers/get-meter-history.handler';
import { GetReadingsHandler } from './application/queries/handlers/get-readings.handler';
import { GetReadingComparisonHandler } from './application/queries/handlers/get-reading-comparison.handler';
import { GetReadingDetailHandler } from './application/queries/handlers/get-reading-detail.handler';

@Module({
  controllers: [MeterController],
  providers: [
    // Port Adapters (single instance shared via useExisting)
    MockMeterAdapter,
    {
      provide: METER_PORT_TOKEN,
      useExisting: MockMeterAdapter,
    },
    MockMeterReadingAdapter,
    {
      provide: METER_READING_PORT_TOKEN,
      useExisting: MockMeterReadingAdapter,
    },
    // CQRS Query Handlers
    GetMeterByCustomerHandler,
    GetCalibrationStatusHandler,
    GetMeterHistoryHandler,
    GetReadingsHandler,
    GetReadingComparisonHandler,
    GetReadingDetailHandler,
  ],
  exports: [METER_PORT_TOKEN, METER_READING_PORT_TOKEN],
})
export class MeterModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockMeterAdapter,
    private readonly mockReadingAdapter: MockMeterReadingAdapter,
  ) {}

  /**
   * Register ports with PortRegistry on module init.
   * Config merges from api-endpoints.yaml.
   */
  onModuleInit() {
    // Port 1: Meter info (static, 12-24h cache) — Story 2.3
    this.portRegistry.register(
      'meter',
      this.mockAdapter,
      this.mockAdapter,
    );
    // Port 2: Meter readings (dynamic, 5-15 min cache) — Story 3.1
    this.portRegistry.register(
      'meter-reading',
      this.mockReadingAdapter,
      this.mockReadingAdapter,
    );
  }
}
