import { IQuery } from '@core/application';
import type { CampaignDetail } from '../dtos/campaign.dto';

export class GetCampaignDetailQuery extends IQuery<CampaignDetail> {
  constructor(public readonly campaignId: string) {
    super();
  }
}
export type GetCampaignDetailResult = CampaignDetail;
