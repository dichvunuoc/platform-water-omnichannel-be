/**
 * Invoice Port Interface & Mock Adapter
 *
 * Defines the contract for downstream invoice/billing service communication.
 * MockInvoiceAdapter returns mock data during development.
 *
 * AC: #1 (get-list), #2 (get-by-id), #3 (get-pdf)
 */

import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  InvoiceListResponseSchema,
  InvoiceDetailSchema,
  InvoicePdfSchema,
} from '../../application/dtos/invoice.dto';

/**
 * Invoice Port Interface
 *
 * Methods: get-list, get-by-id, get-pdf
 * Each method is dispatched via PortRegistry.execute('invoice', method, params).
 */
export interface IInvoicePort extends IPortAdapter {
  // Methods are invoked via execute(method, params) from IPortAdapter
}

/**
 * Mock Invoice Adapter
 *
 * Returns mock invoice responses from JSON files for development.
 * Extends MockAdapterBase for consistent mock behavior.
 */
@Injectable()
export class MockInvoiceAdapter extends MockAdapterBase implements IInvoicePort {
  constructor() {
    super(
      'invoice',
      {
        'get-list': InvoiceListResponseSchema,
        'get-by-id': InvoiceDetailSchema,
        'get-pdf': InvoicePdfSchema,
      },
      new Logger('invoice-mock-adapter'),
    );
  }
}
