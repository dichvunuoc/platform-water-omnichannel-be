import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetContractQuery, GetContractResult } from '../get-contract.query';
import type { EcontractResponse } from '../../dtos/econtract.dto';

@QueryHandler(GetContractQuery)
export class GetContractHandler implements IQueryHandler<GetContractQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetContractQuery): Promise<GetContractResult> {
    const r = await this.portRegistry.execute<EcontractResponse>('econtract', 'get-contract', {
      customerId: query.customerId,
      dossierId: query.dossierId,
    });
    if (!r?.data) throw new PortFallbackException('econtract');
    return r.data;
  }
}
