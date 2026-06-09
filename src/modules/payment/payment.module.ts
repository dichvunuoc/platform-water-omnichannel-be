/**
 * Payment Module
 *
 * NestJS module for payment + debt operations.
 * Registers MockPaymentAdapter + MockDebtAdapter with PortRegistry via onModuleInit.
 *
 * Two ports, one module:
 *   payment — cacheTier: transaction (NO CACHING, FR35)
 *   debt    — cacheTier: dynamic (5-15 min cache, FR39/FR40)
 *
 * Imports BillingModule to ensure invoice port is registered before
 * payment handler calls it via shared PortRegistry.
 *
 * Story 4.5: Added MockDebtAdapter, DebtController, debt query handlers.
 *
 * Pattern: ...BillingModule → PaymentModule → AuthPropagationModule → PortModule
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { PaymentController } from './infrastructure/http/payment.controller';
import { WebhookController } from './infrastructure/http/webhook.controller';
import { DebtController } from './infrastructure/http/debt.controller';
import { MockPaymentAdapter } from './infrastructure/ports/payment.port';
import { MockDebtAdapter } from './infrastructure/ports/debt.port';
import { PAYMENT_PORT_TOKEN, DEBT_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { CreatePaymentHandler } from './application/commands/handlers/create-payment.handler';
import { HandlePaymentWebhookHandler } from './application/commands/handlers/handle-payment-webhook.handler';
import { CreateBatchPaymentHandler } from './application/commands/handlers/create-batch-payment.handler';
import { SetupAutoDebitHandler } from './application/commands/handlers/setup-auto-debit.handler';
import { GetPaymentHistoryHandler } from './application/queries/handlers/get-payment-history.handler';
import { GetOutstandingDebtHandler } from './application/queries/handlers/get-outstanding-debt.handler';
import { GetDebtHistoryHandler } from './application/queries/handlers/get-debt-history.handler';
import { IdempotencyService } from '@shared/cqrs/idempotency';
import { BillingModule } from '@modules/billing/billing.module';

@Module({
  imports: [BillingModule], // Ensure invoice port is registered in PortRegistry
  controllers: [PaymentController, WebhookController, DebtController],
  providers: [
    // Port Adapters (single instance shared via useExisting)
    MockPaymentAdapter,
    {
      provide: PAYMENT_PORT_TOKEN,
      useExisting: MockPaymentAdapter,
    },
    MockDebtAdapter,
    {
      provide: DEBT_PORT_TOKEN,
      useExisting: MockDebtAdapter,
    },
    // CQRS Command Handlers
    CreatePaymentHandler,
    HandlePaymentWebhookHandler,
    CreateBatchPaymentHandler,
    SetupAutoDebitHandler,
    // CQRS Query Handlers
    GetPaymentHistoryHandler,
    GetOutstandingDebtHandler,
    GetDebtHistoryHandler,
    // Webhook infrastructure
    IdempotencyService,
  ],
  exports: [PAYMENT_PORT_TOKEN, DEBT_PORT_TOKEN],
})
export class PaymentModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockPaymentAdapter: MockPaymentAdapter,
    private readonly mockDebtAdapter: MockDebtAdapter,
  ) {}

  /**
   * Register ports with PortRegistry on module init.
   * Payment: transaction tier — NO CACHE (FR35)
   * Debt: dynamic tier — 5-15 min cache (FR39/FR40)
   */
  onModuleInit() {
    this.portRegistry.register(
      'payment',
      this.mockPaymentAdapter,
      this.mockPaymentAdapter,
    );
    this.portRegistry.register(
      'debt',
      this.mockDebtAdapter,
      this.mockDebtAdapter,
    );
  }
}
