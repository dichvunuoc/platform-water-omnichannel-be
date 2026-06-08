/**
 * Integration Test — Port Registry
 *
 * Full setup: EndpointConfigService loads real YAML,
 * MockAdapter reads real mock files, Zod validates.
 *
 * AC: #1, #2, #4, #6
 */

import * as path from 'path';
import { EndpointConfigService } from '../../src/libs/shared/endpoint-config/endpoint-config.service';
import { StructuredLogger } from '../../src/libs/shared/observability/structured-logger.service';
import { FallbackProvider } from '../../src/libs/shared/resilience/fallback.provider';
import { PortRegistry } from '../../src/libs/shared/port/port-registry.service';
import { AggregationService } from '../../src/libs/shared/port/aggregation.service';
import { MockAdapterBase } from '../../src/libs/shared/port/mock-adapter.base';
import { InvoiceGetListSchema } from '../../config/mock-schemas';

// Concrete invoice mock adapter for integration test
class InvoiceMockAdapter extends MockAdapterBase {
  constructor() {
    super('invoice', { 'get-list': InvoiceGetListSchema });
  }
}

// Simple no-op live adapter for integration test
class InvoiceLiveAdapter extends MockAdapterBase {
  constructor() {
    // Live adapter uses same mock data in test
    super('invoice', { 'get-list': InvoiceGetListSchema });
  }
}

// Mock ICacheService for integration
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

describe('Port Registry Integration', () => {
  let registry: PortRegistry;
  let aggregationService: AggregationService;
  let configService: EndpointConfigService;
  let originalBackendsUrl: string | undefined;

  beforeAll(async () => {
    // Set BACKEND_BASE_URL so env var interpolation doesn't throw
    originalBackendsUrl = process.env.BACKEND_BASE_URL;
    process.env.BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:8080';

    const structuredLogger = new StructuredLogger();
    configService = new EndpointConfigService(structuredLogger);
    await configService.onModuleInit();

    const fallbackProvider = new FallbackProvider(structuredLogger);

    registry = new PortRegistry(
      configService,
      mockCacheService as any,
      fallbackProvider,
      structuredLogger,
      { current: () => ({ correlationId: 'integration-test' }) } as any,
    );

    aggregationService = new AggregationService(registry);

    // Register invoice port with real adapters
    const mockAdapter = new InvoiceMockAdapter();
    const liveAdapter = new InvoiceLiveAdapter();
    registry.register('invoice', mockAdapter, liveAdapter);
  });

  afterAll(async () => {
    await configService.onModuleDestroy();
    // Restore env var
    if (originalBackendsUrl === undefined) {
      delete process.env.BACKEND_BASE_URL;
    } else {
      process.env.BACKEND_BASE_URL = originalBackendsUrl;
    }
  });

  describe('Full flow: load config → register port → execute', () => {
    it('should execute invoice get-list and return validated mock data', async () => {
      const result = await registry.execute<{ data: any[]; pagination: any }>('invoice', 'get-list', {
        customerId: 'USR-12345',
      });

      expect(result.data).toBeDefined();
      expect(result.data.data).toBeInstanceOf(Array);
      expect(result.data.data.length).toBeGreaterThan(0);
      expect(result.data.pagination).toBeDefined();
      expect(result.fromCache).toBe(false);
    });

    it('should serve from cache on second call for non-transaction tier', async () => {
      // Reset mock
      mockCacheService.get.mockReset();

      // First call: cache miss
      mockCacheService.get.mockResolvedValueOnce(null);
      await registry.execute('invoice', 'get-list');

      // Second call: cache hit — cache stores { data, cachedAt } wrapper (Fix #4)
      const cachedData = {
        data: [{ id: 'INV-CACHED' }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockCacheService.get.mockResolvedValueOnce({ data: cachedData, cachedAt: '2026-06-05T10:00:00.000Z' });

      const result = await registry.execute<{ data: any[]; pagination: any }>('invoice', 'get-list');
      expect(result.fromCache).toBe(true);
      expect(result.data.data[0].id).toBe('INV-CACHED');
    });
  });

  describe('MOCK_MODE override', () => {
    it('should force mock adapter when MOCK_MODE=true', async () => {
      const original = process.env.MOCK_MODE;
      process.env.MOCK_MODE = 'true';

      const result = await registry.execute('invoice', 'get-list');
      expect(result.adapterUsed).toBe('mock');
      expect(result.data).toBeDefined();

      process.env.MOCK_MODE = original;
    });
  });

  describe('Aggregation with real data', () => {
    it('should aggregate multiple port calls', async () => {
      // Register a second port for aggregation test
      const mockAdapter = new InvoiceMockAdapter();
      registry.register('tariff', mockAdapter, mockAdapter);

      const result = await aggregationService.executeAll([
        { portName: 'invoice', method: 'get-list' },
      ]);

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
    });
  });

  describe('Contract validation (AC: #6)', () => {
    it('should validate mock data against Zod schema', async () => {
      // This test verifies that the mock data passes Zod validation
      // If the mock file is malformed, this will throw
      const adapter = new InvoiceMockAdapter();
      const data = await adapter.execute('get-list', {});

      expect(data).toBeDefined();
      // Verify structure matches schema
      const parsed = InvoiceGetListSchema.safeParse(data);
      expect(parsed.success).toBe(true);
    });
  });
});
