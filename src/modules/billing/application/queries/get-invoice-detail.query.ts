/**
 * Get Invoice Detail Query (AC#2)
 *
 * Returns full invoice detail with line items and CQT code.
 */

import { IQuery } from '@core/application';
import type { InvoiceDetail } from '../dtos/invoice.dto';

export class GetInvoiceDetailQuery extends IQuery<InvoiceDetail> {
  constructor(
    public readonly customerId: string,
    public readonly invoiceId: string,
  ) {
    super();
  }
}
