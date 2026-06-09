/**
 * Create Batch Payment Handler (AC#2, #3)
 *
 * Sequential invoice verification → batch payment creation.
 *
 * 1. Verify EVERY invoice in the batch is unpaid (sequential, useCache: false)
 * 2. Accumulate totalAmount from verified invoices
 * 3. Create batch payment via payment port (cacheTier: transaction → NO CACHE)
 *
 * Edge case: If ANY invoice is not unpaid → reject entire batch.
 */

import { Logger } from '@nestjs/common';
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { CreateBatchPaymentCommand } from '../create-batch-payment.command';
import type { CreateBatchPaymentResponse } from '../../dtos/payment.dto';
import type { InvoiceDetail } from '@modules/billing/application/dtos/invoice.dto';
import type { PortResult } from '@shared/port/port.interface';
import { ForbiddenException, NotFoundException } from '@core/common';

@CommandHandler(CreateBatchPaymentCommand)
export class CreateBatchPaymentHandler implements ICommandHandler<CreateBatchPaymentCommand> {
  private readonly logger = new Logger(CreateBatchPaymentHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: CreateBatchPaymentCommand): Promise<CreateBatchPaymentResponse> {
    const { customerId, invoiceIds, method } = command;

    // Verify ALL invoices are unpaid (sequential — useCache: false for each)
    let totalAmount = 0;
    for (const invoiceId of invoiceIds) {
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
      totalAmount += invoice.totalAmount;
    }

    this.logger.log(
      `Batch payment: ${invoiceIds.length} invoices, total: ${totalAmount}, method: ${method}`,
    );

    // Create batch payment (cacheTier: transaction → NO CACHE)
    const paymentResult: PortResult<CreateBatchPaymentResponse> =
      await this.portRegistry.execute<CreateBatchPaymentResponse>(
        'payment',
        'create-batch-payment',
        { invoiceIds, customerId, method, totalAmount },
      );

    this.logger.log(
      `Batch payment created: ${paymentResult.data.paymentId} for ${invoiceIds.length} invoices`,
    );
    return paymentResult.data;
  }
}
