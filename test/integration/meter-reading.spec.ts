/**
 * Integration Test — Meter Reading Module
 *
 * Full flow: QueryBus → Handler → PortRegistry → MockAdapter → JSON
 * Verifies that the entire CQRS wiring works end-to-end with real NestJS buses.
 *
 * AC: #1 (consumption readings), #2 (comparison with BFF-computed percentage), #3 (reading detail)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CqrsModule, QueryBus } from '@nestjs/cqrs';
import { EndpointConfigService } from '../../src/libs/shared/endpoint-config/endpoint-config.service';
import { StructuredLogger } from '../../src/libs/shared/observability/structured-logger.service';
import { FallbackProvider } from '../../src/libs/shared/resilience/fallback.provider';
import { PortRegistry } from '../../src/libs/shared/port/port-registry.service';
import { CACHE_SERVICE_TOKEN } from '../../src/libs/core/constants/tokens';
import { MockMeterReadingAdapter } from '../../src/modules/meter/infrastructure/ports/meter-reading.port';
import { GetReadingsHandler } from '../../src/modules/meter/application/queries/handlers/get-readings.handler';
import { GetReadingComparisonHandler } from '../../src/modules/meter/application/queries/handlers/get-reading-comparison.handler';
import { GetReadingDetailHandler } from '../../src/modules/meter/application/queries/handlers/get-reading-detail.handler';
import { GetReadingsQuery } from '../../src/modules/meter/application/queries/get-readings.query';
import { GetReadingComparisonQuery } from '../../src/modules/meter/application/queries/get-reading-comparison.query';
import { GetReadingDetailQuery } from '../../src/modules/meter/application/queries/get-reading-detail.query';

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

describe('Meter Reading Integration', () => {
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

    const mockReadingAdapter = new MockMeterReadingAdapter();
    portRegistry.register('meter-reading', mockReadingAdapter, mockReadingAdapter);

    module = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        { provide: PortRegistry, useValue: portRegistry },
        { provide: CACHE_SERVICE_TOKEN, useValue: mockCacheService },
        MockMeterReadingAdapter,
        GetReadingsHandler,
        GetReadingComparisonHandler,
        GetReadingDetailHandler,
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

  // ── AC#1: Consumption readings (12 months for chart) ──────────────────────────

  describe('GET readings — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return 12-month consumption history end-to-end', async () => {
      const result = await queryBus.execute(new GetReadingsQuery('USR-001'));

      expect(result).toBeDefined();
      expect(result.readings).toBeInstanceOf(Array);
      expect(result.readings).toHaveLength(12);
      expect(result.totalCount).toBe(12);

      const reading = result.readings[0];
      expect(reading.month).toMatch(/^\d{4}-\d{2}$/);
      expect(reading.volume).toBeGreaterThanOrEqual(0);
      expect(reading.readingDate).toBeDefined();
    });
  });

  // ── AC#2: Consumption comparison with BFF-computed percentageChange ──────────

  describe('GET comparison — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return comparison with BFF-computed percentageChange + direction', async () => {
      const result = await queryBus.execute(
        new GetReadingComparisonQuery('USR-001', '2025-06', '2025-05'),
      );

      expect(result).toBeDefined();
      expect(result.currentPeriod).toBe('2025-06');
      expect(result.previousPeriod).toBe('2025-05');
      expect(result.currentVolume).toBe(22);
      expect(result.previousVolume).toBe(18);

      // BFF-computed fields
      expect(result.percentageChange).toBe(22.22);
      expect(result.direction).toBe('up');
    });
  });

  // ── AC#3: Reading detail with evidence photos ─────────────────────────────────

  describe('GET reading detail — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return reading detail with evidence photos end-to-end', async () => {
      const result = await queryBus.execute(
        new GetReadingDetailQuery('USR-001', '2025-06'),
      );

      expect(result).toBeDefined();
      expect(result.period).toBe('2025-06');
      expect(result.previousIndex).toBeGreaterThanOrEqual(0);
      expect(result.currentIndex).toBeGreaterThanOrEqual(0);
      expect(result.volume).toBeGreaterThanOrEqual(0);
      expect(result.evidencePhotos).toBeInstanceOf(Array);

      if (result.evidencePhotos.length > 0) {
        const photo = result.evidencePhotos[0];
        expect(photo.url).toBeDefined();
      }
    });

    it('should verify volume equals currentIndex - previousIndex', async () => {
      const result = await queryBus.execute(
        new GetReadingDetailQuery('USR-001', '2025-06'),
      );

      expect(result.volume).toBe(result.currentIndex - result.previousIndex);
    });
  });
});
