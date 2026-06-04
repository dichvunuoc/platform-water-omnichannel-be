/**
 * Endpoint Configuration Interfaces
 *
 * Defines the types for per-service endpoint configuration
 * loaded from config/api-endpoints.yaml.
 */

/**
 * Cache tier classification for port responses.
 * - static: Long-lived data (identity, contracts) — TTL 12-24h
 * - dynamic: Frequently changing data (tickets, balances) — TTL 5-15 min
 * - transaction: Never cache (payments, documents) — always call live
 */
export type CacheTier = 'static' | 'dynamic' | 'transaction';

/**
 * Circuit breaker configuration per port.
 * Maps to existing CircuitBreakerOptions in resilience module.
 */
export interface PortCircuitBreakerConfig {
  errorThreshold: number;
  resetTimeout: number;
  minRequests: number;
}

/**
 * Per-endpoint/port configuration entry from api-endpoints.yaml.
 */
export interface PortEndpointConfig {
  /** Which adapter to use: 'mock' reads from mocks/, 'live' calls downstream */
  adapter: 'mock' | 'live';
  /** Base URL for live adapter (required when adapter: 'live') */
  baseUrl?: string;
  /** Per-service timeout in milliseconds (default: 3000) */
  timeout: number;
  /** Cache tier classification */
  cacheTier: CacheTier;
  /** Cache TTL in seconds (default by tier: static=43200, dynamic=900, transaction=0) */
  cacheTtl?: number;
  /** Circuit breaker configuration for this port */
  circuitBreaker?: PortCircuitBreakerConfig;
  /** Human-readable description */
  description?: string;
  /** HTTP methods supported by this port */
  methods?: string[];
}

/**
 * Full configuration file shape (api-endpoints.yaml root).
 */
export interface EndpointConfig {
  services: Record<string, PortEndpointConfig>;
}
