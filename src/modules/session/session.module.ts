import { Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisSessionStore } from './infrastructure/redis/redis-session.store';
import { InMemorySessionStore } from './infrastructure/memory/in-memory-session.store';
import { SESSION_STORE_TOKEN, SESSION_TTL_TOKEN } from './constants/tokens';
import { CACHE_SERVICE_TOKEN } from '@core/constants/tokens';
import { RecordSessionEventHandler } from './application/commands/handlers/record-session-event.handler';
import { EnsureSessionHandler } from './application/commands/handlers/ensure-session.handler';
import { GetSessionHandler } from './application/queries/handlers/get-session.handler';
import { GetSessionEventsHandler } from './application/queries/handlers/get-session-events.handler';
import { GetSessionDetailHandler } from './application/queries/handlers/get-session-detail.handler';
import { SessionController } from './infrastructure/http/session.controller';

@Module({
  controllers: [SessionController],
  providers: [
    // TTL configuration from env
    {
      provide: SESSION_TTL_TOKEN,
      useFactory: (configService: ConfigService) =>
        parseInt(configService.get<string>('SESSION_TTL_SECONDS', '86400'), 10),
      inject: [ConfigService],
    },
    // Session Store — Redis when available, InMemory fallback
    // Factory decides at bootstrap; only one store implementation is instantiated
    {
      provide: SESSION_STORE_TOKEN,
      useFactory: (
        configService: ConfigService,
        cacheService: any,
        ttl: number,
      ) => {
        const logger = new Logger('SessionModule');
        const redisHost = configService.get<string>('REDIS_HOST');
        if (redisHost) {
          logger.log('Using RedisSessionStore (Redis available)');
          const store = new RedisSessionStore(cacheService, ttl);
          return store;
        }
        logger.warn('Using InMemorySessionStore (no Redis) — sessions will NOT survive restarts');
        return new InMemorySessionStore(ttl);
      },
      inject: [ConfigService, CACHE_SERVICE_TOKEN, SESSION_TTL_TOKEN],
    },
    // Command Handlers
    RecordSessionEventHandler,
    EnsureSessionHandler,
    // Query Handlers
    GetSessionHandler,
    GetSessionEventsHandler,
    GetSessionDetailHandler,
  ],
  exports: [SESSION_STORE_TOKEN],
})
export class SessionModule {}
