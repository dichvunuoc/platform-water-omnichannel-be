/**
 * PortHttpClient Tests
 *
 * Story 1-1 AC#8 — Outbound Idempotency
 * Story 1-4 AC#1,#2,#3,#5 — JWT injection, 401 auto-retry, session expired
 *
 * Coverage:
 * - POST/PUT → x-idempotency-key header
 * - GET/DELETE → no idempotency header
 * - Authenticated request → Authorization: Bearer JWT header
 * - Unauthenticated/webhook request → no Authorization header
 * - 401 → regenerate JWT → retry once → success
 * - 401 retry also 401 → PortDownstreamException with "Session expired"
 * - 403 → no retry, immediate PortDownstreamException
 */

import { PortHttpClient } from './port-http-client.service';
import { StructuredLogger } from '../observability/structured-logger.service';
import { JwtSignerService } from '../auth-propagation/jwt-signer.service';
import { PortDownstreamException } from './port-exceptions';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock JwtSignerService
const mockJwtSigner = {
  sign: jest.fn().mockResolvedValue('mock-jwt-token'),
} as unknown as JwtSignerService;

// Mock RequestContextProvider — default: no userId (unauthenticated)
const mockRequestContext = {
  current: jest.fn().mockReturnValue({ correlationId: 'test-correlation-123' }),
  run: jest.fn(),
  create: jest.fn(),
  createFull: jest.fn(),
};

// Helper: create authenticated context with pre-signed JWT in metadata
function authenticatedContext(provider = 'web') {
  return {
    correlationId: 'test-correlation-123',
    userId: 'user-456',
    tenantId: 'tenant-789',
    metadata: {
      roles: ['customer'],
      provider,
      sessionId: 'session-abc',
      signedJwt: 'cached-mock-jwt-token', // Pre-signed by AuthPropagationMiddleware
    },
  };
}

