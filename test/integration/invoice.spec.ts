/**
 * Integration Test — Invoice Module
 *
 * Full flow: QueryBus → Handler → PortRegistry → MockAdapter → JSON
 * Verifies that the entire CQRS wiring works end-to-end with real NestJS buses.
 *
 * AC: #1 (invoice list), #2 (invoice detail), #3 (invoice PDF)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CqrsModule, QueryBus } from '@nestjs/cqrs';
import { EndpointConfigService } from '../../src/libs/shared/endpoint-config/endpoint-config.service';
import { StructuredLogger } from '../../src/libs/shared/observability/structured-logger.service';
import { FallbackProvider } from '../../src/libs/shared/resilience/fallback.provider';
import { PortRegistry } from '../../src/libs/shared/port/port-registry.service';
import { CACHE_SERVICE_TOKEN } from '../../src/libs/core/constants/tokens';
import { MockInvoiceAdapter } from '../../src/modules/billing/infrastructure/ports/invoice.port';
import { GetInvoiceListHandler } from '../../src/modules/billing/application/queries/handlers/get-invoice-list.handler';
import { GetInvoiceDetailHandler } from '../../src/modules/billing/application/queries/handlers/get-invoice-detail.handler';
import { GetInvoicePdfHandler } from '../../src/modules/billing/application/queries/handlers/get-invoice-pdf.handler';
import { GetInvoiceListQuery } from '../../src/modules/billing/application/queries/get-invoice-list.query';
import { GetInvoiceDetailQuery } from '../../src/modules/billing/application/queries/get-invoice-detail.query';
import { GetInvoicePdfQuery } from '../../src/modules/billing/application/queries/get-invoice-pdf.query';

const mockCacheService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(false),
  clear: jest.fn().mockResolvedValue(undefined),
  mget: jest.fn().mockResolvedValue([]),
  mset: jest.fn().mockResolvedValue(undefined),
  mdelete: jest.fn().mockResolvedValue(undefined),
  incr: jest.fn().mockResolvedValue(1),
  decr: jest.fn().mockResolvedValue(0),
  ttl: jest.fn().mockResolvedValue(-1),
};

describe('Invoice Integration', () => {
  let module: TestingModule;
  let queryBus: QueryBus;
  let configService: EndpointConfigService;
  let originalBackendsUrl: string | undefined;

  beforeAll(async () => {
    originalBackendsUrl = process.env.BACKEND_BASE_URL;
    process.env.BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:8080';

    const structuredLogger = new StructuredLogger();
    configService = new EndpointConfigService(structuredLogger);
    await configService.onModuleInit();

    const fallbackProvider = new FallbackProvider(structuredLogger);

    const portRegistry = new PortRegistry(
      configService,
      mockCacheService as any,
      fallbackProvider,
      structuredLogger,
      { current: () => ({ correlationId: 'integration-test' }) } as any,
    );

    const mockInvoiceAdapter = new MockInvoiceAdapter();
    portRegistry.register('invoice', mockInvoiceAdapter, mockInvoiceAdapter);

    module = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        { provide: PortRegistry, useValue: portRegistry },
        { provide: CACHE_SERVICE_TOKEN, useValue: mockCacheService },
        MockInvoiceAdapter,
        GetInvoiceListHandler,
        GetInvoiceDetailHandler,
        GetInvoicePdfHandler,
      ],
    }).compile();

    await module.init();
    queryBus = module.get(QueryBus);
  });

  afterAll(async () => {
    await module.close();
    await configService.onModuleDestroy();
    if (originalBackendsUrl === undefined) {
      delete process.env.BACKEND_BASE_URL;
    } else {
      process.env.BACKEND_BASE_URL = originalBackendsUrl;
    }
  });

  // ── AC#1: Invoice List (paginated) ──────────────────────────────────────────

  describe('GET invoice list — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return paginated invoice list end-to-end', async () => {
      const result = await queryBus.execute(
        new GetInvoiceListQuery('USR-001', { page: 1, limit: 10 }),
      );

      expect(result).toBeDefined();
      expect(result.invoices).toBeInstanceOf(Array);
      expect(result.invoices.length).toBeGreaterThan(0);
      expect(result.totalCount).toBeGreaterThan(0);
      expect(result.page).toBeGreaterThanOrEqual(1);
      expect(result.limit).toBeGreaterThanOrEqual(1);
      expect(result.totalPages).toBeGreaterThanOrEqual(1);

      const invoice = result.invoices[0];
      expect(invoice.invoiceId).toBeDefined();
      expect(invoice.period).toMatch(/^\d{4}-\d{2}$/);
      expect(invoice.totalAmount).toBeGreaterThanOrEqual(0);
      expect(['paid', 'unpaid', 'overdue', 'cancelled']).toContain(invoice.paymentStatus);
    });
  });

  // ── AC#2: Invoice Detail ────────────────────────────────────────────────────

  describe('GET invoice detail — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return invoice detail with line items and CQT code end-to-end', async () => {
      const result = await queryBus.execute(
        new GetInvoiceDetailQuery('USR-001', 'INV-2026-001'),
      );

      expect(result).toBeDefined();
      expect(result.invoiceId).toBe('INV-2026-001');
      expect(result.lineItems).toBeInstanceOf(Array);
      expect(result.lineItems.length).toBeGreaterThan(0);
      expect(result.totalAmount).toBeGreaterThanOrEqual(0);
      expect(result.cqtCode).toBeDefined();
      expect(result.lookupCode).toBeDefined();
      expect(result.fees).toBeInstanceOf(Array);
    });
  });

  // ── AC#3: Invoice PDF ───────────────────────────────────────────────────────

  describe('GET invoice PDF — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return PDF URL with CQT code and digital signature end-to-end', async () => {
      const result = await queryBus.execute(
        new GetInvoicePdfQuery('USR-001', 'INV-2026-001'),
      );

      expect(result).toBeDefined();
      expect(result.invoiceId).toBe('INV-2026-001');
      expect(result.pdfUrl).toMatch(/^https?:\/\//);
      expect(result.cqtCode).toBeDefined();
      expect(result.lookupCode).toBeDefined();
      expect(result.digitalSignature).toBeDefined();
    });
  });
});
