/**
 * Meter Reading Port Interface & Mock Adapter
 *
 * Defines the contract for downstream meter reading service communication.
 * MockMeterReadingAdapter returns mock data during development.
 *
 * AC: #1 (get-readings), #2 (get-comparison), #3 (get-reading-detail)
 */

import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  ReadingsListResponseSchema,
  ComparisonRawSchema,
  ReadingDetailSchema,
} from '../../application/dtos/meter-reading.dto';

/**
 * Meter Reading Port Interface
 *
 * Methods: get-readings, get-comparison, get-reading-detail
 * Each method is dispatched via PortRegistry.execute('meter-reading', method, params).
 */
export interface IMeterReadingPort extends IPortAdapter {
  // Methods are invoked via execute(method, params) from IPortAdapter
}

/**
 * Mock Meter Reading Adapter
 *
 * Returns mock consumption responses from JSON files for development.
 * Extends MockAdapterBase for consistent mock behavior.
 */
@Injectable()
export class MockMeterReadingAdapter extends MockAdapterBase implements IMeterReadingPort {
  constructor() {
    super(
      'meter-reading',
      {
        'get-readings': ReadingsListResponseSchema,
        'get-comparison': ComparisonRawSchema,
        'get-reading-detail': ReadingDetailSchema,
      },
      new Logger('meter-reading-mock-adapter'),
    );
  }
}
