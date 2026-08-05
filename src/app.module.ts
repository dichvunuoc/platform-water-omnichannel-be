import { Global, Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import {
  SharedCqrsModule,
  LoggingModule,
  HealthModule,
  DrizzleDatabaseModule,
  DrizzleUnitOfWork,
  UNIT_OF_WORK_TOKEN,
  OutboxModule,
  schema,
  ContextModule,
  CorrelationIdMiddleware,
  CacheModule,
  AuthModule,
} from 'src/libs/shared';
import { MessagingModule } from './modules/messaging/messaging.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { CskhBffModule } from './modules/cskh-bff/cskh-bff.module';
import { TicketingModule } from './modules/ticketing/ticketing.module';

@Global()
@Module({
  imports: [
    // Configuration (loads .env)
    ConfigModule.forRoot({ isGlobal: true }),
    // @nestjs/schedule (SlaWorkerService @Cron — phải ở root level)
    ScheduleModule.forRoot(),
    // Rate limiting: 100 req/10s per IP (webhook flood protection)
    ThrottlerModule.forRoot([{ ttl: 10000, limit: 100 }]),
    // Structured Logging with Pino
    LoggingModule,
    // Request Context with Correlation ID for distributed tracing
    ContextModule,
    // DDD/CQRS Module - Global module
    SharedCqrsModule,
    // Drizzle Database with application schema
    DrizzleDatabaseModule.forRoot({
      schema,
      unitOfWorkProvider: {
        provide: UNIT_OF_WORK_TOKEN,
        useClass: DrizzleUnitOfWork,
      },
    }),
    // Transactional Outbox Pattern for reliable event publishing
    OutboxModule,
    // Health check endpoints
    HealthModule,
    // Cache (Redis-backed khi REDIS_URL set, in-memory fallback)
    CacheModule,
    // OmniCare Messaging Module (core conversation domain — ingest + inbox + handlers)
    MessagingModule,
    // Realtime gateway (socket.io — push events to agent screens)
    RealtimeModule,
    // CSKH BFF layer (CskhController /api/cskh/* + 9 service module imports)
    CskhBffModule,
    // Ticketing & SLA (Phase 2 — real Ticket aggregate + SLA dual-clock worker)
    TicketingModule,
    // Ticketing Stub — REMOVED (Phase 2 real ticketing wired)
  ],
  providers: [
    // Global rate limit guard (429 Too Many Requests when > 100 req/10s per IP)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure global middleware
   *
   * CorrelationIdMiddleware:
   * - Extracts/generates correlation ID from request headers
   * - Sets up request context (correlationId, userId, tenantId)
   * - Adds correlation ID to response headers
   * - Enables distributed tracing across services
   */
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
