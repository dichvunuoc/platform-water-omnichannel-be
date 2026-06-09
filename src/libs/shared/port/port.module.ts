/**
 * Port Module
 *
 * @Global NestJS module providing the Hexagonal Port Registry infrastructure.
 * Imports EndpointConfigModule, resilience, and context modules.
 *
 * CACHE_SERVICE_TOKEN is provided by AppModule (factory: Redis or Memory).
 *
 * AC: all — provides PortRegistry, PortHttpClient, AggregationService to the entire app.
 */

import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PortRegistry } from './port-registry.service';
import { PortHttpClient } from './port-http-client.service';
import { AggregationService } from './aggregation.service';
import { InboundIdempotencyService } from './inbound-idempotency.service';
import { EndpointConfigModule } from '../endpoint-config/endpoint-config.module';
import { AuthPropagationModule } from '../auth-propagation/auth-propagation.module';
import { StructuredLogger } from '../observability/structured-logger.service';
import { FallbackProvider } from '../resilience/fallback.provider';
import { ContextModule } from '../context/context.module';
import { FALLBACK_CACHE_TOKEN } from '../resilience/constants';
import { CACHE_SERVICE_TOKEN } from '../../core';
import { RedisCacheService } from '../caching/redis-cache.service';
import { MemoryCacheService } from '../caching/memory-cache.service';

@Global()
@Module({
  imports: [EndpointConfigModule, ContextModule, AuthPropagationModule],
  providers: [
    // Port infrastructure
    PortRegistry,
    PortHttpClient,
    AggregationService,
    InboundIdempotencyService,
    StructuredLogger,
    // Resilience — fallback with cache backing
    FallbackProvider,
    {
      provide: FALLBACK_CACHE_TOKEN,
      useFactory: () => new Map<string, unknown>(),
    },
    // Cache — factory: Redis in production (when REDIS_HOST is set), Memory in dev
    {
      provide: CACHE_SERVICE_TOKEN,
      useFactory: (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST');
        if (redisHost) {
          return new RedisCacheService({
            redis: {
              host: redisHost,
              port: configService.get<number>('REDIS_PORT', 6379),
              password: configService.get<string>('REDIS_PASSWORD'),
              db: configService.get<number>('REDIS_DB', 0),
              keyPrefix: configService.get<string>('CACHE_KEY_PREFIX', 'ioc:'),
            },
            defaultTtl: configService.get<number>('CACHE_DEFAULT_TTL', 300),
          });
        }
        // Fallback to in-memory for development / single-instance
        return new MemoryCacheService({
          defaultTtl: configService.get<number>('CACHE_DEFAULT_TTL', 300),
          keyPrefix: configService.get<string>('CACHE_KEY_PREFIX', 'ioc:'),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [PortRegistry, PortHttpClient, AggregationService, InboundIdempotencyService, CACHE_SERVICE_TOKEN],
})
export class PortModule {}
