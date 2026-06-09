/**
 * Integration Test — Customer Profile Module
 *
 * Full flow: Controller → NestJS QueryBus/CommandBus → Handler → PortRegistry → MockAdapter → JSON
 * Verifies that the entire CQRS wiring works end-to-end with real NestJS buses.
 *
 * AC: #1 (profile), #2 (timeline), #3 (update + cache invalidation), #4 (related accounts)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CqrsModule, QueryBus, CommandBus } from '@nestjs/cqrs';
import { EndpointConfigService } from '../../src/libs/shared/endpoint-config/endpoint-config.service';
import { StructuredLogger } from '../../src/libs/shared/observability/structured-logger.service';
import { FallbackProvider } from '../../src/libs/shared/resilience/fallback.provider';
import { PortRegistry } from '../../src/libs/shared/port/port-registry.service';
import { CACHE_SERVICE_TOKEN } from '../../src/libs/core/constants/tokens';
import { MockCustomerProfileAdapter } from '../../src/modules/customer/infrastructure/ports/customer-profile.port';
import { GetCustomerProfileHandler } from '../../src/modules/customer/application/queries/handlers/get-customer-profile.handler';
import { GetCustomerTimelineHandler } from '../../src/modules/customer/application/queries/handlers/get-customer-timeline.handler';
import { GetRelatedAccountsHandler } from '../../src/modules/customer/application/queries/handlers/get-related-accounts.handler';
import { UpdateCustomerProfileHandler } from '../../src/modules/customer/application/commands/handlers/update-customer-profile.handler';
import { GetCustomerProfileQuery } from '../../src/modules/customer/application/queries/get-customer-profile.query';
import { GetCustomerTimelineQuery } from '../../src/modules/customer/application/queries/get-customer-timeline.query';
import { GetRelatedAccountsQuery } from '../../src/modules/customer/application/queries/get-related-accounts.query';
import { UpdateCustomerProfileCommand } from '../../src/modules/customer/application/commands/update-customer-profile.command';

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

describe('Customer Profile Integration', () => {
  let module: TestingModule;
  let queryBus: QueryBus;
  let commandBus: CommandBus;
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

    const portRegistry = new PortRegistry(
      configService,
      mockCacheService as any,
      fallbackProvider,
      structuredLogger,
      { current: () => ({ correlationId: 'integration-test' }) } as any,
    );

    // Register customer-profile port with mock adapter
    const mockAdapter = new MockCustomerProfileAdapter();
    portRegistry.register('customer-profile', mockAdapter, mockAdapter);

    // Build NestJS test module with real CqrsModule for handler auto-discovery
    module = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        // Port Registry (manually created above)
        {
          provide: PortRegistry,
          useValue: portRegistry,
        },
        // Cache service (mocked)
        {
          provide: CACHE_SERVICE_TOKEN,
          useValue: mockCacheService,
        },
        // CQRS Handlers — discovered by @QueryHandler/@CommandHandler decorators
        GetCustomerProfileHandler,
        GetCustomerTimelineHandler,
        GetRelatedAccountsHandler,
        UpdateCustomerProfileHandler,
      ],
    }).compile();

    // Initialize module so CqrsModule.onModuleInit discovers handlers
    await module.init();

    queryBus = module.get(QueryBus);
    commandBus = module.get(CommandBus);
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

  // ── AC#1: Get Customer Profile ────────────────────────────────────────────

  describe('GET profile — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return validated customer profile end-to-end', async () => {
      const result = await queryBus.execute(new GetCustomerProfileQuery('USR-20240101-0001'));

      expect(result).toBeDefined();
      expect(result.customerId).toBe('USR-20240101-0001');
      expect(result.fullName).toBe('Nguyễn Anh Tuấn');
      expect(result.classification).toBe('sinh_hoat');
      expect(result.address).toBeDefined();
      expect(result.address.fullAddress).toContain('Quận 7');
      expect(result.contactInfo).toBeDefined();
      expect(result.status).toBe('active');
    });
  });

  // ── AC#2: Get Timeline ────────────────────────────────────────────────────

  describe('GET timeline — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return timeline entries end-to-end', async () => {
      const result = await queryBus.execute(new GetCustomerTimelineQuery('USR-20240101-0001'));

      expect(result).toBeDefined();
      expect(result.entries).toBeInstanceOf(Array);
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.totalCount).toBeGreaterThan(0);

      // Verify chronological structure
      const firstEntry = result.entries[0];
      expect(firstEntry.eventType).toBeDefined();
      expect(firstEntry.timestamp).toBeDefined();
      expect(firstEntry.summary).toBeDefined();
    });

    it('should pass filters through the full chain', async () => {
      const result = await queryBus.execute(
        new GetCustomerTimelineQuery('USR-20240101-0001', { channel: 'web' }),
      );

      // Mock adapter ignores filters but the chain completes successfully
      expect(result).toBeDefined();
      expect(result.entries).toBeInstanceOf(Array);
    });
  });

  // ── AC#4: Get Related Accounts ────────────────────────────────────────────

  describe('GET related-accounts — QueryBus → Handler → PortRegistry → MockAdapter → JSON', () => {
    it('should return KCN relationship tree end-to-end', async () => {
      const result = await queryBus.execute(new GetRelatedAccountsQuery('USR-20240101-0001'));

      expect(result).toBeDefined();
      expect(result.accounts).toBeInstanceOf(Array);
      expect(result.accounts.length).toBeGreaterThan(0);

      // Verify KCN relationship structure
      const parentKcn = result.accounts.find(a => a.relationshipType === 'parent_kcn');
      expect(parentKcn).toBeDefined();
      expect(parentKcn!.name).toContain('KCN');

      const memberFactory = result.accounts.find(a => a.relationshipType === 'member_factory');
      expect(memberFactory).toBeDefined();
    });
  });

  // ── AC#3: Update Profile with Cache Invalidation ─────────────────────────

  describe('PUT profile — CommandBus → Handler → update → invalidate → re-fetch', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should update profile, invalidate cache, and return fresh data end-to-end', async () => {
      const result = await commandBus.execute(
        new UpdateCustomerProfileCommand('USR-20240101-0001', { phone: '0912345678' }),
      );

      // Verify handler returned fresh profile data
      expect(result).toBeDefined();
      expect(result.customerId).toBe('USR-20240101-0001');
      expect(result.fullName).toBeDefined();

      // Verify cache invalidation was called (Approach A — precise key)
      expect(mockCacheService.delete).toHaveBeenCalled();
      const deletedKey = mockCacheService.delete.mock.calls[0][0];
      expect(deletedKey).toMatch(/^cache:v2:port:customer-profile:[a-f0-9]{16}$/);
    });
  });
});
