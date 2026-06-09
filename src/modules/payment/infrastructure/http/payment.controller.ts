/**
 * Payment Controller
 *
 * REST endpoints for payment operations.
 * Thin pass-through: validates input → dispatches CQRS command/query → returns result.
 *
 * AC: #1 (create payment → QR/link), #2 (no cache), #4 (idempotency)
 * Story 4.3: GET /payments/history (AC#1), POST /payments/batch (AC#2)
 *
 * Uses BOTH buses: QUERY_BUS_TOKEN (history — read) + COMMAND_BUS_TOKEN (payments — write).
 * Template: CustomerController (dual bus injection pattern).
 */

import { Controller, Post, Get, Body, Query, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN, COMMAND_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus, ICommandBus } from '@core/application';
import { CreatePaymentCommand } from '../../application/commands/create-payment.command';
import { CreateBatchPaymentCommand } from '../../application/commands/create-batch-payment.command';
import { SetupAutoDebitCommand } from '../../application/commands/setup-auto-debit.command';
import { GetPaymentHistoryQuery } from '../../application/queries/get-payment-history.query';
import {
  CreatePaymentRequestSchema,
  CreateBatchPaymentRequestSchema,
  PaymentHistoryQuerySchema,
  SetupAutoDebitRequestSchema,
} from '../../application/dtos/payment.dto';
import { ValidationException } from '@core/common';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';

@ApiTags('Payment')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentController {

  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  /**
   * POST /payments
   * Initiate payment for an invoice → returns QR code or payment link (AC#1)
   */
  @Post()
  @ApiOperation({ summary: 'Initiate payment for an invoice' })
  async createPayment(
    @CurrentUser('id') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const validated = CreatePaymentRequestSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException('Invalid payment request');
    }
    return this.commandBus.execute(
      new CreatePaymentCommand(userId, validated.data.invoiceId, validated.data.method),
    );
  }

  /**
   * GET /payments/history?page=1&limit=10&status=completed
   * Get payment history (paginated) — AC#1
   */
  @Get('history')
  @ApiOperation({ summary: 'Get payment history (paginated)' })
  async getPaymentHistory(
    @CurrentUser('id') userId: string,
    @Query() query: Record<string, any>,
  ) {
    const validated = PaymentHistoryQuerySchema.safeParse(query);
    if (!validated.success) {
      throw new ValidationException('Invalid query parameters');
    }
    return this.queryBus.execute(new GetPaymentHistoryQuery(userId, validated.data));
  }

  /**
   * POST /payments/batch
   * Pay multiple invoices at once → single QR code / payment link (AC#2)
   */
  @Post('batch')
  @ApiOperation({ summary: 'Pay multiple invoices at once' })
  async createBatchPayment(
    @CurrentUser('id') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const validated = CreateBatchPaymentRequestSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException('Invalid batch payment request');
    }
    return this.commandBus.execute(
      new CreateBatchPaymentCommand(userId, validated.data.invoiceIds, validated.data.method),
    );
  }

  /**
   * POST /payments/auto-debit
   * Register bank account for automatic bill payment (AC#1)
   */
  @Post('auto-debit')
  @ApiOperation({ summary: 'Register auto debit for automatic bill payment' })
  async setupAutoDebit(
    @CurrentUser('id') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const validated = SetupAutoDebitRequestSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException('Invalid auto debit request');
    }
    return this.commandBus.execute(
      new SetupAutoDebitCommand(userId, validated.data.bankAccount),
    );
  }
}
