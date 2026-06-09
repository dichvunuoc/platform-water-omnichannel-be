/**
 * Get Customer Profile Query Handler (AC#1)
 *
 * Calls PortRegistry.execute('customer-profile', 'get-profile', params).
 * Thin pass-through — no business logic.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetCustomerProfileQuery } from '../get-customer-profile.query';
import type { CustomerProfileResponse } from '../../dtos/customer-profile.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetCustomerProfileQuery)
export class GetCustomerProfileHandler implements IQueryHandler<GetCustomerProfileQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetCustomerProfileQuery): Promise<CustomerProfileResponse> {
    const result: PortResult<CustomerProfileResponse> = await this.portRegistry.execute<CustomerProfileResponse>(
      'customer-profile',
      'get-profile',
      { customerId: query.customerId },
    );
    return result.data;
  }
}
