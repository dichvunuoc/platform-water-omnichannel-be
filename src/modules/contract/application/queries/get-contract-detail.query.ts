/**
 * Get Contract Detail Query (AC#2)
 *
 * Dispatched via IQueryBus, handled by GetContractDetailHandler.
 */

import { IQuery } from '@core/application';
import type { ContractDetailResponse } from '../dtos/contract.dto';

export class GetContractDetailQuery extends IQuery<ContractDetailResponse> {
  constructor(
    public readonly customerId: string,
    public readonly contractId: string,
  ) {
    super();
  }
}
