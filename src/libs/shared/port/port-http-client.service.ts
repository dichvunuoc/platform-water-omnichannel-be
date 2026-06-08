/**
 * Port HTTP Client Service
 *
 * Centralized HTTP client for all downstream service calls.
 * Wraps native fetch with:
 * - JWT injection via jose (Story 1.4 — BFF→downstream identity propagation)
 * - Auto-retry on 401 with JWT regeneration
 * - Per-request timeout via AbortController
 * - Correlation ID propagation from RequestContextProvider
 * - Idempotency key generation for POST/PUT
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { REQUEST_CONTEXT_TOKEN } from '../../core';
import type { IRequestContextProvider } from '../../core';
import { StructuredLogger } from '../observability/structured-logger.service';
import { PortDownstreamException, PortTimeoutException } from './port-exceptions';
import { generateShortHash } from '../utils/hash.util';
import { JwtSignerService } from '../auth-propagation/jwt-signer.service';

/**
 * Request options for PortHttpClient.
 */
export interface PortHttpRequest {
  /** Full URL to call */
  url: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Port name for logging/correlation */
  portName: string;
  /** Timeout in milliseconds (default: 3000) */
  timeout?: number;
  /** Request body (for POST/PUT) */
  body?: Record<string, unknown>;
  /** Query parameters (for GET) */
  params?: Record<string, unknown>;
}

/**
 * Port HTTP Client — all downstream calls go through this service.
 *
 * AC#1: JWT injection on all downstream calls
 * AC#2: Auto-refresh on 401 (retry once)
 * AC#3: Structured 401 on retry failure
 * AC#5: Automatic JWT injection on all downstream calls
 */
@Injectable()
export class PortHttpClient {
  private readonly logger = new Logger(PortHttpClient.name);

  constructor(
    @Inject(REQUEST_CONTEXT_TOKEN)
    private readonly requestContext: IRequestContextProvider,
    private readonly structuredLogger: StructuredLogger,
    private readonly jwtSigner: JwtSignerService,
  ) {}

  /**
   * Execute an HTTP request with timeout, JWT, correlation ID, and idempotency key.
   */
  async request<T = unknown>(options: PortHttpRequest): Promise<T> {
    return this.requestInternal<T>(options, false);
  }

  /**
   * Internal request method with retry tracking.
   * @param options - Request options
   * @param isRetry - Whether this is a 401 retry
   */
  private async requestInternal<T = unknown>(
    options: PortHttpRequest,
    isRetry: boolean,
  ): Promise<T> {
    const {
      url,
      method,
      portName,
      timeout = 3000,
      body,
      params,
    } = options;

    const context = this.requestContext.current();
    const correlationId = context?.correlationId ?? 'no-correlation-id';

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-correlation-id': correlationId,
    };

    // AC#5: JWT injection — use pre-signed JWT from AuthPropagationMiddleware if available.
    // The middleware signs JWT once per request and caches it in metadata.signedJwt,
    // avoiding redundant HS256 signing during AggregationService fan-out (5+ parallel calls).
    // Falls back to signing on-the-fly if cached JWT is not available.
    if (context?.userId) {
      const cachedJwt = context.metadata?.signedJwt as string | undefined;
      const jwt = cachedJwt ?? await this.jwtSigner.sign({
        sub: context.userId,
        roles: (context.metadata?.roles as string[]) ?? ['customer'],
        provider: (context.metadata?.provider as string) ?? 'web',
        sessionId: (context.metadata?.sessionId as string) ?? '',
        xiNghiep: context.tenantId,
      });
      headers['Authorization'] = `Bearer ${jwt}`;
    }

    // Idempotency key for POST/PUT
    if (method === 'POST' || method === 'PUT') {
      const payload = JSON.stringify({ portName, method, body: body ?? {} });
      const opHash = generateShortHash(payload);
      headers['x-idempotency-key'] = `${correlationId}:${opHash}`;
    }

    // Build URL with query params for GET
    let finalUrl = url;
    if (params && method === 'GET') {
      const queryString = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      if (queryString) {
        finalUrl = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
      }
    }

    // AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const startTime = Date.now();

