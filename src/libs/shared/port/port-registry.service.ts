/**
 * Port Registry Service
 *
 * Central registry for all downstream service ports.
 * Routes calls through the correct adapter (mock/live),
 * integrates caching, circuit breaker, and fallback.
 *
 * AC: #1 (Port Registry Init), #2 (MOCK_MODE Override), #4 (Zero-Core-Change)
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_SERVICE_TOKEN } from '../../core';
import type { ICacheService } from '../caching/cache.interface';
import { StructuredLogger } from '../observability/structured-logger.service';
import { EndpointConfigService } from '../endpoint-config/endpoint-config.service';
import { CircuitBreakerState } from '../resilience/circuit-breaker.state';
import { CircuitState } from '../resilience/circuit-breaker.decorator';
import { FallbackProvider } from '../resilience/fallback.provider';
import type { IPortAdapter, PortConfig, PortEntry, PortResult } from './port.interface';
import type { CacheTier } from '../endpoint-config/endpoint-config.interface';

/**
 * Default cache TTLs by tier (in seconds).
 */
const DEFAULT_TTL_BY_TIER: Record<CacheTier, number> = {
  static: 43200,     // 12 hours
  dynamic: 900,      // 15 minutes
  transaction: 0,    // No cache
};

@Injectable()
export class PortRegistry {
  private readonly ports = new Map<string, PortEntry>();
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();
  private readonly logger = new Logger(PortRegistry.name);

  constructor(
    private readonly configService: EndpointConfigService,
    @Inject(CACHE_SERVICE_TOKEN)
    private readonly cacheService: ICacheService,
    private readonly fallbackProvider: FallbackProvider,
    private readonly structuredLogger: StructuredLogger,
  ) {}

  /**
   * Register a new port with mock + live adapters.
   * Creates per-port CircuitBreakerState and registers fallback.
   *
   * AC: #1, #4 — Zero code changes needed to add new ports.
   */
  register(
    name: string,
    mockAdapter: IPortAdapter,
    liveAdapter: IPortAdapter,
    config?: Partial<PortConfig>,
  ): void {
    // Resolve config from endpoint-config service if available
    let resolvedConfig: PortConfig;

    if (this.configService.hasEndpointConfig(name)) {
      const endpointConfig = this.configService.getEndpointConfig(name);
      resolvedConfig = {
        name,
        cacheTier: endpointConfig.cacheTier,
        cacheTtl: endpointConfig.cacheTtl ?? DEFAULT_TTL_BY_TIER[endpointConfig.cacheTier],
        timeout: endpointConfig.timeout,
        circuitBreaker: {
          errorThreshold: endpointConfig.circuitBreaker?.errorThreshold ?? 50,
          resetTimeout: endpointConfig.circuitBreaker?.resetTimeout ?? 10000,
          minRequests: endpointConfig.circuitBreaker?.minRequests ?? 5,
          name,
        },
        active: true,
        ...config,
      };
    } else {
      // Fallback config if no YAML entry
      resolvedConfig = {
        name,
        cacheTier: 'dynamic',
        cacheTtl: 900,
        timeout: 3000,
        circuitBreaker: {
          errorThreshold: 50,
          resetTimeout: 10000,
          minRequests: 5,
          name,
        },
        active: true,
        ...config,
      };
    }

    // Create per-port circuit breaker
    const cb = new CircuitBreakerState(resolvedConfig.circuitBreaker, this.logger);
    this.circuitBreakers.set(name, cb);

    // Register fallback for this port (cache-based fallback)
    this.fallbackProvider.register(name, async (error, _context) => {
      const cached = this.fallbackProvider.getCached(name);
      if (cached) {
        this.logger.warn(`Returning cached fallback for port: ${name}`);
        return cached;
      }
      throw error;
    });

    // Store port entry
    const entry: PortEntry = {
      name,
      mockAdapter,
      liveAdapter,
      config: resolvedConfig,
    };
    this.ports.set(name, entry);

    this.logger.log(`Registered port: ${name} (tier: ${resolvedConfig.cacheTier}, timeout: ${resolvedConfig.timeout}ms)`);
  }

