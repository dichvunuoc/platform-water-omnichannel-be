/**
 * Get Tariff Plan Handler (AC#1)
 *
 * Returns tiered pricing table via PortRegistry.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetTariffPlanQuery } from '../get-tariff-plan.query';
import type { TariffPlan } from '../../dtos/tariff.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetTariffPlanQuery)
export class GetTariffPlanHandler implements IQueryHandler<GetTariffPlanQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetTariffPlanQuery): Promise<TariffPlan> {
    const result: PortResult<TariffPlan> = await this.portRegistry.execute<TariffPlan>(
      'tariff',
      'get-tariff-plan',
      { customerId: query.customerId, contractId: query.contractId },
    );
    return result.data;
  }
}
