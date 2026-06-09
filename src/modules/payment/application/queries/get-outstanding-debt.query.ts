/**
 * Get Outstanding Debt Query (AC#1)
 *
 * Returns outstanding debt with aging buckets via PortRegistry → debt port.
 * Debt port uses cacheTier: dynamic — cached 5-15 min.
 */

import { IQuery } from '@core/application';
import type { OutstandingDebtResponse } from '../dtos/debt.dto';

export class GetOutstandingDebtQuery extends IQuery<OutstandingDebtResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}

export type GetOutstandingDebtResult = OutstandingDebtResponse;
