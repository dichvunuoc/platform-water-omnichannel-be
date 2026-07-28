import { Global, Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
