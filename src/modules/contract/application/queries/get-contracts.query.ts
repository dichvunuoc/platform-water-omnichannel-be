/**
 * Get Contracts Query (AC#1)
 *
 * Dispatched via IQueryBus, handled by GetContractsHandler.
 */

import { IQuery } from '@core/application';
import type { ContractListResponse } from '../dtos/contract.dto';
import type { ContractQueryDto } from '../dtos/contract-query.dto';

export class GetContractsQuery extends IQuery<ContractListResponse> {
  constructor(
    public readonly customerId: string,
    public readonly filters?: ContractQueryDto,
  ) {
    super();
  }
}
