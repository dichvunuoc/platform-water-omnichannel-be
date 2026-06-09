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

  it('should allow request with correct API key', () => {
    process.env.INTER_SERVICE_API_KEY = 'test-secret-key';
    expect(guard.canActivate(mockContext('test-secret-key'))).toBe(true);
  });

  it('should throw ForbiddenException with wrong API key', () => {
    process.env.INTER_SERVICE_API_KEY = 'test-secret-key';
    expect(() => guard.canActivate(mockContext('wrong-key'))).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when x-api-key header is missing', () => {
    process.env.INTER_SERVICE_API_KEY = 'test-secret-key';
    expect(() => guard.canActivate(mockContext())).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when INTER_SERVICE_API_KEY env var is not configured', () => {
    delete process.env.INTER_SERVICE_API_KEY;
    expect(() => guard.canActivate(mockContext('any-key'))).toThrow(ForbiddenException);
  });
});
