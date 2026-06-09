/**
 * Get Invoice List Handler (AC#1)
 *
 * Returns paginated invoice list via PortRegistry.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetInvoiceListQuery } from '../get-invoice-list.query';
import type { InvoiceListResponse } from '../../dtos/invoice.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetInvoiceListQuery)
export class GetInvoiceListHandler implements IQueryHandler<GetInvoiceListQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetInvoiceListQuery): Promise<InvoiceListResponse> {
    const result: PortResult<InvoiceListResponse> = await this.portRegistry.execute<InvoiceListResponse>(
      'invoice',
      'get-list',
      { customerId: query.customerId, ...query.filters },
    );
    return result.data;
  }
}
