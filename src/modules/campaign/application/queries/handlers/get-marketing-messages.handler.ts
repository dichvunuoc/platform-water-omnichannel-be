import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetMarketingMessagesQuery, GetMarketingMessagesResult } from '../get-marketing-messages.query';
import type { MarketingMessagesResponse } from '../../dtos/campaign.dto';

@QueryHandler(GetMarketingMessagesQuery)
export class GetMarketingMessagesHandler implements IQueryHandler<GetMarketingMessagesQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetMarketingMessagesQuery): Promise<GetMarketingMessagesResult> {
    const result = await this.portRegistry.execute<MarketingMessagesResponse>(
      'campaign',
      'get-marketing-messages',
      { customerId: query.customerId },
    );
    if (!result?.data) throw new PortFallbackException('campaign');
    return result.data;
  }
}
