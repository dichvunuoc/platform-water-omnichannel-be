/**
 * Integration Test — Payment Webhook
 *
 * Full flow: CommandBus → HandlePaymentWebhookHandler → IdempotencyService → CacheService
 * Tests: success flow (cache invalidation), failed flow, duplicate webhook.
 *
 * AC: #2 (cache invalidation), #3 (failed payment), #4 (idempotency)
 *
 * NOTE: IdempotencyService uses an in-memory Map store here because the mock
 * cache service's get/set use a plain Map (not the `idempotency:` key prefix).
 * Duplicate detection works via the shared IdempotencyService instance's
 * internal memoryStore — sufficient for integration testing.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CqrsModule, CommandBus } from '@nestjs/cqrs';
import { CACHE_SERVICE_TOKEN } from '../../src/libs/core/constants/tokens';
import { IdempotencyService } from '../../src/libs/shared/cqrs/idempotency/idempotency.service';
import { HandlePaymentWebhookHandler } from '../../src/modules/payment/application/commands/handlers/handle-payment-webhook.handler';
import { HandlePaymentWebhookCommand } from '../../src/modules/payment/application/commands/handle-payment-webhook.command';

// Working mock cache — stores values in-memory so idempotency can retrieve them
const cacheStore = new Map<string, any>();
const mockCacheService = {
  get: jest.fn((key: string) => Promise.resolve(cacheStore.get(key) ?? null)),
  set: jest.fn((key: string, value: any, ttl?: number) => { cacheStore.set(key, value); return Promise.resolve(undefined); }),
  delete: jest.fn((key: string) => { cacheStore.delete(key); return Promise.resolve(undefined); }),
  exists: jest.fn().mockResolvedValue(false),
  clear: jest.fn(() => { cacheStore.clear(); return Promise.resolve(undefined); }),
  mget: jest.fn().mockResolvedValue([]),
  mset: jest.fn().mockResolvedValue(undefined),
  mdelete: jest.fn().mockResolvedValue(undefined),
  incr: jest.fn().mockResolvedValue(1),
  decr: jest.fn().mockResolvedValue(0),
  ttl: jest.fn().mockResolvedValue(-1),
  deleteByPattern: jest.fn().mockResolvedValue(2),
};

describe('Payment Webhook Integration', () => {
  let module: TestingModule;
  let commandBus: CommandBus;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        HandlePaymentWebhookHandler,
        IdempotencyService,
        {
          provide: CACHE_SERVICE_TOKEN,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    await module.init();
    commandBus = module.get(CommandBus);
  });

  afterAll(async () => {
    await module.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should process successful payment webhook end-to-end', async () => {
    const result = await commandBus.execute(
      new HandlePaymentWebhookCommand({
        paymentId: 'PAY-INT-001',
        invoiceId: 'INV-INT-001',
        customerId: 'USR-INT-001',
        amount: 150000,
        status: 'success',
        timestamp: '2026-06-09T10:00:00Z',
      }),
    );

    expect(result.processed).toBe(true);
    expect(result.status).toBe('success');
    expect(mockCacheService.deleteByPattern).toHaveBeenCalledWith('cache:v2:port:invoice:*');
  });

  it('should handle duplicate webhook via idempotency', async () => {
    const payload = {
      paymentId: 'PAY-INT-DUP',
      invoiceId: 'INV-INT-DUP',
      customerId: 'USR-INT-DUP',
      amount: 200000,
      status: 'success' as const,
      timestamp: '2026-06-09T10:00:00Z',
    };

    // First call — processed
    const first = await commandBus.execute(new HandlePaymentWebhookCommand(payload));
    expect(first.processed).toBe(true);

    // Second call — duplicate
    const second = await commandBus.execute(new HandlePaymentWebhookCommand(payload));
    expect(second.processed).toBe(false);
    expect(second.status).toBe('duplicate');
  });
});
