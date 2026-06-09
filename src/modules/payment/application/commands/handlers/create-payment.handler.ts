/**
 * Create Payment Command Handler (AC#1, #2, #4)
 *
 * Sequential orchestration — follows UpdateCustomerProfileHandler pattern:
 * 1. Verify invoice exists and is unpaid via invoice port (useCache: false)
 * 2. Create payment via payment port (cacheTier: transaction → NO CACHE)
 * 3. Return QR code / payment link
 *
 * IMPORTANT: Invoice lookup uses useCache: false to prevent stale status
 * allowing double-payment. Payment port is transaction tier — zero caching.
 */

import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { CreatePaymentCommand, CreatePaymentResult } from '../create-payment.command';
import type { CreatePaymentResponse } from '../../dtos/payment.dto';
import type { InvoiceDetail } from '@modules/billing/application/dtos/invoice.dto';
import type { PortResult } from '@shared/port/port.interface';
import { ForbiddenException, NotFoundException } from '@core/common';

@CommandHandler(CreatePaymentCommand)
export class CreatePaymentHandler implements ICommandHandler<CreatePaymentCommand> {
  private readonly logger = new Logger(CreatePaymentHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: CreatePaymentCommand): Promise<CreatePaymentResult> {
    const { customerId, invoiceId, method } = command;

    // Step 1: Verify invoice exists and is unpaid (useCache: false — transaction context)
    this.logger.log(`Verifying invoice ${invoiceId} for payment`);
    const invoiceResult: PortResult<InvoiceDetail> = await this.portRegistry.execute<InvoiceDetail>(
      'invoice',
      'get-by-id',
      { invoiceId, customerId, useCache: false },
    );

    const invoice = invoiceResult?.data;

    // Guard: Invoice must exist
    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    // Guard: Invoice must be unpaid to initiate payment
    if (invoice.paymentStatus !== 'unpaid') {
      throw new ForbiddenException(
        `Invoice ${invoiceId} is not available for payment. Current status: ${invoice.paymentStatus}`,
      );
    }

    // Step 2: Create payment via payment port (cacheTier: transaction → NO CACHE)
    this.logger.log(`Creating payment for invoice ${invoiceId}, method: ${method}`);
    const paymentResult: PortResult<CreatePaymentResponse> =
      await this.portRegistry.execute<CreatePaymentResponse>(
        'payment',
        'create-payment',
        { invoiceId, customerId, method, amount: invoice.totalAmount },
      );

    const payment = paymentResult.data;
    if (!payment) {
      throw new NotFoundException(`Payment creation failed for invoice ${invoiceId} — no response from payment service`);
    }

    this.logger.log(`Payment created: ${payment.paymentId} for invoice ${invoiceId}`);
    return payment;
  }
}
