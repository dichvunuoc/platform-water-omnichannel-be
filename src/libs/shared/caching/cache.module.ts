/**
 * CacheModule — register CACHE_SERVICE_TOKEN provider.
 *
 * REDIS_URL set → RedisCacheService (production: presence + idempotency + inbox cache).
 * REDIS_URL unset → MemoryCacheService (dev fallback, in-process).
 */
import { Global, Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CACHE_SERVICE_TOKEN } from 'src/libs/core/constants';
import { RedisCacheService } from './redis-cache.service';
import { MemoryCacheService } from './memory-cache.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: CACHE_SERVICE_TOKEN,
      useFactory: (config: ConfigService) => {
        const logger = new Logger('CacheModule');
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) {
          const match = redisUrl.match(/^redis:\/\/(?:(.+)@)?([^:]+):(\d+)(?:\/(\d+))?/);
          if (match) {
            const [, password, host, portStr, dbStr] = match;
            logger.log(`Redis cache configured: ${host}:${portStr}`);
            return new RedisCacheService({
              redis: {
                host,
                port: parseInt(portStr, 10),
                password: password || undefined,
                db: dbStr ? parseInt(dbStr, 10) : 0,
                keyPrefix: 'omnicare',
              },
              defaultTtl: 300,
            });
          }
        }
        logger.log('Using in-memory cache (no REDIS_URL)');
        return new MemoryCacheService({ defaultTtl: 300 });
      },
      inject: [ConfigService],
    },
  ],
  exports: [CACHE_SERVICE_TOKEN],
})
export class CacheModule {}
