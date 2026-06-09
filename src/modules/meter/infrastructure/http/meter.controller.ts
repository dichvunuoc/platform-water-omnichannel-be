/**
 * Meter Controller
 *
 * REST endpoints for meter operations.
 * Thin pass-through: validates input → dispatches CQRS → returns result.
 *
 * AC: #1 (meter list — array), #2 (calibration + isWarning), #3 (history)
 * Story 3.1: +consumption history, +comparison, +reading detail
 */

import { Controller, Get, Param, Query, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { GetMeterByCustomerQuery } from '../../application/queries/get-meter-by-customer.query';
import { GetCalibrationStatusQuery } from '../../application/queries/get-calibration-status.query';
import { GetMeterHistoryQuery } from '../../application/queries/get-meter-history.query';
import { GetReadingsQuery } from '../../application/queries/get-readings.query';
import { GetReadingComparisonQuery } from '../../application/queries/get-reading-comparison.query';
import { GetReadingDetailQuery } from '../../application/queries/get-reading-detail.query';
import { ValidationException } from '@core/common';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { MeterIdParamSchema } from '../../application/dtos/meter.dto';
import {
  PeriodParamSchema,
  ComparisonQuerySchema,
} from '../../application/dtos/meter-reading.dto';

@ApiTags('Meter')
@ApiBearerAuth('JWT-auth')
@Controller('meters')
export class MeterController {

  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
  ) {}

  /**
   * GET /meters
   * Get customer's meter list — returns ARRAY (1 Customer : N Meters) (AC#1)
   */
  @Get()
  @ApiOperation({ summary: 'Get customer meters (list)' })
  async getMeters(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetMeterByCustomerQuery(userId));
  }

  // ===========================================================================
  // Story 3.1: Consumption History & Charts
  // ===========================================================================

  /**
   * GET /meters/consumption
   * Get 12-month consumption history for charts (Story 3.1 AC#1)
   */
  @Get('consumption')
  @ApiOperation({ summary: 'Get 12-month consumption history for charts' })
  async getConsumptionHistory(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetReadingsQuery(userId));
  }

  /**
   * GET /meters/consumption/comparison?current=YYYY-MM&previous=YYYY-MM
   * Compare consumption between two periods (Story 3.1 AC#2)
   */
  @Get('consumption/comparison')
  @ApiOperation({ summary: 'Compare consumption between two periods' })
  async getConsumptionComparison(
    @CurrentUser('id') userId: string,
    @Query('current') current: string,
    @Query('previous') previous: string,
  ) {
    this.validateComparisonParams(current, previous);
    return this.queryBus.execute(new GetReadingComparisonQuery(userId, current, previous));
  }

  /**
   * GET /meters/consumption/:period
   * Get period reading detail with evidence photos (Story 3.1 AC#3)
   */
  @Get('consumption/:period')
  @ApiOperation({ summary: 'Get period reading detail with evidence photos' })
  async getReadingDetail(
    @CurrentUser('id') userId: string,
    @Param('period') period: string,
  ) {
    this.validatePeriod(period);
    return this.queryBus.execute(new GetReadingDetailQuery(userId, period));
  }

  /**
   * GET /meters/:meterId/calibration
   * Get calibration status with BFF-computed isWarning flag (AC#2)
   */
  @Get(':meterId/calibration')
  @ApiOperation({ summary: 'Get meter calibration status' })
  async getCalibrationStatus(
    @CurrentUser('id') userId: string,
    @Param('meterId') meterId: string,
  ) {
    this.validateMeterId(meterId);
    return this.queryBus.execute(new GetCalibrationStatusQuery(userId, meterId));
  }

  /**
   * GET /meters/:meterId/history
   * Get meter replacement/repair history (AC#3)
   */
  @Get(':meterId/history')
  @ApiOperation({ summary: 'Get meter replacement history' })
  async getMeterHistory(
    @CurrentUser('id') userId: string,
    @Param('meterId') meterId: string,
  ) {
    this.validateMeterId(meterId);
    return this.queryBus.execute(new GetMeterHistoryQuery(userId, meterId));
  }

  /**
   * Validate meterId param — alphanumeric, dashes, underscores (IoT/device IDs).
   */
  private validateMeterId(meterId: string): void {
    const parsed = MeterIdParamSchema.safeParse(meterId);
    if (!parsed.success) {
      throw new ValidationException('Invalid meter ID format');
    }
  }

  /**
   * Validate period param — YYYY-MM format
   */
  private validatePeriod(period: string): void {
    const parsed = PeriodParamSchema.safeParse(period);
    if (!parsed.success) {
      throw new ValidationException('Invalid period format. Use YYYY-MM');
    }
  }

  /**
   * Validate comparison query params — both must be YYYY-MM
   */
  private validateComparisonParams(current: string, previous: string): void {
    const parsed = ComparisonQuerySchema.safeParse({ current, previous });
    if (!parsed.success) {
      throw new ValidationException('Invalid period parameters. Use YYYY-MM format for both current and previous');
    }
  }
}
