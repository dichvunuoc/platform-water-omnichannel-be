/**
 * Get Customer Profile Query (AC#1)
 *
 * Dispatched via IQueryBus, handled by GetCustomerProfileHandler.
 */

import { IQuery } from '@core/application';
import type { CustomerProfileResponse } from '../dtos/customer-profile.dto';

export class GetCustomerProfileQuery extends IQuery<CustomerProfileResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}
