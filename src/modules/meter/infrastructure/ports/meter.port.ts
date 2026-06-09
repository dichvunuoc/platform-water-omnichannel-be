/**
 * Meter Port Interface & Mock Adapter
 *
 * Defines the contract for downstream meter service communication.
 * MockMeterAdapter returns mock data during development.
 *
 * AC: #1 (getMeterByCustomer), #2 (getCalibrationStatus), #3 (getMeterHistory)
 *
 * NOTE: Calibration mock JSON uses CalibrationStatusRawSchema (no isWarning).
 * The isWarning flag is BFF-computed in GetCalibrationStatusHandler.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  MeterListResponseSchema,
  CalibrationStatusRawSchema,
  MeterHistoryResponseSchema,
} from '../../application/dtos/meter.dto';

/**
 * Meter Port Interface
 *
 * Methods: get-meter-by-customer, get-calibration-status, get-meter-history
 * Each method is dispatched via PortRegistry.execute('meter', method, params).
 */
export interface IMeterPort extends IPortAdapter {
  // Methods are invoked via execute(method, params) from IPortAdapter
}

/**
 * Mock Meter Adapter
 *
 * Returns mock meter responses from JSON files for development.
 * Extends MockAdapterBase for consistent mock behavior.
 */
@Injectable()
export class MockMeterAdapter extends MockAdapterBase implements IMeterPort {
  constructor() {
    super(
      'meter',
      {
        'get-meter-by-customer': MeterListResponseSchema,
        'get-calibration-status': CalibrationStatusRawSchema,
        'get-meter-history': MeterHistoryResponseSchema,
      },
      new Logger('meter-mock-adapter'),
    );
  }
}
