/**
 * Tariff Controller
 *
 * REST endpoints for tariff/pricing operations.
 * Thin pass-through: validates input → dispatches CQRS → returns result.
 *
 * AC: #1 (tariff plan), #2 (tariff breakdown), #3 (applicable fees)
 */

import { Controller, Get, Param, Query, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { GetTariffPlanQuery } from '../../application/queries/get-tariff-plan.query';
import { GetTariffBreakdownQuery } from '../../application/queries/get-tariff-breakdown.query';
import { GetApplicableFeesQuery } from '../../application/queries/get-applicable-fees.query';
import { ValidationException } from '@core/common';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { ContractIdParamSchema } from '../../application/dtos/tariff.dto';
import { InvoiceIdParamSchema } from '../../application/dtos/invoice.dto';

@ApiTags('Billing — Tariff')
@ApiBearerAuth('JWT-auth')
@Controller('billing/tariff')
export class TariffController {

  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
  ) {}

  /**
   * GET /billing/tariff/:contractId
   * Get tiered pricing plan for a contract (AC#1)
   */
  @Get(':contractId')
  @ApiOperation({ summary: 'Get tariff plan for a contract' })
  async getTariffPlan(
    @CurrentUser('id') userId: string,
    @Param('contractId') contractId: string,
  ) {
    this.validateContractId(contractId);
    return this.queryBus.execute(new GetTariffPlanQuery(userId, contractId));
  }

  /**
   * GET /billing/tariff/:contractId/breakdown?invoiceId=X
   * Get invoice-specific tier breakdown with subtotals (AC#2)
   */
  @Get(':contractId/breakdown')
  @ApiOperation({ summary: 'Get tariff breakdown for an invoice' })
  async getTariffBreakdown(
    @CurrentUser('id') userId: string,
    @Param('contractId') contractId: string,
    @Query('invoiceId') invoiceId: string,
  ) {
    this.validateContractId(contractId);
    this.validateInvoiceId(invoiceId);
    return this.queryBus.execute(new GetTariffBreakdownQuery(userId, contractId, invoiceId));
  }

  /**
   * GET /billing/tariff/:contractId/fees
   * Get applicable fees (environmental, drainage, VAT, surcharges) (AC#3)
   */
  @Get(':contractId/fees')
  @ApiOperation({ summary: 'Get applicable fees for a contract' })
  async getApplicableFees(
    @CurrentUser('id') userId: string,
    @Param('contractId') contractId: string,
  ) {
    this.validateContractId(contractId);
    return this.queryBus.execute(new GetApplicableFeesQuery(userId, contractId));
  }

  /**
   * Validate contractId param — alphanumeric, dashes, underscores
   */
  private validateContractId(contractId: string): void {
    const parsed = ContractIdParamSchema.safeParse(contractId);
    if (!parsed.success) {
      throw new ValidationException('Invalid Contract ID format');
    }
  }

  /**
   * Validate invoiceId param — alphanumeric, dashes, underscores
   */
  private validateInvoiceId(invoiceId: string): void {
    const parsed = InvoiceIdParamSchema.safeParse(invoiceId);
    if (!parsed.success) {
      throw new ValidationException('Invalid Invoice ID format');
    }
  }
}
