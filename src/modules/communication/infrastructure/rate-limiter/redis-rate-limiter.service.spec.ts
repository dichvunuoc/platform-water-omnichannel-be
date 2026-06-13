import { RedisRateLimiterService } from './redis-rate-limiter.service';

describe('RedisRateLimiterService', () => {
  let service: RedisRateLimiterService;
  let cacheService: { incr: jest.Mock; set: jest.Mock };

  beforeEach(() => {
    cacheService = { incr: jest.fn(), set: jest.fn() };
    service = new RedisRateLimiterService(cacheService as any);
  });

  describe('check — ZNS channel (limit 2)', () => {
    it('should allow first ZNS call', async () => {
      cacheService.incr.mockResolvedValue(1);

      const result = await service.check('USR-001', 'zns');

      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(1);
      expect(result.limit).toBe(2);
    });

    it('should allow second ZNS call', async () => {
      cacheService.incr.mockResolvedValue(2);

      const result = await service.check('USR-001', 'zns');

      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(2);
    });

    it('should block third ZNS call (rate limited)', async () => {
      cacheService.incr.mockResolvedValue(3);

      const result = await service.check('USR-001', 'zns');

      expect(result.allowed).toBe(false);
      expect(result.currentCount).toBe(3);
    });
  });

  describe('check — push channel (limit 50)', () => {
    it('should allow under limit', async () => {
      cacheService.incr.mockResolvedValue(25);

      const result = await service.check('USR-001', 'push');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(50);
    });

    it('should block over limit', async () => {
      cacheService.incr.mockResolvedValue(51);

      const result = await service.check('USR-001', 'push');

      expect(result.allowed).toBe(false);
    });
  });

  describe('check — sms channel (limit 10)', () => {
    it('should allow under limit', async () => {
      cacheService.incr.mockResolvedValue(5);

      const result = await service.check('USR-001', 'sms');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10);
    });
  });

  describe('check — in_app channel (no limit)', () => {
    it('should always allow', async () => {
      const result = await service.check('USR-001', 'in_app');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(Infinity);
      expect(cacheService.incr).not.toHaveBeenCalled();
    });
  });

  describe('TTL management', () => {
    it('should set TTL on first increment', async () => {
      cacheService.incr.mockResolvedValue(1);

      await service.check('USR-001', 'zns');

      expect(cacheService.set).toHaveBeenCalledTimes(1);
      expect(cacheService.set.mock.calls[0][2]).toBe(86400);
    });

    it('should NOT set TTL on subsequent increments', async () => {
      cacheService.incr.mockResolvedValue(2);

      await service.check('USR-001', 'zns');

      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should use per-channel key for INCR', async () => {
      cacheService.incr.mockResolvedValue(1);

      await service.check('USR-001', 'zns');

      const incrKey = cacheService.incr.mock.calls[0][0];
      expect(incrKey).toContain(':zns:');
    });

    it('should use different keys for different channels', async () => {
      cacheService.incr.mockResolvedValue(1);

      await service.check('USR-001', 'zns');
      await service.check('USR-001', 'push');

      const keys = cacheService.incr.mock.calls.map((c: any[]) => c[0]);
      expect(keys[0]).not.toBe(keys[1]);
      expect(keys[0]).toContain(':zns:');
      expect(keys[1]).toContain(':push:');
    });
  });

  describe('getFallbackChain', () => {
    it('should return ZNS → Push → In-App', () => {
      const chain = service.getFallbackChain();

      expect(chain).toEqual(['zns', 'push', 'in_app']);
    });

    it('should return a copy (not mutable)', () => {
      const chain = service.getFallbackChain();
      chain.push('sms');

      const chain2 = service.getFallbackChain();
      expect(chain2).toEqual(['zns', 'push', 'in_app']);
    });
  });
});
