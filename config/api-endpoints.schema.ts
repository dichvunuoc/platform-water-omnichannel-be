/**
 * Zod Schema for api-endpoints.yaml validation
 *
 * Validates the YAML config file structure at startup.
 * Uses Zod v4 API (z.int(), z.enum() as top-level).
 */
import { z } from 'zod';

/**
 * Cache tier enum schema
 */
export const CacheTierSchema = z.enum(['static', 'dynamic', 'transaction']);

/**
 * Circuit breaker configuration schema per port
 */
export const PortCircuitBreakerConfigSchema = z.object({
  errorThreshold: z.number().int().min(1).max(100).default(50),
  resetTimeout: z.number().int().positive().default(10000),
  minRequests: z.number().int().nonnegative().default(5),
});

/**
 * Per-endpoint configuration schema
 */
export const PortEndpointConfigSchema = z.object({
  adapter: z.enum(['mock', 'live']),
  baseUrl: z.string().optional(),
  timeout: z.number().int().positive().default(3000),
  cacheTier: CacheTierSchema,
  cacheTtl: z.number().int().nonnegative().optional(),
  circuitBreaker: PortCircuitBreakerConfigSchema.optional(),
  description: z.string().optional(),
  methods: z.array(z.string()).optional(),
});

/**
 * Root api-endpoints.yaml schema
 */
export const ApiEndpointsSchema = z.object({
  services: z.record(z.string(), PortEndpointConfigSchema),
});
