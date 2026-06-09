/**
 * Get Related Accounts Query Handler (AC#4)
 *
 * Calls PortRegistry.execute('customer-profile', 'get-related-accounts', params).
 * Thin pass-through — no business logic.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetRelatedAccountsQuery } from '../get-related-accounts.query';
import type { RelatedAccountsResponse } from '../../dtos/customer-profile.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetRelatedAccountsQuery)
export class GetRelatedAccountsHandler implements IQueryHandler<GetRelatedAccountsQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetRelatedAccountsQuery): Promise<RelatedAccountsResponse> {
    const result: PortResult<RelatedAccountsResponse> = await this.portRegistry.execute<RelatedAccountsResponse>(
      'customer-profile',
      'get-related-accounts',
      { customerId: query.customerId },
    );
    return result.data;
  }
}
