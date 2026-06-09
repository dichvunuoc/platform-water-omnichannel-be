import { SessionAuthGuard, AuthenticatedUser } from './session-auth.guard';
import { UnauthorizedException } from '@core/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Helper: create a mock ExecutionContext with given request and optional metadata.
 */
function createMockContext(request: Record<string, unknown> = {}, isPublic = false) {
  const reflector = new Reflector();

  // If isPublic, simulate @Public() decorator by setting metadata
  const handler = jest.fn();
  const controllerClass = { constructor: jest.fn() };

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => handler,
    getClass: () => controllerClass,
  } as any;

  // Spy on reflector to return isPublic when asked
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);

  return { context, reflector };
}

/**
 * Helper: create a mock better-auth instance.
 */
function mockAuthInstance(session: Record<string, unknown> | null, shouldThrow = false) {
  const getSession = jest.fn().mockImplementation(async () => {
    if (shouldThrow) throw new Error('DB connection failed');
    return session;
  });
  return { api: { getSession } } as any;
}

describe('SessionAuthGuard', () => {
  let guard: SessionAuthGuard;
  let authInstance: ReturnType<typeof mockAuthInstance>;
  let reflector: Reflector;

  const validSession = {
    user: { id: 'USR-12345' },
    session: { id: 'SES-67890' },
  };

  beforeEach(() => {
    authInstance = mockAuthInstance(validSession);
    reflector = new Reflector();
    guard = new SessionAuthGuard(authInstance, reflector);
  });

  // ── Valid Session ──────────────────────────────────────────────────────────

  describe('Valid session', () => {
    it('should return true and attach user to request', async () => {
      const request: Record<string, unknown> = { headers: { cookie: 'session=abc' } };
      const { context, reflector: spyReflector } = createMockContext(request);
      // Override guard's reflector with spy version
      const localGuard = new SessionAuthGuard(authInstance, spyReflector);

      const result = await localGuard.canActivate(context);

      expect(result).toBe(true);
      expect((request as any).user).toEqual({
        id: 'USR-12345',
        sessionId: 'SES-67890',
      });
    });

    it('should default sessionId to empty string when session.id is missing', async () => {
      const sessionWithoutSessionId = { user: { id: 'USR-12345' } };
      const localAuth = mockAuthInstance(sessionWithoutSessionId);
      const request: Record<string, unknown> = { headers: {} };
      const { context, reflector: spyReflector } = createMockContext(request);
      const localGuard = new SessionAuthGuard(localAuth, spyReflector);

      const result = await localGuard.canActivate(context);

      expect(result).toBe(true);
      expect((request as any).user).toEqual({
        id: 'USR-12345',
        sessionId: '',
      });
    });
  });

  // ── Invalid Session ────────────────────────────────────────────────────────

  describe('Invalid session', () => {
    it('should throw UnauthorizedException when session is null', async () => {
      const localAuth = mockAuthInstance(null);
      const request: Record<string, unknown> = { headers: {} };
      const { context, reflector: spyReflector } = createMockContext(request);
      const localGuard = new SessionAuthGuard(localAuth, spyReflector);

      await expect(localGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when session has no user.id', async () => {
      const localAuth = mockAuthInstance({ user: {} });
      const request: Record<string, unknown> = { headers: {} };
      const { context, reflector: spyReflector } = createMockContext(request);
      const localGuard = new SessionAuthGuard(localAuth, spyReflector);

      await expect(localGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when session is not an object', async () => {
      const localAuth = mockAuthInstance('not-an-object' as any);
      const request: Record<string, unknown> = { headers: {} };
      const { context, reflector: spyReflector } = createMockContext(request);
      const localGuard = new SessionAuthGuard(localAuth, spyReflector);

      await expect(localGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when getSession throws', async () => {
      const localAuth = mockAuthInstance(null, true);
      const request: Record<string, unknown> = { headers: {} };
      const { context, reflector: spyReflector } = createMockContext(request);
      const localGuard = new SessionAuthGuard(localAuth, spyReflector);

      await expect(localGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── @Public() Decorator ────────────────────────────────────────────────────

  describe('@Public() decorator', () => {
    it('should return true and skip session check when @Public() is set', async () => {
      const request: Record<string, unknown> = { headers: {} };
      const { context, reflector: spyReflector } = createMockContext(request, true);
      const localGuard = new SessionAuthGuard(authInstance, spyReflector);

      const result = await localGuard.canActivate(context);

      expect(result).toBe(true);
      // Should NOT call getSession for public routes
      expect(authInstance.api.getSession).not.toHaveBeenCalled();
      // Should NOT attach user
      expect((request as any).user).toBeUndefined();
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('should throw UnauthorizedException when api.getSession is undefined', async () => {
      const brokenAuth = { api: {} } as any;
      const request: Record<string, unknown> = { headers: {} };
      const { context, reflector: spyReflector } = createMockContext(request);
      const localGuard = new SessionAuthGuard(brokenAuth, spyReflector);

      await expect(localGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when api is undefined', async () => {
      const brokenAuth = {} as any;
      const request: Record<string, unknown> = { headers: {} };
      const { context, reflector: spyReflector } = createMockContext(request);
      const localGuard = new SessionAuthGuard(brokenAuth, spyReflector);

      await expect(localGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });
});
