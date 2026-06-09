/**
 * Integration Test — Contract Module
 *
 * Full flow: QueryBus → Handler → PortRegistry → MockAdapter → JSON
 * Verifies that the entire CQRS wiring works end-to-end with real NestJS buses.
 *
 * AC: #1 (contracts list), #2 (detail), #3 (versions), #4 (PDF)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CqrsModule, QueryBus } from '@nestjs/cqrs';
import { EndpointConfigService } from '../../src/libs/shared/endpoint-config/endpoint-config.service';
import { StructuredLogger } from '../../src/libs/shared/observability/structured-logger.service';
import { FallbackProvider } from '../../src/libs/shared/resilience/fallback.provider';
import { PortRegistry } from '../../src/libs/shared/port/port-registry.service';
import { CACHE_SERVICE_TOKEN } from '../../src/libs/core/constants/tokens';
import { MockContractAdapter } from '../../src/modules/contract/infrastructure/ports/contract.port';
import { GetContractsHandler } from '../../src/modules/contract/application/queries/handlers/get-contracts.handler';
import { GetContractDetailHandler } from '../../src/modules/contract/application/queries/handlers/get-contract-detail.handler';
import { GetContractVersionsHandler } from '../../src/modules/contract/application/queries/handlers/get-contract-versions.handler';
import { GetContractPDFHandler } from '../../src/modules/contract/application/queries/handlers/get-contract-pdf.handler';
import { GetContractsQuery } from '../../src/modules/contract/application/queries/get-contracts.query';
import { GetContractDetailQuery } from '../../src/modules/contract/application/queries/get-contract-detail.query';
import { GetContractVersionsQuery } from '../../src/modules/contract/application/queries/get-contract-versions.query';
import { GetContractPDFQuery } from '../../src/modules/contract/application/queries/get-contract-pdf.query';

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

describe('Contract Integration', () => {
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

    const mockAdapter = new MockContractAdapter();
    portRegistry.register('contract', mockAdapter, mockAdapter);

    module = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        { provide: PortRegistry, useValue: portRegistry },
        { provide: CACHE_SERVICE_TOKEN, useValue: mockCacheService },
        MockContractAdapter,
        GetContractsHandler,
        GetContractDetailHandler,
        GetContractVersionsHandler,
        GetContractPDFHandler,
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

  // ── AC#1 ───────────────────────────────────────────────────────────────────

  describe('GET contracts — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return contract list end-to-end', async () => {
      const result = await queryBus.execute(new GetContractsQuery('USR-20240101-0001'));

      expect(result).toBeDefined();
      expect(result.contracts).toBeInstanceOf(Array);
      expect(result.contracts.length).toBeGreaterThan(0);
      expect(result.totalCount).toBeGreaterThan(0);
      expect(result.contracts[0].contractId).toBe('CTR-2024-0001');
      expect(result.contracts[0].subscriptionType).toBe('residential');
    });
  });

  // ── AC#2 ───────────────────────────────────────────────────────────────────

  describe('GET contract detail — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return contract detail end-to-end', async () => {
      const result = await queryBus.execute(new GetContractDetailQuery('USR-20240101-0001', 'CTR-2024-0001'));

      expect(result).toBeDefined();
      expect(result.contractId).toBe('CTR-2024-0001');
      expect(result.pricingTerms).toBeDefined();
      expect(result.pricingTerms.currency).toBe('VND');
      expect(result.specialConditions).toBeInstanceOf(Array);
    });
  });

  // ── AC#3 ───────────────────────────────────────────────────────────────────

  describe('GET contract versions — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return version history end-to-end', async () => {
      const result = await queryBus.execute(new GetContractVersionsQuery('USR-20240101-0001', 'CTR-2024-0001'));

      expect(result).toBeDefined();
      expect(result.versions).toBeInstanceOf(Array);
      expect(result.versions.length).toBeGreaterThan(0);
      expect(result.versions[0].changeDescription).toBeDefined();
    });
  });

  // ── AC#4 ───────────────────────────────────────────────────────────────────

  describe('GET contract PDF — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return PDF download URL end-to-end', async () => {
      const result = await queryBus.execute(new GetContractPDFQuery('USR-20240101-0001', 'CTR-2024-0001'));

      expect(result).toBeDefined();
      expect(result.contractId).toBe('CTR-2024-0001');
      expect(result.downloadUrl).toContain('https://');
      expect(result.fileName).toContain('.pdf');
    });
  });
});
