/**
 * Port Interface Definitions
 *
 * Core abstractions for the Hexagonal Port Registry.
 * Every downstream service call flows through IPort → IPortAdapter.
 *
 * AC: #1 (Port Registry), #4 (Zero-Core-Change Addition)
 */

import type { CacheTier, PortCircuitBreakerConfig } from '../endpoint-config/endpoint-config.interface';
import type { CircuitBreakerOptions } from '../resilience/circuit-breaker.decorator';

/**
 * Adapter interface — implemented by MockAdapterBase and InternalAdapterBase.
 * Each port registers one mock + one live adapter.
 */
export interface IPortAdapter {
  /**
   * Execute a method on this adapter.
   * @param method - The operation name (e.g. 'get-list', 'submit')
   * @param params - Method-specific parameters
   */
  execute(method: string, params: Record<string, unknown>): Promise<unknown>;
}

/**
 * Configuration for a registered port.
 * Combines endpoint config with port-specific settings.
 */
export interface PortConfig {
  /** Port name (must match key in api-endpoints.yaml) */
  name: string;
  /** Cache tier classification */
  cacheTier: CacheTier;
  /** Cache TTL in seconds (0 = no cache) */
  cacheTtl: number;
  /** Per-service timeout in ms */
  timeout: number;
  /** Circuit breaker options (mapped to existing CircuitBreakerOptions) */
  circuitBreaker: CircuitBreakerOptions;
  /** Whether this port is currently active */
  active: boolean;
}

/**
 * A registered port entry in the PortRegistry.
 * Binds a name to its adapters + config + circuit breaker.
 */
export interface PortEntry {
  /** Port name */
  name: string;
  /** Mock adapter instance */
  mockAdapter: IPortAdapter;
  /** Live adapter instance */
  liveAdapter: IPortAdapter;
  /** Port configuration */
  config: PortConfig;
}

/**
 * Metadata attached to a PortResult for observability and client hints.
 *
 * AC: #2 — cachedAt timestamp on fallback/cached responses.
 */
export interface PortResultMetadata {
  /** ISO timestamp when the data was cached (e.g. "updated at 14:30") */
  cachedAt?: string;
  /** True when the response comes from a CB OPEN fallback (degraded state) */
  degraded?: boolean;
  /** Human-readable message explaining degraded/fallback state */
  message?: string;
  /** True when the response was served from inbound idempotency cache */
  fromIdempotency?: boolean;
}

/**
 * Result of a port execution, including metadata about which adapter was used.
 */
export interface PortResult<T> {
  /** The response data */
  data: T;
  /** Which adapter was used: 'mock' or 'live' */
  adapterUsed: 'mock' | 'live';
  /** Whether the result was served from cache */
  fromCache: boolean;
  /** Execution duration in ms */
  duration: number;
  /** Optional metadata for observability and client hints */
  metadata?: PortResultMetadata;
}
