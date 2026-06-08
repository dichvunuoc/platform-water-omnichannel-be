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
  /**
   * Explicit HTTP method mapping per operation name.
   * Keys are method names (e.g., 'get-list'), values are HTTP verbs.
   * Unlisted methods default to POST.
   */
  methodMap?: Record<string, 'GET' | 'POST' | 'PUT' | 'DELETE'>;
}

/**
 * Abstract base class for live/internal adapters.
 * Concrete adapters extend this and provide port-specific request building.
 *
 * Usage:
 * ```typescript
 * class InvoiceInternalAdapter extends InternalAdapterBase {
 *   constructor(httpClient: PortHttpClient, logger: Logger) {
 *     super('invoice', httpClient, {
 *       baseUrl: '...',
 *       timeout: 3000,
 *       methodMap: {
 *         'get-list': 'GET',
 *         'get-detail': 'GET',
 *         'download': 'GET',
 *       },
 *     }, logger);
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
    const httpMethod = this.resolveHttpMethod(method);

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
   * Supports {param} and :param placeholder substitution from params.
   * Override in subclass for custom URL patterns.
   *
   * Example:
   *   baseUrl = 'https://api.example.com/invoices'
   *   method = '{id}/detail'
   *   params = { id: 'INV-001' }
   *   → 'https://api.example.com/invoices/INV-001/detail'
   */
  protected buildUrl(method: string, params: Record<string, unknown>): string {
    let url = `${this.config.baseUrl}/${method}`;
    // Replace {key} or :key placeholders with param values
    url = url.replace(/\{(\w+)\}|:(\w+)/g, (_match, braceKey?: string, colonKey?: string) => {
      const key = braceKey || colonKey;
      if (key && params[key] !== undefined && params[key] !== null) {
        return encodeURIComponent(String(params[key]));
      }
      return _match; // Leave placeholder if no param provided
    });
    return url;
  }

  /**
   * Fix #6: Resolve HTTP method — explicit map first, then safe defaults.
   * Checks the methodMap config, falls back to convention, then POST.
   */
  protected resolveHttpMethod(method: string): 'GET' | 'POST' | 'PUT' | 'DELETE' {
    // 1. Explicit method map from config (highest priority)
    if (this.config.methodMap?.[method]) {
      return this.config.methodMap[method];
    }

    // 2. Safe convention-based defaults for known read operations
    if (method.startsWith('get-') || method.startsWith('search') || method.startsWith('list')) {
      return 'GET';
    }
    if (method.startsWith('update') || method.startsWith('edit')) {
      return 'PUT';
    }
    if (method.startsWith('delete') || method.startsWith('remove') || method.startsWith('cancel')) {
      return 'DELETE';
    }

    // 3. Default: POST for all mutations
    return 'POST';
  }
}
