import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetConsumptionReportQuery } from '../../application/queries/get-consumption-report.query';
import { GetComparisonReportQuery } from '../../application/queries/get-comparison-report.query';

@ApiTags('Reporting')
@ApiBearerAuth('JWT-auth')
@Controller('reports')
export class ReportingController {
  constructor(@Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus) {}

  @Get('consumption')
  @ApiOperation({ summary: 'Consumption report for a period' })
  async consumption(
    @CurrentUser('id') userId: string,
    @Query('period') period: string,
  ) {
    return this.queryBus.execute(new GetConsumptionReportQuery(userId, period));
  }

  @Get('comparison')
  @ApiOperation({ summary: 'Comparison report (previous period / same period last year / area average)' })
  async comparison(
    @CurrentUser('id') userId: string,
    @Query('type')
    type: 'previous_period' | 'same_period_last_year' | 'area_average',
  ) {
    return this.queryBus.execute(new GetComparisonReportQuery(userId, type));
  }
}
