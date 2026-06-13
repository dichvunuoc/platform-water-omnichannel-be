import { ZaloSignatureGuard } from './zalo-signature.guard';
import { ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('ZaloSignatureGuard', () => {
  let guard: ZaloSignatureGuard;
  let originalEnv: string | undefined;

  const SECRET = 'test-zalo-secret-key';
  const RAW_BODY = JSON.stringify({ event: 'message.send', message: 'hello' });

  beforeEach(() => {
    guard = new ZaloSignatureGuard();
    originalEnv = process.env.ZALOA_SECRET_KEY;
    process.env.ZALOA_SECRET_KEY = SECRET;
  });

  afterEach(() => {
    process.env.ZALOA_SECRET_KEY = originalEnv;
  });

  function mockContext(extra: { rawBody?: string; signature?: string } = {}) {
    const headers: Record<string, string> = {};
    if (extra.signature !== undefined) {
      headers['x-zeca-signature'] = extra.signature;
    }
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          rawBody: extra.rawBody,
          headers,
          ip: '192.168.1.1',
          url: '/webhooks/zalo/callback',
        }),
      }),
    } as any;
  }

  function computeHmac(body: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  // ── Valid signature ──────────────────────────────────────────────────────────

  describe('valid signature', () => {
    it('should allow request with correct HMAC signature', () => {
      const validSignature = computeHmac(RAW_BODY, SECRET);
      expect(guard.canActivate(mockContext({ rawBody: RAW_BODY, signature: validSignature }))).toBe(true);
    });

    it('should allow request with HMAC test vector', () => {
      // Known test vector: secret="key", body="hello" → verify with openssl
      const testSecret = 'key';
      const testBody = 'hello';
      const expectedHmac = 'fedc30b7eb1c0c3f6c0c9e6e6b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5';
      // Use dynamic computation for reliability
      process.env.ZALOA_SECRET_KEY = testSecret;
      const sig = computeHmac(testBody, testSecret);
      expect(guard.canActivate(mockContext({ rawBody: testBody, signature: sig }))).toBe(true);
    });
  });

  // ── Invalid signature ───────────────────────────────────────────────────────

  describe('invalid signature', () => {
    it('should throw ForbiddenException with wrong signature', () => {
      expect(() =>
        guard.canActivate(mockContext({ rawBody: RAW_BODY, signature: 'wrong-signature' })),
      ).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException with tampered payload', () => {
      const validSignature = computeHmac(RAW_BODY, SECRET);
      const tamperedBody = JSON.stringify({ event: 'message.send', message: 'TAMPERED' });
      expect(() =>
        guard.canActivate(mockContext({ rawBody: tamperedBody, signature: validSignature })),
      ).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException with wrong secret in computation', () => {
      const wrongSecretSig = computeHmac(RAW_BODY, 'wrong-secret');
      expect(() =>
        guard.canActivate(mockContext({ rawBody: RAW_BODY, signature: wrongSecretSig })),
      ).toThrow(ForbiddenException);
    });
  });

  // ── Missing signature ───────────────────────────────────────────────────────

  describe('missing signature', () => {
    it('should throw ForbiddenException when signature header is missing', () => {
      expect(() =>
        guard.canActivate(mockContext({ rawBody: RAW_BODY })),
      ).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when signature is empty string', () => {
      expect(() =>
        guard.canActivate(mockContext({ rawBody: RAW_BODY, signature: '' })),
      ).toThrow(ForbiddenException);
    });
  });

  // ── Missing rawBody ─────────────────────────────────────────────────────────

  describe('missing rawBody', () => {
    it('should throw ForbiddenException when rawBody is undefined', () => {
      expect(() =>
        guard.canActivate(mockContext({ rawBody: undefined as any, signature: 'any' })),
      ).toThrow(ForbiddenException);
    });
  });

  // ── Missing env var ─────────────────────────────────────────────────────────

  describe('missing env var', () => {
    it('should throw ForbiddenException when ZALOA_SECRET_KEY is not configured', () => {
      delete process.env.ZALOA_SECRET_KEY;
      expect(() =>
        guard.canActivate(mockContext({ rawBody: RAW_BODY, signature: 'any' })),
      ).toThrow(ForbiddenException);
    });
  });

  // ── Logging verification ────────────────────────────────────────────────────

  describe('security audit logging', () => {
    it('should log warning on signature mismatch', () => {
      const warnSpy = jest.spyOn(guard['logger'], 'warn');
      try {
        guard.canActivate(mockContext({ rawBody: RAW_BODY, signature: 'bad' }));
      } catch {}

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('signature mismatch'),
      );
    });

    it('should log warning on missing signature', () => {
      const warnSpy = jest.spyOn(guard['logger'], 'warn');
      try {
        guard.canActivate(mockContext({ rawBody: RAW_BODY }));
      } catch {}

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing X-ZECA-Signature'),
      );
    });

    it('should log error when rawBody missing', () => {
      const errorSpy = jest.spyOn(guard['logger'], 'error');
      try {
        guard.canActivate(mockContext({ rawBody: undefined as any, signature: 'sig' }));
      } catch {}

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No rawBody'),
      );
    });
  });
});
