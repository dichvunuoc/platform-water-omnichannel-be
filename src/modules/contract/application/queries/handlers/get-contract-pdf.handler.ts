/**
 * Get Contract PDF Query Handler (AC#4)
 *
 * Calls PortRegistry.execute('contract', 'get-contract-pdf', params).
 * Thin pass-through — no business logic.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetContractPDFQuery } from '../get-contract-pdf.query';
import type { ContractPDFResponse } from '../../dtos/contract.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetContractPDFQuery)
export class GetContractPDFHandler implements IQueryHandler<GetContractPDFQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetContractPDFQuery): Promise<ContractPDFResponse> {
    const result: PortResult<ContractPDFResponse> = await this.portRegistry.execute<ContractPDFResponse>(
      'contract',
      'get-contract-pdf',
      { customerId: query.customerId, contractId: query.contractId },
    );
    return result.data;
  }
}