    try {
      this.logger.debug(`[${portName}] ${method} ${finalUrl} (timeout: ${timeout}ms)`);

      const response = await fetch(finalUrl, {
        method,
        headers,
        body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const duration = Date.now() - startTime;

      // AC#2: Auto-refresh on 401 — retry once with regenerated JWT
      if (response.status === 401 && !isRetry && context?.userId) {
        this.structuredLogger.warn(
          `Downstream 401 — regenerating JWT and retrying [${portName}]`,
          {
            operation: { name: `${portName}:${method}`, duration },
            trace: { correlationId },
          },
        );

        // Regenerate JWT (context may have been refreshed by middleware)
        const newContext = this.requestContext.current();
        if (newContext?.userId) {
          const newJwt = await this.jwtSigner.sign({
            sub: newContext.userId,
            roles: (newContext.metadata?.roles as string[]) ?? ['customer'],
            provider: (newContext.metadata?.provider as string) ?? 'web',
            sessionId: (newContext.metadata?.sessionId as string) ?? '',
            xiNghiep: newContext.tenantId,
          });
          headers['Authorization'] = `Bearer ${newJwt}`;
        }

        // Retry the request with new JWT
        return this.retryRequest<T>(options, headers, controller, timeoutId);
      }

      // AC#3: Retry also returned 401 — structured error to frontend
      if (response.status === 401 && isRetry) {
        this.structuredLogger.warn(
          `Auth propagation failed after retry [${portName}]`,
          {
            operation: { name: `${portName}:${method}`, duration },
            trace: { correlationId },
          },
        );
        throw new PortDownstreamException(
          portName,
          401,
          'Session expired — please re-authenticate',
          finalUrl,
        );
      }

      if (!response.ok) {
        this.structuredLogger.warn(`Downstream error [${portName}] ${response.status}`, {
          operation: { name: `${portName}:${method}`, duration },
          trace: { correlationId },
          data: { status: response.status, statusText: response.statusText },
        });

        throw new PortDownstreamException(portName, response.status, response.statusText, finalUrl);
      }

      // Parse response JSON
      let data: T;
      try {
        data = (await response.json()) as T;
      } catch (parseError) {
        this.structuredLogger.warn(
          `Invalid JSON response [${portName}] status=${response.status}`,
          {
            operation: { name: `${portName}:${method}`, duration },
            trace: { correlationId },
            data: { parseError: (parseError as Error).message },
          },
        );
        throw new PortDownstreamException(portName, 502, 'Invalid JSON response body', finalUrl);
      }

      this.logger.debug(`[${portName}] ${method} completed in ${duration}ms`);

      return data;
    } catch (error) {
      const duration = Date.now() - startTime;

      if ((error as Error).name === 'AbortError') {
        this.structuredLogger.error(
          `Request timeout [${portName}] after ${timeout}ms`,
          error as Error,
          {
            operation: { name: `${portName}:${method}`, duration },
            trace: { correlationId },
            data: { timeout, url: finalUrl },
          },
        );
        throw new PortTimeoutException(portName, timeout);
      }

      if (!(error instanceof PortDownstreamException) && !(error instanceof PortTimeoutException)) {
        this.structuredLogger.error(
          `Request failed [${portName}]: ${(error as Error).message}`,
          error as Error,
          {
            operation: { name: `${portName}:${method}`, duration },
            trace: { correlationId },
          },
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Execute retry request with updated headers.
   * Separate method to create new AbortController and timeout.
   */
  private async retryRequest<T>(
    options: PortHttpRequest,
    headers: Record<string, string>,
    _originalController: AbortController,
    _originalTimeoutId: ReturnType<typeof setTimeout>,
  ): Promise<T> {
    const { url, method, portName, timeout = 3000, body, params } = options;

    // Build URL with query params for GET
    let finalUrl = url;
    if (params && method === 'GET') {
      const queryString = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      if (queryString) {
        finalUrl = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
      }
    }

    const retryController = new AbortController();
    const retryTimeoutId = setTimeout(
      () => retryController.abort(),
      timeout,
    );

    try {
      const response = await fetch(finalUrl, {
        method,
        headers,
        body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
        signal: retryController.signal,
      });

      // Handle retry response
      if (response.status === 401) {
        // AC#3: Retry also 401 — throw structured error
        const context = this.requestContext.current();
        throw new PortDownstreamException(
          portName,
          401,
          'Session expired — please re-authenticate',
          finalUrl,
        );
      }

      if (!response.ok) {
        throw new PortDownstreamException(
          portName,
          response.status,
          response.statusText,
          finalUrl,
        );
      }

      let data: T;
      try {
        data = (await response.json()) as T;
      } catch {
        throw new PortDownstreamException(portName, 502, 'Invalid JSON response body', finalUrl);
      }

      return data;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new PortTimeoutException(portName, timeout);
      }
      throw error;
    } finally {
      clearTimeout(retryTimeoutId);
    }
  }
}
