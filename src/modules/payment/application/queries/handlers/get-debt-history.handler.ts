/**
 * Get Debt History Handler (AC#2)
 *
 * Reads chronological debt history via PortRegistry → debt port.
 * cacheTier: dynamic — cached 5-15 min.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetDebtHistoryQuery } from '../get-debt-history.query';
import type { DebtHistoryResponse } from '../../dtos/debt.dto';
import { NotFoundException } from '@core/common';

@QueryHandler(GetDebtHistoryQuery)
export class GetDebtHistoryHandler implements IQueryHandler<GetDebtHistoryQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetDebtHistoryQuery): Promise<DebtHistoryResponse> {
    const result = await this.portRegistry.execute<DebtHistoryResponse>(
      'debt',
      'get-debt-history',
      { customerId: query.customerId },
    );

    if (!result.data) {
      throw new NotFoundException(
        `Debt history not found for customer: ${query.customerId}`,
      );
    }

    return result.data;
  }
}
