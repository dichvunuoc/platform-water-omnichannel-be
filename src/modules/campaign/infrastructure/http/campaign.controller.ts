import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetActiveCampaignsQuery } from '../../application/queries/get-active-campaigns.query';
import { GetCampaignDetailQuery } from '../../application/queries/get-campaign-detail.query';

@ApiTags('Campaign')
@ApiBearerAuth('JWT-auth')
@Controller('campaigns')
export class CampaignController {
  constructor(@Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus) {}

  @Get()
  async active(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetActiveCampaignsQuery(userId));
  }

  @Get(':campaignId')
  async detail(@Param('campaignId') campaignId: string) {
    return this.queryBus.execute(new GetCampaignDetailQuery(campaignId));
  }
}
