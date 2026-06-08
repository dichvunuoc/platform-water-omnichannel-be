/**
 * AggregationService Tests
 *
 * AC: #4 — Promise.allSettled with partial failures
 */

import { Logger } from '@nestjs/common';
import { EndpointConfigService } from '../endpoint-config/endpoint-config.service';
import { StructuredLogger } from '../observability/structured-logger.service';
import { FallbackProvider } from '../resilience/fallback.provider';
import { AggregationService } from './aggregation.service';
import { PortRegistry } from './port-registry.service';
import type { IPortAdapter } from './port.interface';

// Mock ICacheService
const mockCacheService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(false),
  clear: jest.fn().mockResolvedValue(undefined),
  mget: jest.fn().mockResolvedValue([]),
  mset: jest.fn().mockResolvedValue(undefined),
  mdelete: jest.fn().mockResolvedValue(undefined),
  incr: jest.fn().mockResolvedValue(1),
  decr: jest.fn().mockResolvedValue(0),
  ttl: jest.fn().mockResolvedValue(-1),
};

describe('AggregationService', () => {
  let aggregationService: AggregationService;
  let portRegistry: PortRegistry;

  beforeEach(() => {
    const structuredLogger = new StructuredLogger();
    const configService = new EndpointConfigService(structuredLogger);
    const fallbackProvider = new FallbackProvider(structuredLogger);

    portRegistry = new PortRegistry(
      configService,
      mockCacheService as any,
      fallbackProvider,
      structuredLogger,
      { current: () => ({ correlationId: 'test' }) } as any,
    );

    aggregationService = new AggregationService(portRegistry);
    jest.clearAllMocks();
  });

  describe('executeAll — all succeed', () => {
    it('should return all successful results when all calls succeed', async () => {
      const successAdapter: IPortAdapter = {
        execute: jest.fn().mockResolvedValue({ items: [] }),
      };

      portRegistry.register('port-a', successAdapter, successAdapter, {
        cacheTier: 'dynamic',
        cacheTtl: 900,
        timeout: 3000,
      } as any);
      portRegistry.register('port-b', successAdapter, successAdapter, {
        cacheTier: 'dynamic',
        cacheTtl: 900,
        timeout: 3000,
      } as any);

      const result = await aggregationService.executeAll([
        { portName: 'port-a', method: 'get-list' },
        { portName: 'port-b', method: 'get-list' },
      ]);

      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
    });
  });

  describe('executeAll — partial failures', () => {
    it('should handle partial failures (2/3 succeed)', async () => {
      const successAdapter: IPortAdapter = {
        execute: jest.fn().mockResolvedValue({ data: 'ok' }),
      };
      const failAdapter: IPortAdapter = {
        execute: jest.fn().mockRejectedValue(new Error('Service unavailable')),
      };

      portRegistry.register('port-a', successAdapter, successAdapter, {
        cacheTier: 'dynamic',
        cacheTtl: 900,
        timeout: 3000,
      } as any);
      portRegistry.register('port-b', failAdapter, failAdapter, {
        cacheTier: 'dynamic',
        cacheTtl: 900,
        timeout: 3000,
      } as any);
      portRegistry.register('port-c', successAdapter, successAdapter, {
        cacheTier: 'dynamic',
        cacheTtl: 900,
        timeout: 3000,
      } as any);

      const result = await aggregationService.executeAll([
        { portName: 'port-a', method: 'get' },
        { portName: 'port-b', method: 'get' },
        { portName: 'port-c', method: 'get' },
      ]);

      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toContain('port-b');
    });
  });

  describe('executeAll — all fail', () => {
    it('should return all failures when all calls fail', async () => {
      const failAdapter: IPortAdapter = {
        execute: jest.fn().mockRejectedValue(new Error('Down')),
      };

      portRegistry.register('port-x', failAdapter, failAdapter, {
        cacheTier: 'dynamic',
        cacheTtl: 900,
        timeout: 3000,
      } as any);

      const result = await aggregationService.executeAll([
        { portName: 'port-x', method: 'get' },
      ]);

      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
    });
  });

  describe('resolveToMap', () => {
    it('should convert aggregation results to a map', async () => {
      const adapter: IPortAdapter = {
        execute: jest.fn().mockResolvedValue({ items: [1, 2, 3] }),
      };

      portRegistry.register('port-m', adapter, adapter, {
        cacheTier: 'dynamic',
        cacheTtl: 900,
        timeout: 3000,
      } as any);

      const response = await aggregationService.executeAll([
        { portName: 'port-m', method: 'get' },
      ]);

      const map = aggregationService.resolveToMap(response);
      expect(map.get('port-m')).toEqual({ items: [1, 2, 3] });
    });
  });

  describe('resolveSuccessful', () => {
    it('should return only successful results as a map', async () => {
      const successAdapter: IPortAdapter = {
        execute: jest.fn().mockResolvedValue({ ok: true }),
      };
      const failAdapter: IPortAdapter = {
        execute: jest.fn().mockRejectedValue(new Error('fail')),
      };

      portRegistry.register('s-port', successAdapter, successAdapter, {
        cacheTier: 'dynamic',
        cacheTtl: 900,
        timeout: 3000,
      } as any);
      portRegistry.register('f-port', failAdapter, failAdapter, {
        cacheTier: 'dynamic',
        cacheTtl: 900,
        timeout: 3000,
      } as any);

      const response = await aggregationService.executeAll([
        { portName: 's-port', method: 'get' },
        { portName: 'f-port', method: 'get' },
      ]);

      const map = aggregationService.resolveSuccessful(response);
      expect(map.has('s-port')).toBe(true);
      expect(map.has('f-port')).toBe(false);
    });
  });
});
