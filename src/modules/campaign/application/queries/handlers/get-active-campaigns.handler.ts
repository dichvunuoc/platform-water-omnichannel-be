import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetActiveCampaignsQuery, GetActiveCampaignsResult } from '../get-active-campaigns.query';
import type { ActiveCampaignsResponse } from '../../dtos/campaign.dto';

@QueryHandler(GetActiveCampaignsQuery)
export class GetActiveCampaignsHandler implements IQueryHandler<GetActiveCampaignsQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetActiveCampaignsQuery): Promise<GetActiveCampaignsResult> {
    const r = await this.portRegistry.execute<ActiveCampaignsResponse>(
      'campaign',
      'get-active-campaigns',
      { customerId: query.customerId },
    );
    if (!r?.data) throw new PortFallbackException('campaign');
    return r.data;
  }
}
