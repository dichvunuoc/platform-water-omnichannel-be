/**
 * Get Applicable Fees Query (AC#3)
 *
 * Returns environmental fee, drainage fee, VAT, and surcharges.
 */

import { IQuery } from '@core/application';
import type { ApplicableFeesResponse } from '../dtos/tariff.dto';

export class GetApplicableFeesQuery extends IQuery<ApplicableFeesResponse> {
  constructor(
    public readonly customerId: string,
    public readonly contractId: string,
  ) {
    super();
  }
}
