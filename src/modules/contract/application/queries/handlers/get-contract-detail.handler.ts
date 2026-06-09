/**
 * Get Contract Detail Query Handler (AC#2)
 *
 * Calls PortRegistry.execute('contract', 'get-contract-detail', params).
 * Thin pass-through — no business logic.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetContractDetailQuery } from '../get-contract-detail.query';
import type { ContractDetailResponse } from '../../dtos/contract.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetContractDetailQuery)
export class GetContractDetailHandler implements IQueryHandler<GetContractDetailQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetContractDetailQuery): Promise<ContractDetailResponse> {
    const result: PortResult<ContractDetailResponse> = await this.portRegistry.execute<ContractDetailResponse>(
      'contract',
      'get-contract-detail',
      { customerId: query.customerId, contractId: query.contractId },
    );
    return result.data;
  }
}
