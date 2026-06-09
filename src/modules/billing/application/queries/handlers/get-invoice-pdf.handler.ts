/**
 * Get Invoice PDF Handler (AC#3)
 *
 * Returns e-invoice PDF URL with CQT code and digital signature via PortRegistry.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetInvoicePdfQuery } from '../get-invoice-pdf.query';
import type { InvoicePdf } from '../../dtos/invoice.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetInvoicePdfQuery)
export class GetInvoicePdfHandler implements IQueryHandler<GetInvoicePdfQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetInvoicePdfQuery): Promise<InvoicePdf> {
    const result: PortResult<InvoicePdf> = await this.portRegistry.execute<InvoicePdf>(
      'invoice',
      'get-pdf',
      { customerId: query.customerId, invoiceId: query.invoiceId },
    );
    return result.data;
  }
}
