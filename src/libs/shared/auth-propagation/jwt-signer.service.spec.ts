import { JwtSignerService } from './jwt-signer.service';
import { ConfigService } from '@nestjs/config';
import { jwtVerify } from 'jose';

describe('JwtSignerService', () => {
  let service: JwtSignerService;
  let configService: ConfigService;

  const SECRET = 'test-secret-key-that-is-at-least-32-chars-long';
  const OLD_SECRET = 'old-secret-key-that-is-at-least-32-chars-long';

  beforeEach(() => {
    configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return SECRET;
        throw new Error(`Missing: ${key}`);
      }),
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'JWT_SECRET_OLD') return undefined;
        if (key === 'JWT_TTL') return '15m';
        if (key === 'JWT_ISSUER') return 'cskh-bff';
        return defaultValue;
      }),
    } as unknown as ConfigService;

    service = new JwtSignerService(configService);
  });

  const samplePayload = {
    sub: 'user-123',
    roles: ['customer'],
    provider: 'web',
    sessionId: 'session-456',
    xiNghiep: undefined,
  };

  describe('sign', () => {
    it('should sign a JWT with correct payload fields', async () => {
      const token = await service.sign(samplePayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include all required claims in the JWT', async () => {
      const token = await service.sign(samplePayload);
      const secret = new TextEncoder().encode(SECRET);
      const { payload } = await jwtVerify(token, secret, { issuer: 'cskh-bff' });

      expect(payload.sub).toBe('user-123');
      expect(payload.roles).toEqual(['customer']);
      expect(payload.provider).toBe('web');
      expect(payload.session_id).toBe('session-456');
      expect(payload.iss).toBe('cskh-bff');
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
    });

    it('should set expiration to ~15 minutes from now', async () => {
      const token = await service.sign(samplePayload);
      const secret = new TextEncoder().encode(SECRET);
      const { payload } = await jwtVerify(token, secret, { issuer: 'cskh-bff' });

      const now = Math.floor(Date.now() / 1000);
      const exp = payload.exp as number;
      const diff = exp - now;

      // Should be approximately 15 minutes (900 seconds), ±30s tolerance
      expect(diff).toBeGreaterThan(870);
      expect(diff).toBeLessThanOrEqual(900);
    });

    it('should include xi_nghiep when provided', async () => {
      const token = await service.sign({ ...samplePayload, xiNghiep: 'enterprise-1' });
      const secret = new TextEncoder().encode(SECRET);
      const { payload } = await jwtVerify(token, secret, { issuer: 'cskh-bff' });

      expect(payload.xi_nghiep).toBe('enterprise-1');
    });
  });

  describe('verify', () => {
    it('should verify a token signed with the current secret', async () => {
      const token = await service.sign(samplePayload);
      const result = await service.verify(token);

      expect(result.sub).toBe('user-123');
      expect(result.roles).toEqual(['customer']);
      expect(result.provider).toBe('web');
      expect(result.sessionId).toBe('session-456');
    });

    it('should reject an expired token', async () => {
      // Create service with 1-second TTL
      const shortLivedConfig = {
        getOrThrow: jest.fn((key: string) => {
          if (key === 'JWT_SECRET') return SECRET;
          throw new Error(`Missing: ${key}`);
        }),
        get: jest.fn((key: string, defaultValue?: string) => {
          if (key === 'JWT_SECRET_OLD') return undefined;
          if (key === 'JWT_TTL') return '1s';
          if (key === 'JWT_ISSUER') return 'cskh-bff';
          return defaultValue;
        }),
      } as unknown as ConfigService;

      const shortService = new JwtSignerService(shortLivedConfig);
      const token = await shortService.sign(samplePayload);

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 1100));

      await expect(shortService.verify(token)).rejects.toThrow();
    });

    it('should reject a token with wrong secret', async () => {
      const token = await service.sign(samplePayload);

      // Verify with different secret
      const wrongConfig = {
        getOrThrow: jest.fn((key: string) => {
          if (key === 'JWT_SECRET') return 'wrong-secret-key-that-is-different-from-the-rest';
          throw new Error(`Missing: ${key}`);
        }),
        get: jest.fn((key: string, defaultValue?: string) => {
          if (key === 'JWT_SECRET_OLD') return undefined;
          if (key === 'JWT_TTL') return '15m';
          if (key === 'JWT_ISSUER') return 'cskh-bff';
          return defaultValue;
        }),
      } as unknown as ConfigService;

      const wrongService = new JwtSignerService(wrongConfig);
      await expect(wrongService.verify(token)).rejects.toThrow();
    });
  });

  describe('secret rotation', () => {
    it('should verify tokens signed with old secret when rotation is active', async () => {
      // Service with old secret as primary
      const oldServiceConfig = {
        getOrThrow: jest.fn((key: string) => {
          if (key === 'JWT_SECRET') return OLD_SECRET;
          throw new Error(`Missing: ${key}`);
        }),
        get: jest.fn((key: string, defaultValue?: string) => {
          if (key === 'JWT_TTL') return '15m';
          if (key === 'JWT_ISSUER') return 'cskh-bff';
          return defaultValue;
        }),
      } as unknown as ConfigService;
      const oldService = new JwtSignerService(oldServiceConfig);

      // Sign with old secret
      const token = await oldService.sign(samplePayload);

      // Service with new secret + old secret for rotation
      const rotationConfig = {
        getOrThrow: jest.fn((key: string) => {
          if (key === 'JWT_SECRET') return SECRET;
          throw new Error(`Missing: ${key}`);
        }),
        get: jest.fn((key: string, defaultValue?: string) => {
          if (key === 'JWT_SECRET_OLD') return OLD_SECRET;
          if (key === 'JWT_TTL') return '15m';
          if (key === 'JWT_ISSUER') return 'cskh-bff';
          return defaultValue;
        }),
      } as unknown as ConfigService;
      const rotationService = new JwtSignerService(rotationConfig);

      // Should verify — falls back to old secret
      const result = await rotationService.verify(token);
      expect(result.sub).toBe('user-123');
    });

    it('should verify tokens signed with new secret directly', async () => {
      const token = await service.sign(samplePayload);
      const result = await service.verify(token);

      expect(result.sub).toBe('user-123');
    });
  });

  describe('multi-channel', () => {
    it('should produce different JWTs for different providers with same userId', async () => {
      const webToken = await service.sign({ ...samplePayload, provider: 'web' });
      const zaloToken = await service.sign({ ...samplePayload, provider: 'zalo' });

      const webResult = await service.verify(webToken);
      const zaloResult = await service.verify(zaloToken);

      expect(webResult.provider).toBe('web');
      expect(zaloResult.provider).toBe('zalo');
      expect(webResult.sub).toBe(zaloResult.sub); // Same userId
    });
  });
});
