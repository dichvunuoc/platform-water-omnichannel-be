/**
 * Tariff Port Interface & Mock Adapter
 *
 * Defines the contract for downstream tariff/billing service communication.
 * MockTariffAdapter returns mock data during development.
 *
 * AC: #1 (get-tariff-plan), #2 (get-tariff-breakdown), #3 (get-applicable-fees)
 */

import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  TariffPlanSchema,
  TariffBreakdownSchema,
  ApplicableFeesResponseSchema,
} from '../../application/dtos/tariff.dto';

/**
 * Tariff Port Interface
 *
 * Methods: get-tariff-plan, get-tariff-breakdown, get-applicable-fees
 * Each method is dispatched via PortRegistry.execute('tariff', method, params).
 */
export interface ITariffPort extends IPortAdapter {
  // Methods are invoked via execute(method, params) from IPortAdapter
}

/**
 * Mock Tariff Adapter
 *
 * Returns mock tariff responses from JSON files for development.
 * Extends MockAdapterBase for consistent mock behavior.
 */
@Injectable()
export class MockTariffAdapter extends MockAdapterBase implements ITariffPort {
  constructor() {
    super(
      'tariff',
      {
        'get-tariff-plan': TariffPlanSchema,
        'get-tariff-breakdown': TariffBreakdownSchema,
        'get-applicable-fees': ApplicableFeesResponseSchema,
      },
      new Logger('tariff-mock-adapter'),
    );
  }
}
