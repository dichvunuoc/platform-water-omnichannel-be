/**
 * Create Payment Command (AC#1)
 *
 * Sequential orchestration:
 * 1. Verify invoice exists and is unpaid (invoice port, useCache: false)
 * 2. Create payment (payment port, transaction tier — NO CACHE)
 * 3. Return QR code / payment link
 */

import { ICommand } from '@core/application';
import type { PaymentMethod, CreatePaymentResponse } from '../dtos/payment.dto';

export class CreatePaymentCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly invoiceId: string,
    public readonly method: PaymentMethod,
  ) {}
}

export type CreatePaymentResult = CreatePaymentResponse;
