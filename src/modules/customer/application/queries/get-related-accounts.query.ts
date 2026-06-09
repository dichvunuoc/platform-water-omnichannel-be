/**
 * Get Related Accounts Query (AC#4)
 *
 * Dispatched via IQueryBus, handled by GetRelatedAccountsHandler.
 */

import { IQuery } from '@core/application';
import type { RelatedAccountsResponse } from '../dtos/customer-profile.dto';

export class GetRelatedAccountsQuery extends IQuery<RelatedAccountsResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}
