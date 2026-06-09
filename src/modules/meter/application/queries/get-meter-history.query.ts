/**
 * Get Meter History Query (AC#3)
 *
 * Returns chronological list of meter installations, removals, and replacements.
 */

import { IQuery } from '@core/application';
import type { MeterHistoryResponse } from '../dtos/meter.dto';

export class GetMeterHistoryQuery extends IQuery<MeterHistoryResponse> {
  constructor(
    public readonly customerId: string,
    public readonly meterId: string,
  ) {
    super();
  }
}
