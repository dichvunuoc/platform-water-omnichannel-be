import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { ICommandBus, IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetConsumptionReportQuery } from '../../application/queries/get-consumption-report.query';
import { GetComparisonReportQuery } from '../../application/queries/get-comparison-report.query';
import { GetSavingsTipsQuery } from '../../application/queries/get-savings-tips.query';
import { DownloadReportCommand } from '../../application/commands/download-report.command';

@ApiTags('Reporting')
@ApiBearerAuth('JWT-auth')
@Controller('reports')
export class ReportingController {
  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  @Get('consumption')
  @ApiOperation({ summary: 'Consumption report for a period' })
  async consumption(@CurrentUser('id') userId: string, @Query('period') period: string) {
    return this.queryBus.execute(new GetConsumptionReportQuery(userId, period));
  }

  @Get('comparison')
  @ApiOperation({ summary: 'Comparison report' })
  async comparison(
    @CurrentUser('id') userId: string,
    @Query('type') type: 'previous_period' | 'same_period_last_year' | 'area_average',
  ) {
    return this.queryBus.execute(new GetComparisonReportQuery(userId, type));
  }

  @Get('savings-tips')
  @ApiOperation({ summary: 'Personalized water-saving tips' })
  async savingsTips(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetSavingsTipsQuery(userId));
  }

  @Post('download')
  @ApiOperation({ summary: 'Generate + download a report (pdf/xlsx)' })
  async download(
    @CurrentUser('id') userId: string,
    @Body() body: { period: string; format?: string },
  ) {
    return this.commandBus.execute(
      new DownloadReportCommand(userId, body.period, body.format ?? 'pdf'),
    );
  }
}
