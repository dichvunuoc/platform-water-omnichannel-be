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
import { CustomerModule } from 'src/modules/customer/customer.module';
import { ContractModule } from 'src/modules/contract/contract.module';
import { MeterModule } from 'src/modules/meter/meter.module';
import { BillingModule } from 'src/modules/billing/billing.module';
import { PaymentModule } from 'src/modules/payment/payment.module';
import { TicketModule } from 'src/modules/ticket/ticket.module';
import { CommunicationModule } from 'src/modules/communication/communication.module';
import { SessionModule } from 'src/modules/session/session.module';

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
    // Customer Module — 360° profile, timeline, related accounts (AC: Epic 2)
    CustomerModule,
    // Contract Module — contract lookup, detail, versions, PDF (AC: Epic 2)
    ContractModule,
    // Meter Module — meter list, calibration status, replacement history (AC: Epic 2)
    MeterModule,
    // Billing Module — tariff plan, breakdown, applicable fees, invoices (AC: Epic 3)
    BillingModule,
    // Payment Module — payment initiation, QR generation (AC: Epic 4)
    PaymentModule,
    // Ticket Module — incident report submission, photo upload (AC: Epic 5)
    TicketModule,
    // Communication Module — proactive area alerts, notification dispatch (AC: Epic 6)
    CommunicationModule,
    // Session Module — atomic Redis session store & event recording (AC: Epic 7)
    SessionModule,
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
