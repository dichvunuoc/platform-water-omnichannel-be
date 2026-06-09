/**
 * Get Invoice Detail Handler (AC#2)
 *
 * Returns full invoice detail with line items and CQT code via PortRegistry.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetInvoiceDetailQuery } from '../get-invoice-detail.query';
import type { InvoiceDetail } from '../../dtos/invoice.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetInvoiceDetailQuery)
export class GetInvoiceDetailHandler implements IQueryHandler<GetInvoiceDetailQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetInvoiceDetailQuery): Promise<InvoiceDetail> {
    const result: PortResult<InvoiceDetail> = await this.portRegistry.execute<InvoiceDetail>(
      'invoice',
      'get-by-id',
      { customerId: query.customerId, invoiceId: query.invoiceId },
    );
    return result.data;
  }
}
