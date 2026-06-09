/**
 * Get Tariff Breakdown Handler (AC#2)
 *
 * Returns invoice-specific tier breakdown with subtotals via PortRegistry.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetTariffBreakdownQuery } from '../get-tariff-breakdown.query';
import type { TariffBreakdown } from '../../dtos/tariff.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetTariffBreakdownQuery)
export class GetTariffBreakdownHandler implements IQueryHandler<GetTariffBreakdownQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetTariffBreakdownQuery): Promise<TariffBreakdown> {
    const result: PortResult<TariffBreakdown> = await this.portRegistry.execute<TariffBreakdown>(
      'tariff',
      'get-tariff-breakdown',
      { customerId: query.customerId, contractId: query.contractId, invoiceId: query.invoiceId },
    );
    return result.data;
  }
}
