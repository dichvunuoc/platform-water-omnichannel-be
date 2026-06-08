/**
 * InboundIdempotencyService Tests
 *
 * AC: #7 — Inbound Idempotency
 * - check() hit/miss
 * - store() with TTL 86400s (24h)
 * - Key format: idempotency:{sha256Hash}
 */

import { createHash } from 'crypto';
import { InboundIdempotencyService } from './inbound-idempotency.service';

// Mock ICacheService
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

describe('InboundIdempotencyService', () => {
  let service: InboundIdempotencyService;

  beforeEach(() => {
    service = new InboundIdempotencyService(mockCacheService as any);
    jest.clearAllMocks();
  });

  // =========================================================================
  // check()
  // =========================================================================
  describe('check', () => {
    it('should return hit=false when no cached result exists (miss)', async () => {
      mockCacheService.get.mockResolvedValueOnce(null);

      const result = await service.check('msg-123');

      expect(result.hit).toBe(false);
      expect(result.data).toBeUndefined();
      expect(mockCacheService.get).toHaveBeenCalledWith(
        expect.stringMatching(/^idempotency:[a-f0-9]{16}$/),
      );
    });

    it('should return hit=true with data when cached result exists (hit)', async () => {
      const cachedData = { status: 'processed', invoiceId: 'INV-001' };
      mockCacheService.get.mockResolvedValueOnce(cachedData);

      const result = await service.check('msg-456');

      expect(result.hit).toBe(true);
      expect(result.data).toEqual(cachedData);
    });

    it('should use SHA-256 hash of raw key as cache key', async () => {
      mockCacheService.get.mockResolvedValueOnce(null);

      const rawKey = 'zalo-message-789';
      await service.check(rawKey);

      const expectedHash = createHash('sha256')
        .update(rawKey)
        .digest('hex')
        .substring(0, 16);
      const expectedKey = `idempotency:${expectedHash}`;

      expect(mockCacheService.get).toHaveBeenCalledWith(expectedKey);
    });

    it('should return miss when cache service throws error', async () => {
      mockCacheService.get.mockRejectedValueOnce(new Error('Redis down'));

      const result = await service.check('msg-error');

      expect(result.hit).toBe(false);
    });

    it('should return miss when cache service is not available', async () => {
      const serviceWithoutCache = new InboundIdempotencyService(undefined as any);
      const result = await serviceWithoutCache.check('msg-no-cache');

      expect(result.hit).toBe(false);
    });

    it('should produce consistent keys for same input', async () => {
      mockCacheService.get.mockResolvedValue(null);

      await service.check('consistent-key');
      await service.check('consistent-key');

      const firstCallKey = mockCacheService.get.mock.calls[0][0];
      const secondCallKey = mockCacheService.get.mock.calls[1][0];

      expect(firstCallKey).toBe(secondCallKey);
    });
  });

  // =========================================================================
  // store()
  // =========================================================================
  describe('store', () => {
    it('should store result with TTL 86400s (24h) (AC: #7)', async () => {
      const result = { status: 'processed' };

      await service.store('msg-123', result);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^idempotency:[a-f0-9]{16}$/),
        result,
        86400,
      );
    });

    it('should use same key format as check()', async () => {
      const rawKey = 'zalo-call-abc';
      const result = { ok: true };

      await service.store(rawKey, result);

      const expectedHash = createHash('sha256')
        .update(rawKey)
        .digest('hex')
        .substring(0, 16);
      const expectedKey = `idempotency:${expectedHash}`;

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expectedKey,
        result,
        86400,
      );
    });

    it('should not throw when cache service throws error', async () => {
      mockCacheService.set.mockRejectedValueOnce(new Error('Redis write failed'));

      await expect(service.store('msg-fail', { data: 'test' })).resolves.not.toThrow();
    });

    it('should be a no-op when cache service is not available', async () => {
      const serviceWithoutCache = new InboundIdempotencyService(undefined as any);

      await expect(
        serviceWithoutCache.store('msg-no-cache', { data: 'test' }),
      ).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // Key format verification
  // =========================================================================
  describe('key format', () => {
    it('should produce idempotency:{sha256Hash} format', async () => {
      mockCacheService.get.mockResolvedValue(null);

      await service.check('test-key');

      const calledKey = mockCacheService.get.mock.calls[0][0] as string;
      const parts = calledKey.split(':');

      expect(parts[0]).toBe('idempotency');
      expect(parts[1]).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should produce different keys for different inputs', async () => {
      mockCacheService.get.mockResolvedValue(null);

      await service.check('key-a');
      await service.check('key-b');

      const keyA = mockCacheService.get.mock.calls[0][0];
      const keyB = mockCacheService.get.mock.calls[1][0];

      expect(keyA).not.toBe(keyB);
    });
  });
});
