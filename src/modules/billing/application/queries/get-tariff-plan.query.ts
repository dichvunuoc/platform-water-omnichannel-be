/**
 * Get Tariff Plan Query (AC#1)
 *
 * Returns tiered pricing table (bậc thang) for a contract.
 */

import { IQuery } from '@core/application';
import type { TariffPlan } from '../dtos/tariff.dto';

export class GetTariffPlanQuery extends IQuery<TariffPlan> {
  constructor(
    public readonly customerId: string,
    public readonly contractId: string,
  ) {
    super();
  }
}