describe('PortHttpClient', () => {
  let client: PortHttpClient;
  let structuredLogger: StructuredLogger;

  beforeEach(() => {
    structuredLogger = new StructuredLogger();
    client = new PortHttpClient(
      mockRequestContext as any,
      structuredLogger,
      mockJwtSigner,
    );

    jest.clearAllMocks();

    // Default mock: successful response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({ data: 'response' }),
    });

    // Default: unauthenticated context
    mockRequestContext.current.mockReturnValue({ correlationId: 'test-correlation-123' });
  });

  // =========================================================================
  // POST requests — AC: #8 (idempotency key)
  // =========================================================================
  describe('POST requests', () => {
    it('should include x-idempotency-key header for POST (AC: #8)', async () => {
      await client.request({
        url: 'http://localhost:8080/payments/initiate',
        method: 'POST',
        portName: 'payment',
        body: { amount: 100 },
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchOptions = mockFetch.mock.calls[0][1];
      const headers = fetchOptions.headers as Record<string, string>;

      expect(headers['x-idempotency-key']).toBeDefined();
      expect(headers['x-idempotency-key']).toContain('test-correlation-123:');
    });

    it('should generate deterministic idempotency key for same body', async () => {
      await client.request({
        url: 'http://localhost:8080/payments/initiate',
        method: 'POST',
        portName: 'payment',
        body: { amount: 100 },
      });

      await client.request({
        url: 'http://localhost:8080/payments/initiate',
        method: 'POST',
        portName: 'payment',
        body: { amount: 100 },
      });

      const key1 = (mockFetch.mock.calls[0][1].headers as Record<string, string>)['x-idempotency-key'];
      const key2 = (mockFetch.mock.calls[1][1].headers as Record<string, string>)['x-idempotency-key'];

      expect(key1).toBe(key2);
    });

    it('should generate different idempotency keys for different bodies', async () => {
      await client.request({
        url: 'http://localhost:8080/payments/initiate',
        method: 'POST',
        portName: 'payment',
        body: { amount: 100 },
      });

      await client.request({
        url: 'http://localhost:8080/payments/initiate',
        method: 'POST',
        portName: 'payment',
        body: { amount: 200 },
      });

      const key1 = (mockFetch.mock.calls[0][1].headers as Record<string, string>)['x-idempotency-key'];
      const key2 = (mockFetch.mock.calls[1][1].headers as Record<string, string>)['x-idempotency-key'];

      expect(key1).not.toBe(key2);
    });
  });

  // =========================================================================
  // PUT requests — AC: #8 (idempotency key)
  // =========================================================================
  describe('PUT requests', () => {
    it('should include x-idempotency-key header for PUT (AC: #8)', async () => {
      await client.request({
        url: 'http://localhost:8080/customers/update',
        method: 'PUT',
        portName: 'customer-profile',
        body: { name: 'John' },
      });

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers['x-idempotency-key']).toBeDefined();
    });
  });

  // =========================================================================
  // GET requests — no idempotency key
  // =========================================================================
  describe('GET requests', () => {
    it('should NOT include x-idempotency-key header for GET (AC: #8)', async () => {
      await client.request({
        url: 'http://localhost:8080/invoices',
        method: 'GET',
        portName: 'invoice',
        params: { customerId: '123' },
      });

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers['x-idempotency-key']).toBeUndefined();
    });

    it('should append query params to URL for GET', async () => {
      await client.request({
        url: 'http://localhost:8080/invoices',
        method: 'GET',
        portName: 'invoice',
        params: { customerId: '123', page: 1 },
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('customerId=123');
      expect(calledUrl).toContain('page=1');
    });
  });

  // =========================================================================
  // DELETE requests — no idempotency key
  // =========================================================================
  describe('DELETE requests', () => {
    it('should NOT include x-idempotency-key header for DELETE (AC: #8)', async () => {
      await client.request({
        url: 'http://localhost:8080/tickets/remove',
        method: 'DELETE',
        portName: 'ticket',
      });

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers['x-idempotency-key']).toBeUndefined();
    });
  });

  // =========================================================================
  // Correlation ID propagation
  // =========================================================================
  describe('correlation ID', () => {
    it('should include x-correlation-id header in all requests', async () => {
      await client.request({
        url: 'http://localhost:8080/test',
        method: 'GET',
        portName: 'test',
      });

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers['x-correlation-id']).toBe('test-correlation-123');
    });

    it('should fall back to no-correlation-id when context is undefined', async () => {
      mockRequestContext.current.mockReturnValueOnce(undefined);

      await client.request({
        url: 'http://localhost:8080/test',
        method: 'GET',
        portName: 'test',
      });

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers['x-correlation-id']).toBe('no-correlation-id');
    });
  });

  // =========================================================================
  // JWT injection — Story 1.4 AC: #1, #5
  // =========================================================================
  describe('JWT injection (Story 1.4)', () => {
    it('should use cached signedJwt from metadata when available (perf optimization)', async () => {
      mockRequestContext.current.mockReturnValue(authenticatedContext());

      await client.request({
        url: 'http://localhost:8080/customers/360',
        method: 'GET',
        portName: 'customer-port',
      });

      // Should NOT call jwtSigner.sign — uses cached JWT from middleware
      expect(mockJwtSigner.sign).not.toHaveBeenCalled();

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer cached-mock-jwt-token');
    });

    it('should fall back to signing when no cached JWT in metadata', async () => {
      mockRequestContext.current.mockReturnValue({
        correlationId: 'test-correlation-123',
        userId: 'user-456',
        tenantId: 'tenant-789',
        metadata: {
          roles: ['customer'],
          provider: 'web',
          sessionId: 'session-abc',
          // No signedJwt — fallback to on-the-fly signing
        },
      });

      await client.request({
        url: 'http://localhost:8080/customers/360',
        method: 'GET',
        portName: 'customer-port',
      });

      expect(mockJwtSigner.sign).toHaveBeenCalledWith({
        sub: 'user-456',
        roles: ['customer'],
        provider: 'web',
        sessionId: 'session-abc',
        xiNghiep: 'tenant-789',
      });

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer mock-jwt-token');
    });

    it('should NOT inject Authorization header when no userId (webhooks/health)', async () => {
      // Default mock has no userId
      await client.request({
        url: 'http://localhost:8080/webhooks/zalo',
        method: 'POST',
        portName: 'webhook-port',
      });

      expect(mockJwtSigner.sign).not.toHaveBeenCalled();

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should use cached JWT with different provider (AC: #4)', async () => {
      mockRequestContext.current.mockReturnValue(authenticatedContext('zalo'));

      await client.request({
        url: 'http://localhost:8080/customers/360',
        method: 'GET',
        portName: 'customer-port',
      });

      // Uses cached signedJwt from metadata — no signing needed
      expect(mockJwtSigner.sign).not.toHaveBeenCalled();

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer cached-mock-jwt-token');
    });

    it('should use default roles/provider when metadata missing', async () => {
      mockRequestContext.current.mockReturnValue({
        correlationId: 'test-correlation-123',
        userId: 'user-456',
        tenantId: undefined,
        metadata: {},
      });

      await client.request({
        url: 'http://localhost:8080/test',
        method: 'GET',
        portName: 'test',
      });

      expect(mockJwtSigner.sign).toHaveBeenCalledWith({
        sub: 'user-456',
        roles: ['customer'],
        provider: 'web',
        sessionId: '',
        xiNghiep: undefined,
      });
    });
  });

  // =========================================================================
  // 401 Auto-Retry — Story 1.4 AC: #2, #3
  // =========================================================================
  describe('401 auto-retry (Story 1.4)', () => {
    it('should regenerate JWT and retry once on 401 (AC: #2)', async () => {
      mockRequestContext.current.mockReturnValue(authenticatedContext());

      // First call: 401, Second call: 200
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({ data: 'retry-success' }),
        });

      const result = await client.request({
        url: 'http://localhost:8080/customers/360',
        method: 'GET',
        portName: 'customer-port',
      });

      // Called twice: initial + retry
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // JWT signed once: only retry regeneration (initial uses cached signedJwt from metadata)
      expect(mockJwtSigner.sign).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: 'retry-success' });
    });

    it('should throw PortDownstreamException when retry also returns 401 (AC: #3)', async () => {
      mockRequestContext.current.mockReturnValue(authenticatedContext());

      // Both calls return 401
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(
        client.request({
          url: 'http://localhost:8080/customers/360',
          method: 'GET',
          portName: 'customer-port',
        }),
      ).rejects.toThrow('Session expired — please re-authenticate');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on 403 (AC: error handling chain)', async () => {
      mockRequestContext.current.mockReturnValue(authenticatedContext());

      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(
        client.request({
          url: 'http://localhost:8080/admin/settings',
          method: 'GET',
          portName: 'admin-port',
        }),
      ).rejects.toThrow();

      // Only called once — no retry
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry 401 when no userId (unauthenticated request)', async () => {
      // Default mock: no userId
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(
        client.request({
          url: 'http://localhost:8080/test',
          method: 'GET',
          portName: 'test',
        }),
      ).rejects.toThrow();

      // Only called once — no retry for unauthenticated requests
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Error handling (general)
  // =========================================================================
  describe('error handling', () => {
    it('should throw on non-2xx response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        client.request({
          url: 'http://localhost:8080/fail',
          method: 'GET',
          portName: 'failing',
        }),
      ).rejects.toThrow('Downstream call failed [failing]: 500 Internal Server Error');
    });
  });
});
