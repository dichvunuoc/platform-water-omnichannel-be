/**
 * Get Payment History Query (AC#1)
 *
 * Dispatched via QueryBus → handler calls PortRegistry → payment port.
 * No caching — payment port uses cacheTier: transaction.
 */

import { IQuery } from '@core/application';
import type { PaymentHistoryResponse } from '../dtos/payment.dto';

export class GetPaymentHistoryQuery extends IQuery<PaymentHistoryResponse> {
  constructor(
    public readonly customerId: string,
    public readonly filters: { page: number; limit: number; status?: string },
  ) {
    super();
  }
}

export type GetPaymentHistoryResult = PaymentHistoryResponse;
