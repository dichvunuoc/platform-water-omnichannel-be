/**
 * Invoice Controller
 *
 * REST endpoints for invoice operations.
 * Thin pass-through: validates input → dispatches CQRS → returns result.
 *
 * AC: #1 (invoice list — paginated), #2 (invoice detail), #3 (invoice PDF)
 */

import { Controller, Get, Param, Query, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { GetInvoiceListQuery } from '../../application/queries/get-invoice-list.query';
import { GetInvoiceDetailQuery } from '../../application/queries/get-invoice-detail.query';
import { GetInvoicePdfQuery } from '../../application/queries/get-invoice-pdf.query';
import { ValidationException } from '@core/common';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { InvoiceIdParamSchema, InvoiceListQuerySchema } from '../../application/dtos/invoice.dto';

@ApiTags('Billing — Invoice')
@ApiBearerAuth('JWT-auth')
@Controller('billing/invoices')
export class InvoiceController {

  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
  ) {}

  /**
   * GET /billing/invoices?month=YYYY-MM&status=paid|unpaid|overdue&page=1&limit=10
   * Get paginated invoice list with optional filters (AC#1)
   */
  @Get()
  @ApiOperation({ summary: 'Get paginated invoice list' })
  async getInvoiceList(
    @CurrentUser('id') userId: string,
    @Query() query: Record<string, any>,
  ) {
    const validated = InvoiceListQuerySchema.safeParse(query);
    if (!validated.success) {
      throw new ValidationException('Invalid query parameters');
    }
    return this.queryBus.execute(new GetInvoiceListQuery(userId, validated.data));
  }

  /**
   * GET /billing/invoices/:invoiceId
   * Get invoice detail with line items and CQT code (AC#2)
   */
  @Get(':invoiceId')
  @ApiOperation({ summary: 'Get invoice detail' })
  async getInvoiceDetail(
    @CurrentUser('id') userId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    this.validateInvoiceId(invoiceId);
    return this.queryBus.execute(new GetInvoiceDetailQuery(userId, invoiceId));
  }

  /**
   * GET /billing/invoices/:invoiceId/pdf
   * Get e-invoice PDF URL (AC#3)
   */
  @Get(':invoiceId/pdf')
  @ApiOperation({ summary: 'Get invoice PDF download URL' })
  async getInvoicePdf(
    @CurrentUser('id') userId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    this.validateInvoiceId(invoiceId);
    return this.queryBus.execute(new GetInvoicePdfQuery(userId, invoiceId));
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
