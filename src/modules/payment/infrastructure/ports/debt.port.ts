/**
 * Debt Port Interface & Mock Adapter
 *
 * Defines the contract for downstream debt service communication.
 * MockDebtAdapter returns mock data during development.
 *
 * AC: #1 (outstanding debt with aging), #2 (debt history), #3 (dynamic cache tier)
 *
 * IMPORTANT: Debt port uses cacheTier: dynamic — responses cached 5-15 min.
 * Different from payment port (cacheTier: transaction — NO CACHE).
 */

import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { OutstandingDebtResponseSchema, DebtHistoryResponseSchema } from '../../application/dtos/debt.dto';

/**
 * Debt Port Interface
 *
 * Methods: get-outstanding-debt, get-debt-history
 * Each method is dispatched via PortRegistry.execute('debt', method, params).
 */
export interface IDebtPort extends IPortAdapter {
  // Methods are invoked via execute(method, params) from IPortAdapter
}

/**
 * Mock Debt Adapter
 *
 * Returns mock debt responses from JSON files for development.
 * Extends MockAdapterBase for consistent mock behavior.
 */
@Injectable()
export class MockDebtAdapter extends MockAdapterBase implements IDebtPort {
  constructor() {
    super(
      'debt',
      {
        'get-outstanding-debt': OutstandingDebtResponseSchema,
        'get-debt-history': DebtHistoryResponseSchema,
      },
      new Logger('debt-mock-adapter'),
    );
  }
}