  /**
   * Execute a port call.
   *
   * Flow:
   * 1. Resolve adapter (MOCK_MODE override → config.adapter → mock/live)
   * 2. Check cache (skip if transaction tier)
   * 3. Check circuit breaker state
   * 4. Execute via adapter
   * 5. On success: cache result, record CB success
   * 6. On failure: record CB failure, attempt fallback
   *
   * AC: #1, #2 (MOCK_MODE override), #4
   */
  async execute<T = unknown>(
    portName: string,
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<PortResult<T>> {
    const startTime = Date.now();
    const entry = this.ports.get(portName);

    if (!entry) {
      throw new Error(`Port not registered: ${portName}`);
    }

    // AC: #2 — MOCK_MODE forces mock adapter
    const useMock = this.configService.isMockMode();
    const adapter = useMock ? entry.mockAdapter : entry.liveAdapter;
    const adapterUsed = useMock ? 'mock' as const : 'live' as const;

    // Check cache (skip for transaction tier)
    const cacheKey = this.buildCacheKey(portName, method, params);
    if (entry.config.cacheTier !== 'transaction' && entry.config.cacheTtl > 0) {
      const cached = await this.cacheService.get<T>(cacheKey);
      if (cached) {
        return {
          data: cached,
          adapterUsed,
          fromCache: true,
          duration: Date.now() - startTime,
        };
      }
    }

    // Check circuit breaker
    const cb = this.circuitBreakers.get(portName);
    if (cb) {
      if (cb.getState() === CircuitState.OPEN) {
        if (cb.shouldAttemptReset()) {
          cb.halfOpen();
        } else {
          // Circuit open — try fallback
          return this.executeFallback<T>(portName, entry, adapterUsed, startTime);
        }
      }
    }

    // Execute via adapter
    try {
      const data = (await adapter.execute(method, params)) as T;
      const duration = Date.now() - startTime;

      // Record circuit breaker success
      cb?.recordSuccess();

      // Cache result (skip for transaction tier)
      if (entry.config.cacheTier !== 'transaction' && entry.config.cacheTtl > 0) {
        await this.cacheService.set(cacheKey, data, entry.config.cacheTtl);
      }

      // Cache for fallback use
      this.fallbackProvider.setCached(portName, data);

      return {
        data,
        adapterUsed,
        fromCache: false,
        duration,
      };
    } catch (error) {
      // Record circuit breaker failure
      cb?.recordFailure(error as Error);

      // Check if circuit should open
      if (cb?.shouldOpen()) {
        cb.open();
        this.logger.warn(`Circuit breaker OPENED for port: ${portName}`);
      }

      // Attempt fallback
      return this.executeFallback<T>(portName, entry, adapterUsed, startTime);
    }
  }

  /**
   * Get a registered port entry.
   */
  getPort(name: string): PortEntry | undefined {
    return this.ports.get(name);
  }

  /**
   * Check if a port is registered.
   */
  hasPort(name: string): boolean {
    return this.ports.has(name);
  }

  /**
   * Get all registered port names.
   */
  getPortNames(): string[] {
    return Array.from(this.ports.keys());
  }

  /**
   * Get circuit breaker state for a port.
   */
  getCircuitBreakerState(portName: string): CircuitState | undefined {
    return this.circuitBreakers.get(portName)?.getState();
  }

  /**
   * Execute fallback when circuit breaker is open or call fails.
   */
  private async executeFallback<T>(
    portName: string,
    entry: PortEntry,
    adapterUsed: 'mock' | 'live',
    startTime: number,
  ): Promise<PortResult<T>> {
    try {
      const fallbackData = await this.fallbackProvider.execute(
        portName,
        new Error(`Circuit breaker open or call failed for ${portName}`),
        {
          operation: portName,
          args: [],
          attempt: 1,
          duration: Date.now() - startTime,
          failureType: 'circuit_breaker',
        },
      );

      return {
        data: fallbackData as T,
        adapterUsed,
        fromCache: true,
        duration: Date.now() - startTime,
      };
    } catch (fallbackError) {
      // Fallback also failed — throw original error
      throw new Error(
        `Port call and fallback both failed [${portName}]: ${(fallbackError as Error).message}`,
      );
    }
  }

  /**
   * Build cache key for a port call.
   * Pattern: cache:port:{portName}:{hashOfMethodAndParams}
   */
  private buildCacheKey(
    portName: string,
    method: string,
    params: Record<string, unknown>,
  ): string {
    const paramsHash = this.simpleHash(JSON.stringify({ method, params }));
    return `cache:port:${portName}:${paramsHash}`;
  }

  /**
   * Simple string hash function for cache keys.
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
