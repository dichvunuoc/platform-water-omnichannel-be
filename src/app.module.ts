import { Global, Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { PortModule } from 'src/libs/shared/port';
import { AuthPropagationModule, AuthPropagationMiddleware } from 'src/libs/shared/auth-propagation';
import { AuthModule } from 'src/modules/auth/auth.module';

@Global()
@Module({
  imports: [
    // Configuration (loads .env)
    ConfigModule.forRoot({ isGlobal: true }),
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
    // Auth Module — customer registration & multi-provider authentication
    AuthModule,
    // Auth Propagation — JWT signing for BFF→downstream identity propagation
    AuthPropagationModule,
    // Hexagonal Port Registry — centralized downstream service interface (needs AuthPropagationModule)
    PortModule,
  ],
  providers: [
    // CACHE_SERVICE_TOKEN now provided by PortModule (which is @Global)
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
    // Order matters: CorrelationId first (creates context), then AuthPropagation (enriches context)
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes('*');
    consumer
      .apply(AuthPropagationMiddleware)
      .exclude('api/auth', 'health', 'webhooks')
      .forRoutes('*');
  }
}
