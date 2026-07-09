import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { ActiveCampaignsResponseSchema, CampaignDetailSchema, MarketingPreferenceResultSchema, MarketingMessagesResponseSchema } from '../../application/dtos/campaign.dto';

/** Campaign Port — active marketing campaigns (Phase 3, S33). */
export interface ICampaignPort extends IPortAdapter {
  // Methods: get-active-campaigns, get-campaign-detail
}

@Injectable()
export class MockCampaignAdapter extends MockAdapterBase implements ICampaignPort {
  constructor() {
    super(
      'campaign',
      {
        'get-active-campaigns': ActiveCampaignsResponseSchema,
        'get-campaign-detail': CampaignDetailSchema,
        'update-marketing-preference': MarketingPreferenceResultSchema,
        'get-marketing-messages': MarketingMessagesResponseSchema,
      },
      new Logger('campaign-mock-adapter'),
    );
  }
}
