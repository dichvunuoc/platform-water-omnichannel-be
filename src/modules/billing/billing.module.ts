/**
 * Billing Module
 *
 * NestJS module for billing operations (tariff & invoice).
 * Registers both tariff and invoice ports with PortRegistry via onModuleInit.
 *
 * Two ports, one module:
 *   - tariff (static cache, 12-24h) — Story 3.2
 *   - invoice (dynamic cache, 5-15 min) — Story 3.3
 *
 * Pattern: AuthModule → CustomerModule → ContractModule → MeterModule → BillingModule → AuthPropagationModule → PortModule
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { TariffController } from './infrastructure/http/tariff.controller';
import { InvoiceController } from './infrastructure/http/invoice.controller';
import { MockTariffAdapter } from './infrastructure/ports/tariff.port';
import { MockInvoiceAdapter } from './infrastructure/ports/invoice.port';
import { TARIFF_PORT_TOKEN, INVOICE_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetTariffPlanHandler } from './application/queries/handlers/get-tariff-plan.handler';
import { GetTariffBreakdownHandler } from './application/queries/handlers/get-tariff-breakdown.handler';
import { GetApplicableFeesHandler } from './application/queries/handlers/get-applicable-fees.handler';
import { GetInvoiceListHandler } from './application/queries/handlers/get-invoice-list.handler';
import { GetInvoiceDetailHandler } from './application/queries/handlers/get-invoice-detail.handler';
import { GetInvoicePdfHandler } from './application/queries/handlers/get-invoice-pdf.handler';

@Module({
  controllers: [TariffController, InvoiceController],
  providers: [
    // Port Adapters (single instance shared via useExisting)
    MockTariffAdapter,
    {
      provide: TARIFF_PORT_TOKEN,
      useExisting: MockTariffAdapter,
    },
    MockInvoiceAdapter,
    {
      provide: INVOICE_PORT_TOKEN,
      useExisting: MockInvoiceAdapter,
    },
    // CQRS Query Handlers
    GetTariffPlanHandler,
    GetTariffBreakdownHandler,
    GetApplicableFeesHandler,
    GetInvoiceListHandler,
    GetInvoiceDetailHandler,
    GetInvoicePdfHandler,
  ],
  exports: [TARIFF_PORT_TOKEN, INVOICE_PORT_TOKEN],
})
export class BillingModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockTariffAdapter: MockTariffAdapter,
    private readonly mockInvoiceAdapter: MockInvoiceAdapter,
  ) {}

  /**
   * Register ports with PortRegistry on module init.
   * Config merges from api-endpoints.yaml.
   */
  onModuleInit() {
    // Port 1: Tariff (static, 12-24h cache) — Story 3.2
    this.portRegistry.register(
      'tariff',
      this.mockTariffAdapter,
      this.mockTariffAdapter,
    );
    // Port 2: Invoice (dynamic, 5-15 min cache) — Story 3.3
    this.portRegistry.register(
      'invoice',
      this.mockInvoiceAdapter,
      this.mockInvoiceAdapter,
    );
  }
}
