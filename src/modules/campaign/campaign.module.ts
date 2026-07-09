import { Module, OnModuleInit } from '@nestjs/common';
import { CampaignController } from './infrastructure/http/campaign.controller';
import { MockCampaignAdapter } from './infrastructure/ports/campaign.port';
import { CAMPAIGN_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetActiveCampaignsHandler } from './application/queries/handlers/get-active-campaigns.handler';
import { GetCampaignDetailHandler } from './application/queries/handlers/get-campaign-detail.handler';

@Module({
  controllers: [CampaignController],
  providers: [
    MockCampaignAdapter,
    { provide: CAMPAIGN_PORT_TOKEN, useExisting: MockCampaignAdapter },
    GetActiveCampaignsHandler,
    GetCampaignDetailHandler,
  ],
  exports: [CAMPAIGN_PORT_TOKEN],
})
export class CampaignModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockCampaignAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register('campaign', this.mockAdapter, this.mockAdapter);
  }
}
