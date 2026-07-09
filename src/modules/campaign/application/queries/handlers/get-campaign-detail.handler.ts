import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetCampaignDetailQuery, GetCampaignDetailResult } from '../get-campaign-detail.query';
import type { CampaignDetail } from '../../dtos/campaign.dto';

@QueryHandler(GetCampaignDetailQuery)
export class GetCampaignDetailHandler implements IQueryHandler<GetCampaignDetailQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetCampaignDetailQuery): Promise<GetCampaignDetailResult> {
    const r = await this.portRegistry.execute<CampaignDetail>('campaign', 'get-campaign-detail', {
      campaignId: query.campaignId,
    });
    if (!r?.data) throw new PortFallbackException('campaign');
    return r.data;
  }
}
