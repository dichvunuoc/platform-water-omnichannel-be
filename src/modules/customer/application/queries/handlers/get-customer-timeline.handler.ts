/**
 * Get Customer Timeline Query Handler (AC#2)
 *
 * Calls PortRegistry.execute('customer-profile', 'get-timeline', params).
 * Passes filters through to downstream.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetCustomerTimelineQuery } from '../get-customer-timeline.query';
import type { TimelineResponse } from '../../dtos/customer-profile.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetCustomerTimelineQuery)
export class GetCustomerTimelineHandler implements IQueryHandler<GetCustomerTimelineQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetCustomerTimelineQuery): Promise<TimelineResponse> {
    const result: PortResult<TimelineResponse> = await this.portRegistry.execute<TimelineResponse>(
      'customer-profile',
      'get-timeline',
      { customerId: query.customerId, filters: query.filters },
    );
    return result.data;
  }
}
