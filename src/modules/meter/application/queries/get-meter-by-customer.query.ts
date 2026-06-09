/**
 * Get Meter By Customer Query (AC#1)
 *
 * Returns MeterListResponse (array) — 1 Customer can have N Meters.
 */

import { IQuery } from '@core/application';
import type { MeterListResponse } from '../dtos/meter.dto';

export class GetMeterByCustomerQuery extends IQuery<MeterListResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}
