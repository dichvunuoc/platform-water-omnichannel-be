/**
 * Integration Test — Tariff Module
 *
 * Full flow: QueryBus → Handler → PortRegistry → MockAdapter → JSON
 * Verifies that the entire CQRS wiring works end-to-end with real NestJS buses.
 *
 * AC: #1 (tariff plan), #2 (tariff breakdown), #3 (applicable fees)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CqrsModule, QueryBus } from '@nestjs/cqrs';
import { EndpointConfigService } from '../../src/libs/shared/endpoint-config/endpoint-config.service';
import { StructuredLogger } from '../../src/libs/shared/observability/structured-logger.service';
import { FallbackProvider } from '../../src/libs/shared/resilience/fallback.provider';
import { PortRegistry } from '../../src/libs/shared/port/port-registry.service';
import { CACHE_SERVICE_TOKEN } from '../../src/libs/core/constants/tokens';
import { MockTariffAdapter } from '../../src/modules/billing/infrastructure/ports/tariff.port';
import { GetTariffPlanHandler } from '../../src/modules/billing/application/queries/handlers/get-tariff-plan.handler';
import { GetTariffBreakdownHandler } from '../../src/modules/billing/application/queries/handlers/get-tariff-breakdown.handler';
import { GetApplicableFeesHandler } from '../../src/modules/billing/application/queries/handlers/get-applicable-fees.handler';
import { GetTariffPlanQuery } from '../../src/modules/billing/application/queries/get-tariff-plan.query';
import { GetTariffBreakdownQuery } from '../../src/modules/billing/application/queries/get-tariff-breakdown.query';
import { GetApplicableFeesQuery } from '../../src/modules/billing/application/queries/get-applicable-fees.query';

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

describe('Tariff Integration', () => {
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

    const mockTariffAdapter = new MockTariffAdapter();
    portRegistry.register('tariff', mockTariffAdapter, mockTariffAdapter);

    module = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        { provide: PortRegistry, useValue: portRegistry },
        { provide: CACHE_SERVICE_TOKEN, useValue: mockCacheService },
        MockTariffAdapter,
        GetTariffPlanHandler,
        GetTariffBreakdownHandler,
        GetApplicableFeesHandler,
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

  // ── AC#1: Tariff Plan (4-tier bậc thang) ────────────────────────────────────

  describe('GET tariff plan — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return 4-tier residential pricing plan end-to-end', async () => {
      const result = await queryBus.execute(
        new GetTariffPlanQuery('USR-001', 'CTR-2024-0001'),
      );

      expect(result).toBeDefined();
      expect(result.planId).toBeDefined();
      expect(result.planName).toBe('Bậc thang sinh hoạt');
      expect(result.customerType).toBe('residential');
      expect(result.tiers).toBeInstanceOf(Array);
      expect(result.tiers).toHaveLength(4);

      const tier1 = result.tiers[0];
      expect(tier1.tier).toBe(1);
      expect(tier1.fromVolume).toBe(0);
      expect(tier1.pricePerM3).toBeGreaterThan(0);

      // Last tier has unlimited toVolume
      expect(result.tiers[result.tiers.length - 1].toVolume).toBeNull();
    });
  });

  // ── AC#2: Tariff Breakdown (invoice-specific) ───────────────────────────────

  describe('GET tariff breakdown — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return invoice breakdown with tier subtotals end-to-end', async () => {
      const result = await queryBus.execute(
        new GetTariffBreakdownQuery('USR-001', 'CTR-2024-0001', 'INV-2025-06-001'),
      );

      expect(result).toBeDefined();
      expect(result.invoiceId).toBe('INV-2025-06-001');
      expect(result.contractId).toBe('CTR-2024-0001');
      expect(result.tiers).toBeInstanceOf(Array);
      expect(result.tiers.length).toBeGreaterThan(0);
      expect(result.totalBeforeFees).toBeGreaterThan(0);

      // Verify subtotals = volume × pricePerM3
      for (const tier of result.tiers) {
        expect(tier.subtotal).toBe(tier.volume * tier.pricePerM3);
      }

      // Verify total = sum of subtotals
      const sumSubtotals = result.tiers.reduce((sum, t) => sum + t.subtotal, 0);
      expect(result.totalBeforeFees).toBe(sumSubtotals);
    });
  });

  // ── AC#3: Applicable Fees ───────────────────────────────────────────────────

  describe('GET applicable fees — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return fees with VAT percentage end-to-end', async () => {
      const result = await queryBus.execute(
        new GetApplicableFeesQuery('USR-001', 'CTR-2024-0001'),
      );

      expect(result).toBeDefined();
      expect(result.contractId).toBe('CTR-2024-0001');
      expect(result.fees).toBeInstanceOf(Array);
      expect(result.fees.length).toBeGreaterThan(0);
      expect(result.vatPercentage).toBeGreaterThanOrEqual(0);

      const fee = result.fees[0];
      expect(['environmental', 'drainage', 'vat', 'surcharge']).toContain(fee.feeType);
      expect(fee.feeName).toBeDefined();
      expect(typeof fee.isPercentage).toBe('boolean');
    });
  });
});
