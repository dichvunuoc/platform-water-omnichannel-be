/**
 * Get Customer Timeline Query (AC#2)
 *
 * Dispatched via IQueryBus, handled by GetCustomerTimelineHandler.
 */

import { IQuery } from '@core/application';
import type { TimelineResponse } from '../dtos/customer-profile.dto';

export interface TimelineFilters {
  eventType?: string;
  channel?: string;
  from?: string;
  to?: string;
}

export class GetCustomerTimelineQuery extends IQuery<TimelineResponse> {
  constructor(
    public readonly customerId: string,
    public readonly filters?: TimelineFilters,
  ) {
    super();
  }
}
