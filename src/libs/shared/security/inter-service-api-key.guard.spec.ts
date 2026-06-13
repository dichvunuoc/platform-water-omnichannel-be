import { InterServiceApiKeyGuard } from './inter-service-api-key.guard';
import { ForbiddenException } from '@nestjs/common';

describe('InterServiceApiKeyGuard', () => {
  let guard: InterServiceApiKeyGuard;
  let originalEnv: string | undefined;

  beforeEach(() => {
    guard = new InterServiceApiKeyGuard();
    originalEnv = process.env.INTER_SERVICE_API_KEY;
  });

  afterEach(() => {
    process.env.INTER_SERVICE_API_KEY = originalEnv;
  });

  function mockContext(apiKey?: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: apiKey ? { 'x-api-key': apiKey } : {},
          ip: '127.0.0.1',
          url: '/webhooks/payment/ipn',
        }),
      }),
    } as any;
  }

  // ── Valid key ────────────────────────────────────────────────────────────────

  describe('valid API key', () => {
    it('should allow request with correct API key', () => {
      process.env.INTER_SERVICE_API_KEY = 'test-secret-key';
      expect(guard.canActivate(mockContext('test-secret-key'))).toBe(true);
    });

    it('should handle long API keys', () => {
      const longKey = 'a'.repeat(128);
      process.env.INTER_SERVICE_API_KEY = longKey;
      expect(guard.canActivate(mockContext(longKey))).toBe(true);
    });
  });

  // ── Invalid key ─────────────────────────────────────────────────────────────

  describe('invalid API key', () => {
    it('should throw ForbiddenException with wrong API key', () => {
      process.env.INTER_SERVICE_API_KEY = 'test-secret-key';
      expect(() => guard.canActivate(mockContext('wrong-key'))).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException with different-length key', () => {
      process.env.INTER_SERVICE_API_KEY = 'short';
      expect(() => guard.canActivate(mockContext('much-longer-wrong-key'))).toThrow(ForbiddenException);
    });
  });

  // ── Missing key ─────────────────────────────────────────────────────────────

  describe('missing API key', () => {
    it('should throw ForbiddenException when x-api-key header is missing', () => {
      process.env.INTER_SERVICE_API_KEY = 'test-secret-key';
      expect(() => guard.canActivate(mockContext())).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when INTER_SERVICE_API_KEY env var is not configured', () => {
      delete process.env.INTER_SERVICE_API_KEY;
      expect(() => guard.canActivate(mockContext('any-key'))).toThrow(ForbiddenException);
    });
  });

  // ── Timing-safe verification ─────────────────────────────────────────────────

  describe('timing-safe comparison', () => {
    it('should reject key that differs by one character', () => {
      process.env.INTER_SERVICE_API_KEY = 'test-secret-key-1';
      expect(() => guard.canActivate(mockContext('test-secret-key-2'))).toThrow(ForbiddenException);
    });

    it('should reject empty string key', () => {
      process.env.INTER_SERVICE_API_KEY = 'non-empty-key';
      expect(() => guard.canActivate(mockContext(''))).toThrow(ForbiddenException);
    });
  });

  // ── Logging ─────────────────────────────────────────────────────────────────

  describe('security audit logging', () => {
    it('should log error when env var not configured', () => {
      delete process.env.INTER_SERVICE_API_KEY;
      const errorSpy = jest.spyOn(guard['logger'], 'error');
      try { guard.canActivate(mockContext('any')); } catch {}

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('INTER_SERVICE_API_KEY env var not configured'),
      );
    });

    it('should log warning on invalid API key', () => {
      process.env.INTER_SERVICE_API_KEY = 'valid-key';
      const warnSpy = jest.spyOn(guard['logger'], 'warn');
      try { guard.canActivate(mockContext('bad-key')); } catch {}

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid API key from 127.0.0.1'),
      );
    });
  });
});
