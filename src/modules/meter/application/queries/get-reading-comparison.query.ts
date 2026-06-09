/**
 * Get Reading Comparison Query (AC#2)
 *
 * Dispatched via IQueryBus, handled by GetReadingComparisonHandler.
 */

import { IQuery } from '@core/application';
import type { ComparisonResponse } from '../dtos/meter-reading.dto';

export class GetReadingComparisonQuery extends IQuery<ComparisonResponse> {
  constructor(
    public readonly customerId: string,
    public readonly currentPeriod: string,
    public readonly previousPeriod: string,
  ) {
    super();
  }
}
