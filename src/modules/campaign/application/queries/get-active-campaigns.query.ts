import { IQuery } from '@core/application';
import type { ActiveCampaignsResponse } from '../dtos/campaign.dto';

export class GetActiveCampaignsQuery extends IQuery<ActiveCampaignsResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}
export type GetActiveCampaignsResult = ActiveCampaignsResponse;
