/**
 * Get Tariff Breakdown Query (AC#2)
 *
 * Returns invoice-specific tier breakdown with subtotals.
 */

import { IQuery } from '@core/application';
import type { TariffBreakdown } from '../dtos/tariff.dto';

export class GetTariffBreakdownQuery extends IQuery<TariffBreakdown> {
  constructor(
    public readonly customerId: string,
    public readonly contractId: string,
    public readonly invoiceId: string,
  ) {
    super();
  }
}
