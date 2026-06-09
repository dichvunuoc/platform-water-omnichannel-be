/**
 * Get Contract Versions Query (AC#3)
 *
 * Dispatched via IQueryBus, handled by GetContractVersionsHandler.
 */

import { IQuery } from '@core/application';
import type { ContractVersionsResponse } from '../dtos/contract.dto';

export class GetContractVersionsQuery extends IQuery<ContractVersionsResponse> {
  constructor(
    public readonly customerId: string,
    public readonly contractId: string,
  ) {
    super();
  }
}
