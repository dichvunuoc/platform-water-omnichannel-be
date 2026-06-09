/**
 * Get Invoice List Query (AC#1)
 *
 * Returns paginated invoice list with optional filters.
 */

import { IQuery } from '@core/application';
import type { InvoiceListResponse } from '../dtos/invoice.dto';

export class GetInvoiceListQuery extends IQuery<InvoiceListResponse> {
  constructor(
    public readonly customerId: string,
    public readonly filters: {
      month?: string;
      status?: string;
      page: number;
      limit: number;
    },
  ) {
    super();
  }
}
