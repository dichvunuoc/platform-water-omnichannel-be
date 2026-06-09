/**
 * Get Invoice PDF Query (AC#3)
 *
 * Returns e-invoice PDF URL with CQT code and digital signature.
 */

import { IQuery } from '@core/application';
import type { InvoicePdf } from '../dtos/invoice.dto';

export class GetInvoicePdfQuery extends IQuery<InvoicePdf> {
  constructor(
    public readonly customerId: string,
    public readonly invoiceId: string,
  ) {
    super();
  }
}
