import { Body, Controller, Get, Inject, Param, Put } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { ICommandBus, IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetActiveCampaignsQuery } from '../../application/queries/get-active-campaigns.query';
import { GetCampaignDetailQuery } from '../../application/queries/get-campaign-detail.query';
import { GetMarketingMessagesQuery } from '../../application/queries/get-marketing-messages.query';
import { UpdateMarketingPreferenceCommand } from '../../application/commands/update-marketing-preference.command';

@ApiTags('Campaign')
@ApiBearerAuth('JWT-auth')
@Controller('campaigns')
export class CampaignController {
  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  @Get()
  async active(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetActiveCampaignsQuery(userId));
  }

  @Get('messages')
  async messages(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetMarketingMessagesQuery(userId));
  }

  @Get(':campaignId')
  async detail(@Param('campaignId') campaignId: string) {
    return this.queryBus.execute(new GetCampaignDetailQuery(campaignId));
  }

  @Put('preferences')
  async updatePreference(
    @CurrentUser('id') userId: string,
    @Body() body: { push: boolean; email: boolean; sms: boolean; zalo: boolean },
  ) {
    return this.commandBus.execute(new UpdateMarketingPreferenceCommand(userId, body));
  }
}
