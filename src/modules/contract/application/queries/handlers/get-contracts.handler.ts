/**
 * Get Contracts Query Handler (AC#1)
 *
 * Calls PortRegistry.execute('contract', 'get-contracts', params).
 * Thin pass-through — no business logic.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetContractsQuery } from '../get-contracts.query';
import type { ContractListResponse } from '../../dtos/contract.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetContractsQuery)
export class GetContractsHandler implements IQueryHandler<GetContractsQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetContractsQuery): Promise<ContractListResponse> {
    const result: PortResult<ContractListResponse> = await this.portRegistry.execute<ContractListResponse>(
      'contract',
      'get-contracts',
      { customerId: query.customerId, filters: query.filters },
    );
    return result.data;
  }
}
