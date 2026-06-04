/**
 * InternalAdapter Base Class
 *
 * Makes live HTTP calls to downstream services via PortHttpClient.
 * Wraps fetch with per-port timeout (AbortController).
 *
 * AC: #1 (Port Registry), #5 (Per-Service Timeout)
 */

import { Logger } from '@nestjs/common';
import type { IPortAdapter } from './port.interface';
import type { PortHttpClient } from './port-http-client.service';

/**
 * Configuration for constructing the downstream URL.
 */
export interface InternalAdapterConfig {
  /** Port name (matches api-endpoints.yaml key) */
  portName: string;
  /** Base URL for this service */
  baseUrl: string;
  /** Timeout in milliseconds */
  timeout: number;
}

/**
 * Abstract base class for live/internal adapters.
 * Concrete adapters extend this and provide port-specific request building.
 *
 * Usage:
 * ```typescript
 * class InvoiceInternalAdapter extends InternalAdapterBase {
 *   constructor(httpClient: PortHttpClient, logger: Logger) {
 *     super('invoice', httpClient, { baseUrl: '...', timeout: 3000 }, logger);
 *   }
 * }
 * ```
 */
export abstract class InternalAdapterBase implements IPortAdapter {
  protected readonly logger: Logger;

  constructor(
    protected readonly portName: string,
    protected readonly httpClient: PortHttpClient,
    protected readonly config: InternalAdapterConfig,
    logger?: Logger,
  ) {
    this.logger = logger ?? new Logger(`${portName}-internal-adapter`);
  }

  /**
   * Execute a live downstream call.
   * Delegates to PortHttpClient which handles:
   * - Timeout via AbortController
   * - JWT injection (prepared for Story 1.4)
   * - Correlation ID propagation
   * - Idempotency key for POST/PUT
   *
   * AC: #5 — Timeout aborts request and logs with correlation ID.
   */
  async execute(method: string, params: Record<string, unknown>): Promise<unknown> {
    const url = this.buildUrl(method, params);
    const httpMethod = this.resolveHttpMethod(method, params);

    this.logger.debug(`Calling downstream [${this.portName}/${method}] ${httpMethod} ${url}`);

    return this.httpClient.request({
      url,
      method: httpMethod,
      portName: this.portName,
      timeout: this.config.timeout,
      body: httpMethod !== 'GET' ? params : undefined,
      params: httpMethod === 'GET' ? params : undefined,
    });
  }

  /**
   * Build the downstream URL for a method call.
   * Override in subclass for custom URL patterns.
   */
  protected buildUrl(method: string, _params: Record<string, unknown>): string {
    // Default: baseUrl/method
    return `${this.config.baseUrl}/${method}`;
  }

  /**
   * Resolve HTTP method from the operation name.
   * Convention: methods starting with 'get-', 'search', 'list' → GET; others → POST.
   * Override in subclass for custom mapping.
   */
  protected resolveHttpMethod(method: string, _params: Record<string, unknown>): 'GET' | 'POST' | 'PUT' | 'DELETE' {
    if (method.startsWith('get-') || method.startsWith('search') || method.startsWith('list')) {
      return 'GET';
    }
    if (method.startsWith('update') || method.startsWith('edit')) {
      return 'PUT';
    }
    if (method.startsWith('delete') || method.startsWith('remove') || method.startsWith('cancel')) {
      return 'DELETE';
    }
    return 'POST';
  }
}
