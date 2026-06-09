/**
 * Get Applicable Fees Handler (AC#3)
 *
 * Returns environmental fee, drainage fee, VAT, and surcharges via PortRegistry.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetApplicableFeesQuery } from '../get-applicable-fees.query';
import type { ApplicableFeesResponse } from '../../dtos/tariff.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetApplicableFeesQuery)
export class GetApplicableFeesHandler implements IQueryHandler<GetApplicableFeesQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetApplicableFeesQuery): Promise<ApplicableFeesResponse> {
    const result: PortResult<ApplicableFeesResponse> = await this.portRegistry.execute<ApplicableFeesResponse>(
      'tariff',
      'get-applicable-fees',
      { customerId: query.customerId, contractId: query.contractId },
    );
    return result.data;
  }
}
