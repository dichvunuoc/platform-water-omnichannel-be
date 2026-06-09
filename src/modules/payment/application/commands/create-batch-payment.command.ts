/**
 * Create Batch Payment Command (AC#2)
 *
 * Sequential orchestration:
 * 1. Verify ALL invoices exist and are unpaid (invoice port, useCache: false)
 * 2. Accumulate total amount from verified invoices
 * 3. Create batch payment (payment port, transaction tier — NO CACHE)
 * 4. Return single QR code / payment link covering all invoices
 */

import { ICommand } from '@core/application';
import type { PaymentMethod, CreateBatchPaymentResponse } from '../dtos/payment.dto';

export class CreateBatchPaymentCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly invoiceIds: string[],
    public readonly method: PaymentMethod,
  ) {}
}

export type CreateBatchPaymentResult = CreateBatchPaymentResponse;
