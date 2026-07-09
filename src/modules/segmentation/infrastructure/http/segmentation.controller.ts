import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetSegmentsQuery } from '../../application/queries/get-segments.query';
import { CheckEligibilityQuery } from '../../application/queries/check-eligibility.query';
import { GetSegmentHistoryQuery } from '../../application/queries/get-segment-history.query';

@ApiTags('Segmentation')
@ApiBearerAuth('JWT-auth')
@Controller('segments')
export class SegmentationController {
  constructor(@Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus) {}

  @Get()
  @ApiOperation({ summary: 'Get the authenticated customer’s segmentation' })
  @ApiResponse({ status: 200, description: 'Customer segment' })
  async getSegments(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetSegmentsQuery(userId));
  }

  @Get('history')
  @ApiOperation({ summary: 'Customer segment history over time' })
  @ApiResponse({ status: 200, description: 'Segment history' })
  async getHistory(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetSegmentHistoryQuery(userId));
  }

  @Get('eligibility/:campaignId')
  @ApiOperation({ summary: 'Check campaign eligibility for the authenticated customer' })
  @ApiResponse({ status: 200, description: 'Eligibility result' })
  async checkEligibility(
    @CurrentUser('id') userId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.queryBus.execute(new CheckEligibilityQuery(userId, campaignId));
  }
}
