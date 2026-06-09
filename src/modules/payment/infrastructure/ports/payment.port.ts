/**
 * Payment Port Interface & Mock Adapter
 *
 * Defines the contract for downstream payment service communication.
 * MockPaymentAdapter returns mock data during development.
 *
 * AC: #1 (create-payment), #2 (transaction tier — NO CACHE), #4 (idempotency)
 *
 * IMPORTANT: Payment port is cacheTier: transaction — PortRegistry NEVER caches responses.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  CreatePaymentResponseSchema,
  PaymentHistoryResponseSchema,
  CreateBatchPaymentResponseSchema,
  SetupAutoDebitResponseSchema,
} from '../../application/dtos/payment.dto';

/**
 * Payment Port Interface
 *
 * Methods: create-payment, get-payment-history, create-batch-payment
 * Each method is dispatched via PortRegistry.execute('payment', method, params).
 */
export interface IPaymentPort extends IPortAdapter {
  // Methods are invoked via execute(method, params) from IPortAdapter
}

/**
 * Mock Payment Adapter
 *
 * Returns mock payment responses from JSON files for development.
 * Extends MockAdapterBase for consistent mock behavior.
 */
@Injectable()
export class MockPaymentAdapter extends MockAdapterBase implements IPaymentPort {
  constructor() {
    super(
      'payment',
      {
        'create-payment': CreatePaymentResponseSchema,
        'get-payment-history': PaymentHistoryResponseSchema,
        'create-batch-payment': CreateBatchPaymentResponseSchema,
        'setup-auto-debit': SetupAutoDebitResponseSchema,
      },
      new Logger('payment-mock-adapter'),
    );
  }
}
