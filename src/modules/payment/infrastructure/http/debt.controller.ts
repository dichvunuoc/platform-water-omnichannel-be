/**
 * Debt Controller
 *
 * REST endpoints for debt overview operations.
 * Thin pass-through: dispatches CQRS queries → returns result.
 *
 * AC: #1 (outstanding debt with aging), #2 (debt history), #3 (dynamic cache)
 *
 * Uses QUERY_BUS_TOKEN only — both endpoints are reads.
 */

import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { GetOutstandingDebtQuery } from '../../application/queries/get-outstanding-debt.query';
import { GetDebtHistoryQuery } from '../../application/queries/get-debt-history.query';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';

@ApiTags('Payment — Debt')
@ApiBearerAuth('JWT-auth')
@Controller('payments/debt')
export class DebtController {

  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
  ) {}

  /**
   * GET /payments/debt
   * Get outstanding debt with aging buckets (AC#1)
   */
  @Get()
  @ApiOperation({ summary: 'Get outstanding debt with aging buckets' })
  async getOutstandingDebt(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetOutstandingDebtQuery(userId));
  }

  /**
   * GET /payments/debt/history
   * Get chronological debt history (AC#2)
   */
  @Get('history')
  @ApiOperation({ summary: 'Get debt history' })
  async getDebtHistory(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetDebtHistoryQuery(userId));
  }
}
