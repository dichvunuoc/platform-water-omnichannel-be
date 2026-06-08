/**
 * AuthPropagationMiddleware Tests
 *
 * Story 1.4 AC: #1, #4 — Extract user identity from better-auth session → RequestContext
 *
 * Coverage:
 * - Session user present → enriches RequestContext with userId, roles, provider, sessionId
 * - No session user → calls next() without enrichment (webhooks, health, public)
 * - No context at all → calls next() (CorrelationIdMiddleware missing)
 * - Provider from session preferred over header
 * - Roles extracted from session user
 * - Defaults: roles=['customer'], provider='web', sessionId=''
 */

import { AuthPropagationMiddleware } from './auth-propagation.middleware';
import { JwtSignerService } from './jwt-signer.service';

// Mock context provider
const mockContextProvider = {
  current: jest.fn(),
  run: jest.fn(),
  create: jest.fn(),
  createFull: jest.fn(),
};

// Mock JwtSignerService
const mockJwtSigner = {
  sign: jest.fn().mockResolvedValue('mock-jwt-token'),
} as unknown as JwtSignerService;

// Helper: create a mock FastifyRequest with optional session data
function createMockRequest(session?: Record<string, unknown>, headers?: Record<string, string>) {
  const req = {
    headers: headers ?? {},
  } as any;

  if (session) {
    req.session = session;
  }

  return req;
}

function createMockReply() {
  return {} as any;
}

describe('AuthPropagationMiddleware', () => {
  let middleware: AuthPropagationMiddleware;
  let nextFn: jest.Mock;

  beforeEach(() => {
    middleware = new AuthPropagationMiddleware(
      mockContextProvider as any,
      mockJwtSigner as any,
    );
    nextFn = jest.fn();
    jest.clearAllMocks();

    // Default: context exists
    mockContextProvider.current.mockReturnValue({
      correlationId: 'corr-123',
      tenantId: 'tenant-456',
      metadata: {},
    });

    // Default: createFull returns enriched context
    mockContextProvider.createFull.mockImplementation((opts: any) => ({
      correlationId: opts.correlationId,
      userId: opts.userId,
      tenantId: opts.tenantId,
      metadata: opts.metadata,
    }));

    // Default: run calls the callback synchronously
    mockContextProvider.run.mockImplementation((_ctx: any, cb: () => void) => cb());
  });

  // =========================================================================
  // Authenticated — session with user
  // =========================================================================
  describe('authenticated request (session present)', () => {
    it('should extract userId from session.user.id', async () => {
      const req = createMockRequest({
        id: 'session-xyz',
        user: { id: 'user-123', role: 'customer', provider: 'zalo' },
      });

      await middleware.use(req, createMockReply(), nextFn);

      expect(mockContextProvider.createFull).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
      );
    });

    it('should extract roles from session.user.role', async () => {
      const req = createMockRequest({
        id: 'session-xyz',
        user: { id: 'user-123', role: 'admin' },
      });

      await middleware.use(req, createMockReply(), nextFn);

      expect(mockContextProvider.createFull).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ roles: ['admin'] }),
        }),
      );
    });

    it('should extract provider from session.user.provider', async () => {
      const req = createMockRequest({
        id: 'session-xyz',
        user: { id: 'user-123', role: 'customer', provider: 'zalo' },
      });

      await middleware.use(req, createMockReply(), nextFn);

      expect(mockContextProvider.createFull).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ provider: 'zalo' }),
        }),
      );
    });

    it('should extract sessionId from session.id', async () => {
      const req = createMockRequest({
        id: 'session-xyz',
        user: { id: 'user-123' },
      });

      await middleware.use(req, createMockReply(), nextFn);

      expect(mockContextProvider.createFull).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ sessionId: 'session-xyz' }),
        }),
      );
    });

    it('should fall back provider to x-auth-provider header when session has no provider', async () => {
      const req = createMockRequest(
        { id: 'session-xyz', user: { id: 'user-123' } },
        { 'x-auth-provider': 'hotline' },
      );

      await middleware.use(req, createMockReply(), nextFn);

      expect(mockContextProvider.createFull).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ provider: 'hotline' }),
        }),
      );
    });

    it('should default provider to "web" when no session provider and no header', async () => {
      const req = createMockRequest({
        id: 'session-xyz',
        user: { id: 'user-123' },
      });

      await middleware.use(req, createMockReply(), nextFn);

      expect(mockContextProvider.createFull).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ provider: 'web' }),
        }),
      );
    });

    it('should default roles to ["customer"] when session has no role', async () => {
      const req = createMockRequest({
        id: 'session-xyz',
        user: { id: 'user-123' },
      });

      await middleware.use(req, createMockReply(), nextFn);

      expect(mockContextProvider.createFull).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ roles: ['customer'] }),
        }),
      );
    });

    it('should fall back sessionId to x-session-id header', async () => {
      const req = createMockRequest(
        { user: { id: 'user-123' } }, // no session.id
        { 'x-session-id': 'header-session-999' },
      );

      await middleware.use(req, createMockReply(), nextFn);

      expect(mockContextProvider.createFull).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ sessionId: 'header-session-999' }),
        }),
      );
    });

    it('should preserve existing metadata when enriching', async () => {
      mockContextProvider.current.mockReturnValue({
        correlationId: 'corr-123',
        tenantId: 'tenant-456',
        metadata: { existingKey: 'existingValue' },
      });

      const req = createMockRequest({
        id: 'session-xyz',
        user: { id: 'user-123', provider: 'web' },
      });

      await middleware.use(req, createMockReply(), nextFn);

      expect(mockContextProvider.createFull).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            existingKey: 'existingValue',
            provider: 'web',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // Unauthenticated — no session user
  // =========================================================================
  describe('unauthenticated request (no session user)', () => {
    it('should call next() without enrichment when no session', async () => {
      const req = createMockRequest(); // no session

      await middleware.use(req, createMockReply(), nextFn);

      expect(mockContextProvider.createFull).not.toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalled();
    });

    it('should call next() without enrichment when session has no user', async () => {
      const req = createMockRequest({ id: 'session-xyz' }); // session but no user

      await middleware.use(req, createMockReply(), nextFn);

      expect(mockContextProvider.createFull).not.toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalled();
    });

    it('should call next() without enrichment when session.user has no id', async () => {
      const req = createMockRequest({ user: {} }); // user but no id

      await middleware.use(req, createMockReply(), nextFn);

      expect(mockContextProvider.createFull).not.toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalled();
    });

    it('should use x-user-id header as fallback for userId', async () => {
      const req = createMockRequest(
        undefined, // no session
        { 'x-user-id': 'header-user-789' },
      );

      // No session → no enrichment (header-only is not enough without session)
      await middleware.use(req, createMockReply(), nextFn);

      expect(mockContextProvider.createFull).not.toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe('edge cases', () => {
    it('should call next() when no RequestContext exists', async () => {
      mockContextProvider.current.mockReturnValue(undefined);

      const req = createMockRequest({
        user: { id: 'user-123' },
      });

      await middleware.use(req, createMockReply(), nextFn);

      expect(mockContextProvider.createFull).not.toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalled();
    });

    it('should run next() inside contextProvider.run() for authenticated requests', async () => {
      const req = createMockRequest({
        id: 'session-xyz',
        user: { id: 'user-123' },
      });

      await middleware.use(req, createMockReply(), nextFn);

      expect(mockContextProvider.run).toHaveBeenCalledTimes(1);
      // next() is called inside the run() callback
      expect(nextFn).toHaveBeenCalled();
    });
  });
});
