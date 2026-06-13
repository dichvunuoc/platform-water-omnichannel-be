/**
 * Get Outstanding Debt Handler (AC#1)
 *
 * Reads outstanding debt with aging buckets via PortRegistry → debt port.
 * cacheTier: dynamic — cached 5-15 min (unlike payment port which is transaction).
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetOutstandingDebtQuery } from '../get-outstanding-debt.query';
import type { OutstandingDebtResponse } from '../../dtos/debt.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

@QueryHandler(GetOutstandingDebtQuery)
export class GetOutstandingDebtHandler implements IQueryHandler<GetOutstandingDebtQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetOutstandingDebtQuery): Promise<OutstandingDebtResponse> {
    const result = await this.portRegistry.execute<OutstandingDebtResponse>(
      'debt',
      'get-outstanding-debt',
      { customerId: query.customerId },
    );

    if (!result?.data) {
      throw new PortFallbackException('debt');
    }

    return result.data;
  }
}
