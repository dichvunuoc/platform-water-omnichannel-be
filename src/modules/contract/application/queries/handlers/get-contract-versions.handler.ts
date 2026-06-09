/**
 * Get Contract Versions Query Handler (AC#3)
 *
 * Calls PortRegistry.execute('contract', 'get-contract-versions', params).
 * Thin pass-through — no business logic.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetContractVersionsQuery } from '../get-contract-versions.query';
import type { ContractVersionsResponse } from '../../dtos/contract.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetContractVersionsQuery)
export class GetContractVersionsHandler implements IQueryHandler<GetContractVersionsQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetContractVersionsQuery): Promise<ContractVersionsResponse> {
    const result: PortResult<ContractVersionsResponse> = await this.portRegistry.execute<ContractVersionsResponse>(
      'contract',
      'get-contract-versions',
      { customerId: query.customerId, contractId: query.contractId },
    );
    return result.data;
  }
}
