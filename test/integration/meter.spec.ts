/**
 * Integration Test — Meter Module
 *
 * Full flow: QueryBus → Handler → PortRegistry → MockAdapter → JSON
 * Verifies that the entire CQRS wiring works end-to-end with real NestJS buses.
 *
 * AC: #1 (meter list — array), #2 (calibration + isWarning), #3 (history)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CqrsModule, QueryBus } from '@nestjs/cqrs';
import { EndpointConfigService } from '../../src/libs/shared/endpoint-config/endpoint-config.service';
import { StructuredLogger } from '../../src/libs/shared/observability/structured-logger.service';
import { FallbackProvider } from '../../src/libs/shared/resilience/fallback.provider';
import { PortRegistry } from '../../src/libs/shared/port/port-registry.service';
import { CACHE_SERVICE_TOKEN } from '../../src/libs/core/constants/tokens';
import { MockMeterAdapter } from '../../src/modules/meter/infrastructure/ports/meter.port';
import { GetMeterByCustomerHandler } from '../../src/modules/meter/application/queries/handlers/get-meter-by-customer.handler';
import { GetCalibrationStatusHandler } from '../../src/modules/meter/application/queries/handlers/get-calibration-status.handler';
import { GetMeterHistoryHandler } from '../../src/modules/meter/application/queries/handlers/get-meter-history.handler';
import { GetMeterByCustomerQuery } from '../../src/modules/meter/application/queries/get-meter-by-customer.query';
import { GetCalibrationStatusQuery } from '../../src/modules/meter/application/queries/get-calibration-status.query';
import { GetMeterHistoryQuery } from '../../src/modules/meter/application/queries/get-meter-history.query';

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

describe('Meter Integration', () => {
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

    const mockAdapter = new MockMeterAdapter();
    portRegistry.register('meter', mockAdapter, mockAdapter);

    module = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        { provide: PortRegistry, useValue: portRegistry },
        { provide: CACHE_SERVICE_TOKEN, useValue: mockCacheService },
        MockMeterAdapter,
        GetMeterByCustomerHandler,
        GetCalibrationStatusHandler,
        GetMeterHistoryHandler,
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

  // ── AC#1: Meter list (1:N — returns array) ──────────────────────────────────

  describe('GET meters — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return meter list end-to-end (1:N array)', async () => {
      const result = await queryBus.execute(new GetMeterByCustomerQuery('USR-12345'));

      expect(result).toBeDefined();
      expect(result.meters).toBeInstanceOf(Array);
      expect(result.meters.length).toBeGreaterThan(0);
      expect(result.totalCount).toBeGreaterThan(0);

      const meter = result.meters[0];
      expect(meter.meterId).toBeDefined();
      expect(meter.serialNumber).toBeDefined();
      expect(meter.type).toBeDefined();
      expect(meter.diameter).toMatch(/^DN\d+$/);
    });

    it('should return multiple meters for a customer (1:N)', async () => {
      const result = await queryBus.execute(new GetMeterByCustomerQuery('USR-12345'));

      expect(result.meters.length).toBeGreaterThanOrEqual(2);
      expect(result.totalCount).toBe(result.meters.length);
    });
  });

  // ── AC#2: Calibration status with isWarning (BFF-computed) ──────────────────

  describe('GET calibration — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return calibration status with isWarning computed by handler', async () => {
      const result = await queryBus.execute(new GetCalibrationStatusQuery('USR-12345', 'MT-001'));

      expect(result).toBeDefined();
      expect(result.meterId).toBe('MT-001');
      expect(['valid', 'expiring_soon', 'expired']).toContain(result.status);
      // isWarning is BFF-computed — must be present in integration test
      expect(result.isWarning).toBeDefined();
      expect(typeof result.isWarning).toBe('boolean');
    });

    it('should compute isWarning=true for expiring_soon status', async () => {
      const result = await queryBus.execute(new GetCalibrationStatusQuery('USR-12345', 'MT-001'));

      // Mock JSON has "expiring_soon" → handler must compute isWarning=true
      expect(result.status).toBe('expiring_soon');
      expect(result.isWarning).toBe(true);
    });
  });

  // ── AC#3: Meter replacement history ─────────────────────────────────────────

  describe('GET meter history — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return meter history entries end-to-end', async () => {
      const result = await queryBus.execute(new GetMeterHistoryQuery('USR-12345', 'MT-001'));

      expect(result).toBeDefined();
      expect(result.entries).toBeInstanceOf(Array);
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.totalCount).toBeGreaterThan(0);

      const entry = result.entries[0];
      expect(entry.eventDate).toBeDefined();
      expect(['installation', 'removal', 'replacement', 'calibration']).toContain(entry.eventType);
      expect(entry.description).toBeDefined();
    });
  });
});
