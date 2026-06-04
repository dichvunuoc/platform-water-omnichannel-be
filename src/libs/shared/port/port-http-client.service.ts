/**
 * Port HTTP Client Service
 *
 * Centralized HTTP client for all downstream service calls.
 * Wraps native fetch with:
 * - Per-request timeout via AbortController
 * - JWT injection (prepared for Story 1.4)
 * - Correlation ID propagation from RequestContextProvider
 * - Idempotency key generation for POST/PUT
 *
 * AC: #5 (Per-Service Timeout)
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { REQUEST_CONTEXT_TOKEN } from '../../core';
import type { IRequestContextProvider } from '../../core';
import { StructuredLogger } from '../observability/structured-logger.service';

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
 * AC: #5 — Per-service timeout via AbortController.
 * Timeout error includes correlation ID in structured log.
 */
@Injectable()
export class PortHttpClient {
  private readonly logger = new Logger(PortHttpClient.name);

  constructor(
    @Inject(REQUEST_CONTEXT_TOKEN)
    private readonly requestContext: IRequestContextProvider,
    private readonly structuredLogger: StructuredLogger,
  ) {}

  /**
   * Execute an HTTP request with timeout, correlation ID, and idempotency key.
   */
  async request<T = unknown>(options: PortHttpRequest): Promise<T> {
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

    // Idempotency key for POST/PUT (AC: outbound idempotency boundary)
    if (method === 'POST' || method === 'PUT') {
      headers['x-idempotency-key'] = `${correlationId}:${portName}:${Date.now()}`;
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

      if (!response.ok) {
        this.structuredLogger.warn(`Downstream error [${portName}] ${response.status}`, {
          operation: { name: `${portName}:${method}`, duration },
          trace: { correlationId },
          data: { status: response.status, statusText: response.statusText },
        });

        throw new Error(
          `Downstream call failed [${portName}]: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as T;

      this.logger.debug(`[${portName}] ${method} completed in ${duration}ms`);

      return data;
    } catch (error) {
      const duration = Date.now() - startTime;

      if ((error as Error).name === 'AbortError') {
        // AC: #5 — Timeout with correlation ID logging
        this.structuredLogger.error(
          `Request timeout [${portName}] after ${timeout}ms`,
          error as Error,
          {
            operation: { name: `${portName}:${method}`, duration },
            trace: { correlationId },
            data: { timeout, url: finalUrl },
          },
        );
        throw new Error(
          `Request timeout [${portName}] after ${timeout}ms (correlationId: ${correlationId})`,
        );
      }

      this.structuredLogger.error(
        `Request failed [${portName}]: ${(error as Error).message}`,
        error as Error,
        {
          operation: { name: `${portName}:${method}`, duration },
          trace: { correlationId },
        },
      );
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
