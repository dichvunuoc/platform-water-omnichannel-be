/**
 * Get Payment History Handler (AC#1)
 *
 * Reads payment history via PortRegistry → payment port.
 * cacheTier: transaction — every request hits Payment Service live (FR35).
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetPaymentHistoryQuery } from '../get-payment-history.query';
import type { PaymentHistoryResponse } from '../../dtos/payment.dto';
import { NotFoundException } from '@core/common';

@QueryHandler(GetPaymentHistoryQuery)
export class GetPaymentHistoryHandler implements IQueryHandler<GetPaymentHistoryQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetPaymentHistoryQuery): Promise<PaymentHistoryResponse> {
    const result = await this.portRegistry.execute<PaymentHistoryResponse>(
      'payment',
      'get-payment-history',
      { customerId: query.customerId, filters: query.filters },
    );

    if (!result.data) {
      throw new NotFoundException(`Payment history not available for customer ${query.customerId}`);
    }

    return result.data;
  }
}
