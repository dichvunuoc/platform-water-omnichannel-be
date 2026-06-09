/**
 * Get Debt History Query (AC#2)
 *
 * Returns chronological debt history via PortRegistry → debt port.
 * Debt port uses cacheTier: dynamic — cached 5-15 min.
 */

import { IQuery } from '@core/application';
import type { DebtHistoryResponse } from '../dtos/debt.dto';

export class GetDebtHistoryQuery extends IQuery<DebtHistoryResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}

export type GetDebtHistoryResult = DebtHistoryResponse;
