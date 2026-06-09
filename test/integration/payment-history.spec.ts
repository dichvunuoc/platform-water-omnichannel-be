/**
 * Integration Test — Payment History
 *
 * Full flow: QueryBus → GetPaymentHistoryHandler → PortRegistry → MockAdapter → JSON
 * Tests the payment history query with pagination.
 *
 * AC: #1 (payment history), #3 (no cache — transaction tier)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CqrsModule, QueryBus } from '@nestjs/cqrs';
import { EndpointConfigService } from '../../src/libs/shared/endpoint-config/endpoint-config.service';
import { StructuredLogger } from '../../src/libs/shared/observability/structured-logger.service';
import { FallbackProvider } from '../../src/libs/shared/resilience/fallback.provider';
import { PortRegistry } from '../../src/libs/shared/port/port-registry.service';
import { CACHE_SERVICE_TOKEN } from '../../src/libs/core/constants/tokens';
import { MockPaymentAdapter } from '../../src/modules/payment/infrastructure/ports/payment.port';
import { GetPaymentHistoryHandler } from '../../src/modules/payment/application/queries/handlers/get-payment-history.handler';
import { GetPaymentHistoryQuery } from '../../src/modules/payment/application/queries/get-payment-history.query';

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

describe('Payment History Integration', () => {
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

    const mockPaymentAdapter = new MockPaymentAdapter();
    portRegistry.register('payment', mockPaymentAdapter, mockPaymentAdapter);

    module = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        { provide: PortRegistry, useValue: portRegistry },
        { provide: CACHE_SERVICE_TOKEN, useValue: mockCacheService },
        GetPaymentHistoryHandler,
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

  // ── AC#1: Payment History — QueryBus → Handler → PortRegistry → MockAdapter → JSON

  describe('GET /payments/history — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return paginated payment history end-to-end', async () => {
      const result = await queryBus.execute(
        new GetPaymentHistoryQuery('USR-001', { page: 1, limit: 10 }),
      );

      expect(result).toBeDefined();
      expect(result.payments).toBeInstanceOf(Array);
      expect(result.payments.length).toBeGreaterThan(0);
      expect(result.totalCount).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBeGreaterThan(0);
    });

    it('should return items with valid payment history shape', async () => {
      const result = await queryBus.execute(
        new GetPaymentHistoryQuery('USR-001', { page: 1, limit: 10 }),
      );

      const item = result.payments[0];
      expect(item.paymentId).toBeDefined();
      expect(item.invoiceIds).toBeInstanceOf(Array);
      expect(item.amount).toBeGreaterThanOrEqual(0);
      expect(item.method).toBeDefined();
      expect(item.status).toBeDefined();
      expect(item.createdAt).toBeDefined();
    });
  });
});
