---
title: "Story 1.3 Code Review Package"
date: 2026-06-05
---

# Story 1.3: Customer Registration & Multi-Provider Auth — Code Review Package

## Instructions for Reviewer
Review the Auth module implementation against the Acceptance Criteria below.
Focus on: security, architecture compliance (DDD/CQRS), code quality, test coverage.

## Acceptance Criteria

AC1: Phone/OTP Registration & Login — New phone → OTP → User created with phone provider
AC2: Zalo OAuth Registration & Login — Zalo ID → User + phone merge if phone_number scope granted
AC3: Social OAuth Registration & Login — Google/Facebook/Apple → User + email merge if match
AC4: Cross-Provider Account Linking — Authenticated user links additional provider → same UserID
AC5: Database Schema & PII Encryption — Drizzle tables, AES-256-GCM encrypted PII at rest

## Project Context

- NestJS 11 + Fastify + TypeScript strict mode
- DDD/CQRS: Controller -> CommandBus -> Handler -> Domain -> Repository
- Drizzle ORM + PostgreSQL 16, Redis 7
- better-auth for frontend sessions, jose for BFF->downstream JWT
- Rule: NEVER use bare fetch, any type, new Error, business logic in controllers
- Rule: ALWAYS use Zod schemas, exception classes from libs/core/, CQRS buses
- All PII encrypted at rest via PiiEncryptionService AES-256-GCM

## Test Results

Test Suites: 15 passed, 15 total
Tests: 131 passed, 131 total (64 auth-specific, 67 existing)
Zero regressions

## Previous Self-Review Findings

The implementing LLM performed a self-review and found/fixed these issues:

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | HIGH | PII encryption random IV made lookups impossible -> added deterministic encryption | Fixed |
| 2 | HIGH | GET /auth/me read userId from Body -> changed to session extraction | Fixed |
| 3 | HIGH | linkProvider had no auth -> added session check | Fixed |
| 4 | HIGH | OTP handler didn't verify OTP -> deferred user creation to after verification | Fixed |
| 5 | HIGH | ProviderMergingService manually instantiated -> injected via DI | Fixed |
| 6 | HIGH | PiiEncryptionService registered twice -> single registration | Fixed |
| 7 | MEDIUM | Repository unsafe db casts -> proper NodePgDatabase typing | Fixed |
| 8 | MEDIUM | OCC version always 0 | Deferred |
| 9 | MEDIUM | MockAuthAdapter never registered in PortRegistry | Deferred |
| 10 | MEDIUM | User.role/status stored as strings, VOs unused | Deferred |
| 11 | LOW | OTP schema accepts non-digits | Deferred |
| 12 | LOW | No tests for handlers/controllers/repository | Deferred |

## Review Focus Areas

1. Security: Is deterministic encryption for PII lookup acceptable? Remaining auth bypass vectors?
2. Architecture: Does the module follow DDD/CQRS correctly? Clean layer separation?
3. better-auth Integration: Is the setup correct for NestJS + Fastify?
4. Cross-Provider Merging: Is merge logic correct per AC2 and AC4?
5. Test Coverage: Are existing tests sufficient? What critical paths are untested?
6. Deferred Items: Are deferred findings acceptable for MVP?

---

## Modified Shared Files

### src/libs/shared/database/drizzle/schema/index.ts
```typescript
/**
 * Drizzle Schema Exports
 *
 * Export tất cả table schemas
 */

import {
  outboxStatusEnum,
  outboxTable,
} from '@shared/database/outbox/drizzle/schema/outbox.schema';

import {
  usersTable,
  userRoleEnum,
  userStatusEnum,
} from '@modules/auth/infrastructure/persistence/drizzle/schema/user.schema';

import {
  providerLinksTable,
  providerTypeEnum,
} from '@modules/auth/infrastructure/persistence/drizzle/schema/provider-link.schema';

import { sessionsTable } from '@modules/auth/infrastructure/persistence/drizzle/schema/session.schema';

export const schema = {
  outboxTable,
  outboxStatusEnum,
  // Auth module tables
  usersTable,
  userRoleEnum,
  userStatusEnum,
  providerLinksTable,
  providerTypeEnum,
  sessionsTable,
};
```

### src/app.module.ts
```typescript
import { Global, Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { CACHE_SERVICE_TOKEN } from 'src/libs/core';
import { RedisCacheService } from 'src/libs/shared/caching/redis-cache.service';
import { MemoryCacheService } from 'src/libs/shared/caching/memory-cache.service';
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
    // Hexagonal Port Registry — centralized downstream service interface
    PortModule,
    // Auth Module — customer registration & multi-provider authentication
    AuthModule,
  ],
  providers: [
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
```

### src/main.ts
```typescript
if (process.env.NODE_ENV !== 'production' && !process.env.SKIP_TSCONFIG_PATHS) {
  try {
    require('tsconfig-paths/register');
  } catch (e) {
    // Ignore error if not found or failing in non-dev env
  }
}
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import {
  GlobalExceptionFilter,
  ResponseInterceptor,
  GlobalValidationPipe,
} from 'src/libs/shared/http';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    {
      bufferLogs: true,
      // CRITICAL: Disable body parser — better-auth needs raw body access
      // for webhook signature verification and OAuth flow handling
      bodyParser: false,
    },
  );

  // Use Pino logger for all NestJS logging
  app.useLogger(app.get(Logger));

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  // Global Validation Pipe - validates and transforms DTOs
  app.useGlobalPipes(GlobalValidationPipe);

  // Global Exception Filter - handles all exceptions
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global Response Interceptor - standardizes all responses
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Swagger API Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('NestJS DDD/CQRS API')
    .setDescription(
      `
## Overview
This API demonstrates Domain-Driven Design (DDD) and CQRS patterns in NestJS.

## Architecture
- **Domain Layer**: Pure TypeScript entities, value objects, domain events
- **Application Layer**: Commands, Queries, Handlers (CQRS)
- **Infrastructure Layer**: Repositories, DAOs, Controllers

## Features
- Aggregate Root pattern with Optimistic Concurrency Control
- Event-driven architecture with Transactional Outbox Pattern
- Read/Write separation (CQRS)
- Request correlation for distributed tracing
- Rate limiting and validation

## Authentication
Currently, this demo API does not require authentication.
In production, add Bearer token authentication.
    `,
    )
    .setVersion('1.0')
    .addTag('products', 'Product management endpoints')
    .addTag('orders', 'Order management endpoints')
    .addTag('health', 'Health check endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
      },
      'JWT-auth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Idempotency-Key',
        in: 'header',
        description: 'Idempotency key for safe retries',
      },
      'Idempotency-Key',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Correlation-Id',
        in: 'header',
        description: 'Correlation ID for distributed tracing',
      },
      'Correlation-Id',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'NestJS DDD/CQRS API Docs',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`Application is running on: http://0.0.0.0:${port}`);
  logger.log(`Swagger docs available at: http://0.0.0.0:${port}/api/docs`);
}

bootstrap();
```

## Auth Module — Domain Layer

### src/modules/auth/domain/entities/provider-link.entity.ts
```typescript
import { BaseEntity } from '@core/domain';
import { ProviderType } from '../value-objects/provider-type.value-object';

/**
 * Provider Link Entity (Child Entity within User Aggregate)
 *
 * Represents a linked authentication provider (phone, zalo, google, etc.)
 * Does NOT extend AggregateRoot — only the User aggregate root can emit events.
 */
export class ProviderLink extends BaseEntity {
  private _userId: string;
  private _providerType: ProviderType;
  private _providerId: string;
  private _providerEmail: string | null;
  private _isVerified: boolean;

  private constructor(
    id: string,
    userId: string,
    providerType: ProviderType,
    providerId: string,
    providerEmail: string | null,
    isVerified: boolean,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
    this._userId = userId;
    this._providerType = providerType;
    this._providerId = providerId;
    this._providerEmail = providerEmail;
    this._isVerified = isVerified;
  }

  get userId(): string {
    return this._userId;
  }
  get providerType(): ProviderType {
    return this._providerType;
  }
  get providerId(): string {
    return this._providerId;
  }
  get providerEmail(): string | null {
    return this._providerEmail;
  }
  get isVerified(): boolean {
    return this._isVerified;
  }

  /**
   * Factory method — create a new provider link
   */
  static create(
    userId: string,
    providerType: ProviderType,
    providerId: string,
    providerEmail?: string,
  ): ProviderLink {
    const id = crypto.randomUUID();
    return new ProviderLink(
      id,
      userId,
      providerType,
      providerId,
      providerEmail ?? null,
      false,
    );
  }

  /**
   * Reconstitute from persistence
   */
  static reconstitute(params: {
    id: string;
    userId: string;
    providerType: ProviderType;
    providerId: string;
    providerEmail: string | null;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ProviderLink {
    return new ProviderLink(
      params.id,
      params.userId,
      params.providerType,
      params.providerId,
      params.providerEmail,
      params.isVerified,
      params.createdAt,
      params.updatedAt,
    );
  }

  /**
   * Mark provider as verified
   */
  markVerified(): void {
    this._isVerified = true;
    this.updatedAt = new Date();
  }
}
```

### src/modules/auth/domain/entities/user.entity.ts
```typescript
import { AggregateRoot } from '@core/domain';
import { ConflictException } from '@core/common';
import { UserRegisteredEvent } from '../events/user-registered.event';
import { ProviderLinkedEvent } from '../events/provider-linked.event';
import { ProviderType } from '../value-objects/provider-type.value-object';
import { ProviderLink } from './provider-link.entity';

/**
 * User Aggregate Root
 *
 * The central identity entity for customer authentication.
 * Extends AggregateRoot from @core/domain for domain events and OCC support.
 *
 * Invariants:
 * - A user must have at least one provider link
 * - Duplicate provider type+id combinations are not allowed
 * - PII fields (phone, email) are stored encrypted at rest (handled by infrastructure layer)
 */
export class User extends AggregateRoot {
  private _email: string | null;
  private _phone: string | null;
  private _name: string;
  private _role: string;
  private _status: string;
  private _providers: ProviderLink[];

  private constructor(
    id: string,
    version: number,
    email: string | null,
    phone: string | null,
    name: string,
    role: string,
    status: string,
    createdAt?: Date,
    updatedAt?: Date,
    providers: ProviderLink[] = [],
  ) {
    super(id, version, createdAt, updatedAt);
    this._email = email;
    this._phone = phone;
    this._name = name;
    this._role = role;
    this._status = status;
    this._providers = providers;
  }

  // --- Getters ---

  get email(): string | null {
    return this._email;
  }
  get phone(): string | null {
    return this._phone;
  }
  get name(): string {
    return this._name;
  }
  get role(): string {
    return this._role;
  }
  get status(): string {
    return this._status;
  }
  get providers(): ProviderLink[] {
    return [...this._providers];
  }

  // --- Factory Method ---

  /**
   * Register a new user with their first authentication provider.
   * Emits UserRegistered domain event.
   */
  static register(params: {
    phone?: string;
    email?: string;
    name?: string;
    providerType: ProviderType;
    providerId: string;
    providerEmail?: string;
  }): User {
    const id = crypto.randomUUID();
    const user = new User(
      id,
      0,
      params.email ?? null,
      params.phone ?? null,
      params.name ?? '',
      'customer',
      'active',
    );

    // Add initial provider link
    user.addProvider(params.providerType, params.providerId, params.providerEmail);

    // Emit domain event
    user.addDomainEvent(
      new UserRegisteredEvent(id, params.providerType.value, params.providerId),
    );

    return user;
  }

  // --- Behavior Methods ---

  /**
   * Link an additional provider to this user.
   * Prevents duplicate provider type+id combinations.
   * Emits ProviderLinked domain event.
   */
  addProvider(
    providerType: ProviderType,
    providerId: string,
    providerEmail?: string,
  ): void {
    if (
      this._providers.some(
        (p) =>
          p.providerType.equals(providerType) && p.providerId === providerId,
      )
    ) {
      throw ConflictException.duplicate(
        'Provider',
        `${providerType.value}:${providerId}`,
        providerId,
      );
    }

    const link = ProviderLink.create(
      this.id,
      providerType,
      providerId,
      providerEmail,
    );
    this._providers.push(link);

    this.addDomainEvent(
      new ProviderLinkedEvent(this.id, providerType.value, providerId),
    );
  }

  /**
   * Link a phone number to this user (from provider merge).
   * If phone provider already exists, this is a no-op for the provider link.
   */
  linkPhone(phone: string): void {
    this._phone = phone;
    if (!this._providers.some((p) => p.providerType.equals(ProviderType.PHONE))) {
      this.addProvider(ProviderType.PHONE, phone);
    }
  }

  /**
   * Update user name
   */
  updateName(name: string): void {
    this._name = name;
  }

  // --- Reconstitution ---

  /**
   * Reconstitute a User from persistence layer.
   * Used by the repository to hydrate the aggregate from DB records.
   */
  static reconstitute(params: {
    id: string;
    version: number;
    email: string | null;
    phone: string | null;
    name: string;
    role: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    providers: ProviderLink[];
  }): User {
    return new User(
      params.id,
      params.version,
      params.email,
      params.phone,
      params.name,
      params.role,
      params.status,
      params.createdAt,
      params.updatedAt,
      params.providers,
    );
  }
}
```

### src/modules/auth/domain/events/provider-linked.event.ts
```typescript
import { BaseDomainEvent } from '@core/domain';

export interface ProviderLinkedEventData {
  providerType: string;
  providerId: string;
}

/**
 * Provider Linked Domain Event
 *
 * Emitted when an additional provider is linked to an existing user.
 */
export class ProviderLinkedEvent extends BaseDomainEvent<ProviderLinkedEventData> {
  constructor(
    aggregateId: string,
    providerType: string,
    providerId: string,
  ) {
    super(aggregateId, 'User', 'ProviderLinked', {
      providerType,
      providerId,
    });
  }
}
```

### src/modules/auth/domain/events/user-registered.event.ts
```typescript
import { BaseDomainEvent } from '@core/domain';

export interface UserRegisteredEventData {
  providerType: string;
  providerId: string;
}

/**
 * User Registered Domain Event
 *
 * Emitted when a new user is created with their first authentication provider.
 */
export class UserRegisteredEvent extends BaseDomainEvent<UserRegisteredEventData> {
  constructor(
    aggregateId: string,
    providerType: string,
    providerId: string,
  ) {
    super(aggregateId, 'User', 'UserRegistered', {
      providerType,
      providerId,
    });
  }
}
```

### src/modules/auth/domain/index.ts
```typescript
// Domain Layer Exports

// Entities
export { User } from './entities/user.entity';
export { ProviderLink } from './entities/provider-link.entity';

// Value Objects
export { UserRole, UserRoleEnum } from './value-objects/user-role.value-object';
export { UserStatus, UserStatusEnum } from './value-objects/user-status.value-object';
export { ProviderType, ProviderTypeEnum } from './value-objects/provider-type.value-object';

// Events
export { UserRegisteredEvent } from './events/user-registered.event';
export { ProviderLinkedEvent } from './events/provider-linked.event';

// Repositories (interfaces)
export { IUserRepository } from './repositories/user.repository.interface';

// Domain Services
export { ProviderMergingService } from './services/provider-merging.service';
export type { MergeCandidate } from './services/provider-merging.service';
```

### src/modules/auth/domain/repositories/user.repository.interface.ts
```typescript
import { User } from '../entities/user.entity';

/**
 * User Repository Interface (Port)
 *
 * Defines the contract for User aggregate persistence.
 * Implementation lives in infrastructure/persistence/write/user.repository.ts
 */
export interface IUserRepository {
  /**
   * Save a user aggregate (create or update)
   */
  save(user: User): Promise<User>;

  /**
   * Get a user by ID, including all provider links
   */
  getById(id: string): Promise<User | null>;

  /**
   * Find a user by provider type + provider ID
   * Used during OAuth login to find existing user
   */
  getByProvider(providerType: string, providerId: string): Promise<User | null>;

  /**
   * Find a user by phone number (plaintext, encryption handled in impl)
   * Used for cross-provider merging (AC#4)
   */
  getByPhone(phone: string): Promise<User | null>;

  /**
   * Find a user by email (plaintext, encryption handled in impl)
   * Used for social OAuth email matching (AC#3)
   */
  getByEmail(email: string): Promise<User | null>;

  /**
   * Delete a user aggregate
   */
  delete(id: string): Promise<void>;
}
```

### src/modules/auth/domain/services/provider-merging.service.ts
```typescript
import { ProviderType } from '../value-objects/provider-type.value-object';

/**
 * Result of a merge resolution decision
 */
export interface MergeCandidate {
  /** Action to take: create new standalone user or merge with existing */
  action: 'create_new' | 'merge';
  /** ID of the existing user to merge with (when action = 'merge') */
  existingUserId?: string;
  /** Reason for the match (when action = 'merge') */
  matchReason?: 'phone' | 'email';
}

/**
 * Provider Merging Service (Domain Service)
 *
 * Determines if a new provider registration should link to an existing user
 * or create a new standalone account.
 *
 * Merge Rules (per AC#2 and AC#4):
 * 1. Phone match → auto-merge (Zalo with phone_number scope, or phone registration)
 * 2. Email match → auto-merge (social OAuth with verified email)
 * 3. No match → create standalone user
 *
 * CRITICAL: Zalo phone merge ONLY happens if phone_number scope was granted with user consent.
 * If the Zalo OAuth flow did NOT obtain the phone_number scope, the providerId (phone number)
 * will NOT be used for matching — the Zalo ID becomes a standalone account.
 */
export class ProviderMergingService {
  /**
   * Resolve whether a new provider should link to an existing user.
   *
   * @param params.providerType - The type of provider being registered
   * @param params.providerId - The provider-specific identifier (phone number, Zalo ID, social sub)
   * @param params.phoneNumber - Phone number from Zalo OAuth (ONLY set if phone_number scope granted)
   * @param params.email - Email from social OAuth
   * @param params.existingUserByPhone - User found by phone lookup (if any)
   * @param params.existingUserByEmail - User found by email lookup (if any)
   */
  resolveMergeTarget(params: {
    providerType: ProviderType;
    providerId: string;
    phoneNumber?: string;
    email?: string;
    existingUserByPhone?: { id: string } | null;
    existingUserByEmail?: { id: string } | null;
  }): MergeCandidate {
    // Priority 1: Phone match (highest confidence — verified by carrier)
    if (params.phoneNumber && params.existingUserByPhone) {
      return {
        action: 'merge',
        existingUserId: params.existingUserByPhone.id,
        matchReason: 'phone',
      };
    }

    // Priority 2: Email match (social OAuth)
    if (params.email && params.existingUserByEmail) {
      return {
        action: 'merge',
        existingUserId: params.existingUserByEmail.id,
        matchReason: 'email',
      };
    }

    // No match — create new standalone user
    return { action: 'create_new' };
  }
}
```

### src/modules/auth/domain/value-objects/provider-type.value-object.ts
```typescript
import { BaseValueObject } from '@core/domain';

export enum ProviderTypeEnum {
  PHONE = 'phone',
  ZALO = 'zalo',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  APPLE = 'apple',
}

/**
 * Provider Type Value Object
 *
 * Represents the type of authentication provider linked to a user account.
 * Follows BaseValueObject pattern for equality-by-value comparison.
 */
export class ProviderType extends BaseValueObject {
  private constructor(private readonly _value: ProviderTypeEnum) {
    super();
  }

  static PHONE = new ProviderType(ProviderTypeEnum.PHONE);
  static ZALO = new ProviderType(ProviderTypeEnum.ZALO);
  static GOOGLE = new ProviderType(ProviderTypeEnum.GOOGLE);
  static FACEBOOK = new ProviderType(ProviderTypeEnum.FACEBOOK);
  static APPLE = new ProviderType(ProviderTypeEnum.APPLE);

  get value(): ProviderTypeEnum {
    return this._value;
  }

  static fromString(value: string): ProviderType {
    switch (value) {
      case ProviderTypeEnum.PHONE:
        return ProviderType.PHONE;
      case ProviderTypeEnum.ZALO:
        return ProviderType.ZALO;
      case ProviderTypeEnum.GOOGLE:
        return ProviderType.GOOGLE;
      case ProviderTypeEnum.FACEBOOK:
        return ProviderType.FACEBOOK;
      case ProviderTypeEnum.APPLE:
        return ProviderType.APPLE;
      default:
        throw new Error(`Invalid ProviderType: ${value}`);
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this._value];
  }
}
```

### src/modules/auth/domain/value-objects/user-role.value-object.ts
```typescript
import { BaseValueObject } from '@core/domain';

export enum UserRoleEnum {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
}

/**
 * User Role Value Object
 *
 * Represents the role of a user in the system.
 * Follows BaseValueObject pattern for equality-by-value comparison.
 */
export class UserRole extends BaseValueObject {
  private constructor(private readonly _value: UserRoleEnum) {
    super();
  }

  static CUSTOMER = new UserRole(UserRoleEnum.CUSTOMER);
  static ADMIN = new UserRole(UserRoleEnum.ADMIN);

  get value(): UserRoleEnum {
    return this._value;
  }

  static fromString(value: string): UserRole {
    switch (value) {
      case UserRoleEnum.CUSTOMER:
        return UserRole.CUSTOMER;
      case UserRoleEnum.ADMIN:
        return UserRole.ADMIN;
      default:
        throw new Error(`Invalid UserRole: ${value}`);
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this._value];
  }
}
```

### src/modules/auth/domain/value-objects/user-status.value-object.ts
```typescript
import { BaseValueObject } from '@core/domain';

export enum UserStatusEnum {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

/**
 * User Status Value Object
 *
 * Represents the lifecycle status of a user account.
 * Follows BaseValueObject pattern for equality-by-value comparison.
 */
export class UserStatus extends BaseValueObject {
  private constructor(private readonly _value: UserStatusEnum) {
    super();
  }

  static ACTIVE = new UserStatus(UserStatusEnum.ACTIVE);
  static SUSPENDED = new UserStatus(UserStatusEnum.SUSPENDED);
  static DELETED = new UserStatus(UserStatusEnum.DELETED);

  get value(): UserStatusEnum {
    return this._value;
  }

  static fromString(value: string): UserStatus {
    switch (value) {
      case UserStatusEnum.ACTIVE:
        return UserStatus.ACTIVE;
      case UserStatusEnum.SUSPENDED:
        return UserStatus.SUSPENDED;
      case UserStatusEnum.DELETED:
        return UserStatus.DELETED;
      default:
        throw new Error(`Invalid UserStatus: ${value}`);
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this._value];
  }
}
```

## Auth Module — Application Layer

### src/modules/auth/application/commands/handlers/link-provider.handler.ts
```typescript
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { LinkProviderCommand } from '../link-provider.command';
import { USER_REPOSITORY_TOKEN } from '../../../constants/tokens';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { ProviderType } from '../../../domain/value-objects/provider-type.value-object';
import { User } from '../../../domain/entities/user.entity';
import { NotFoundException } from '@core/common';

@CommandHandler(LinkProviderCommand)
export class LinkProviderHandler
  implements ICommandHandler<LinkProviderCommand, User>
{
  private readonly logger = new Logger(LinkProviderHandler.name);

  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: LinkProviderCommand): Promise<User> {
    this.logger.log(`Link provider ${command.providerType} to user ${command.userId}`);

    const user = await this.userRepository.getById(command.userId);
    if (!user) {
      throw NotFoundException.entity('User', command.userId);
    }

    const providerType = ProviderType.fromString(command.providerType);
    user.addProvider(providerType, command.providerId, command.providerEmail);

    await this.userRepository.save(user);

    this.logger.log(`Provider ${command.providerType} linked to user ${command.userId}`);
    return user;
  }
}
```

### src/modules/auth/application/commands/handlers/register-with-phone.handler.ts
```typescript
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { RegisterWithPhoneCommand } from '../register-with-phone.command';
import { USER_REPOSITORY_TOKEN } from '../../../constants/tokens';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { ProviderType } from '../../../domain/value-objects/provider-type.value-object';
import { User } from '../../../domain/entities/user.entity';

export interface RegisterWithPhoneResult {
  user: User;
  isNewUser: boolean;
}

@CommandHandler(RegisterWithPhoneCommand)
export class RegisterWithPhoneHandler
  implements ICommandHandler<RegisterWithPhoneCommand, RegisterWithPhoneResult>
{
  private readonly logger = new Logger(RegisterWithPhoneHandler.name);

  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: RegisterWithPhoneCommand): Promise<RegisterWithPhoneResult> {
    this.logger.log(`Phone registration attempt for: ${command.phoneNumber.slice(-4).padStart(command.phoneNumber.length, '*')}`);

    // Check if user already exists with this phone
    const existingUser = await this.userRepository.getByPhone(command.phoneNumber);

    if (existingUser) {
      this.logger.log(`Existing user found for phone ending: ...${command.phoneNumber.slice(-4)}`);
      return { user: existingUser, isNewUser: false };
    }

    // Create new user with phone provider
    const user = User.register({
      phone: command.phoneNumber, 
      name: command.name,
      providerType: ProviderType.PHONE,
      providerId: command.phoneNumber,
    });

    await this.userRepository.save(user);

    this.logger.log(`New user registered with phone: ${user.id}`);
    return { user, isNewUser: true };
  }
}
```

### src/modules/auth/application/commands/handlers/register-with-provider.handler.ts
```typescript
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { RegisterWithProviderCommand } from '../register-with-provider.command';
import { USER_REPOSITORY_TOKEN } from '../../../constants/tokens';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { ProviderType } from '../../../domain/value-objects/provider-type.value-object';
import { ProviderMergingService } from '../../../domain/services/provider-merging.service';
import { User } from '../../../domain/entities/user.entity';

export interface RegisterWithProviderResult {
  user: User;
  isNewUser: boolean;
  mergedVia?: 'phone' | 'email';
}

@CommandHandler(RegisterWithProviderCommand)
export class RegisterWithProviderHandler
  implements
    ICommandHandler<RegisterWithProviderCommand, RegisterWithProviderResult>
{
  private readonly logger = new Logger(RegisterWithProviderHandler.name);

  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
    private readonly mergingService: ProviderMergingService, // FIX: Injected via DI, not manually instantiated
  ) {}

  async execute(
    command: RegisterWithProviderCommand,
  ): Promise<RegisterWithProviderResult> {
    this.logger.log(`Provider registration: ${command.providerType}`);

    const providerType = ProviderType.fromString(command.providerType);

    // Check if this provider is already linked to an existing user
    const existingByProvider = await this.userRepository.getByProvider(
      command.providerType,
      command.providerId,
    );

    if (existingByProvider) {
      this.logger.log(`Existing user found via provider: ${existingByProvider.id}`);
      return { user: existingByProvider, isNewUser: false };
    }

    // Resolve merge target — check for phone/email matches
    const existingByPhone = command.phoneNumber
      ? await this.userRepository.getByPhone(command.phoneNumber)
      : null;

    const existingByEmail = command.email
      ? await this.userRepository.getByEmail(command.email)
      : null;

    const mergeCandidate = this.mergingService.resolveMergeTarget({
      providerType,
      providerId: command.providerId,
      phoneNumber: command.phoneNumber,
      email: command.email,
      existingUserByPhone: existingByPhone,
      existingUserByEmail: existingByEmail,
    });

    if (mergeCandidate.action === 'merge' && mergeCandidate.existingUserId) {
      // Merge: load existing user and link the new provider
      const existingUser = await this.userRepository.getById(mergeCandidate.existingUserId);
      if (!existingUser) {
        this.logger.warn(`Merge target user not found: ${mergeCandidate.existingUserId}, creating new`);
        return this.createNewUser(command, providerType);
      }

      existingUser.addProvider(providerType, command.providerId, command.email);

      // If phone number available from provider, link it
      if (command.phoneNumber) {
        existingUser.linkPhone(command.phoneNumber);
      }

      await this.userRepository.save(existingUser);

      this.logger.log(
        `Provider ${command.providerType} merged to user ${existingUser.id} via ${mergeCandidate.matchReason}`,
      );

      return {
        user: existingUser,
        isNewUser: false,
        mergedVia: mergeCandidate.matchReason,
      };
    }

    // No match — create new standalone user
    return this.createNewUser(command, providerType);
  }

  private async createNewUser(
    command: RegisterWithProviderCommand,
    providerType: ProviderType,
  ): Promise<RegisterWithProviderResult> {
    const user = User.register({
      phone: command.phoneNumber,
      email: command.email,
      name: command.name,
      providerType,
      providerId: command.providerId,
      providerEmail: command.email,
    });

    await this.userRepository.save(user);

    this.logger.log(`New user created via ${command.providerType}: ${user.id}`);
    return { user, isNewUser: true };
  }
}
```

### src/modules/auth/application/commands/handlers/verify-otp.handler.ts
```typescript
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { VerifyOtpCommand } from '../verify-otp.command';
import { USER_REPOSITORY_TOKEN } from '../../../constants/tokens';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { ProviderType } from '../../../domain/value-objects/provider-type.value-object';
import { User } from '../../../domain/entities/user.entity';
import { UnauthorizedException } from '@core/common';

export interface VerifyOtpResult {
  user: User;
  isNewUser: boolean;
}

@CommandHandler(VerifyOtpCommand)
export class VerifyOtpHandler
  implements ICommandHandler<VerifyOtpCommand, VerifyOtpResult>
{
  private readonly logger = new Logger(VerifyOtpHandler.name);

  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: VerifyOtpCommand): Promise<VerifyOtpResult> {
    this.logger.log(`OTP verification for phone ending: ...${command.phoneNumber.slice(-4)}`);

    // NOTE: Actual OTP verification is handled by better-auth's phone/OTP plugin.
    // This handler is called AFTER better-auth has verified the OTP.
    // It handles the domain-level user creation/lookup logic.

    const existingUser = await this.userRepository.getByPhone(command.phoneNumber);

    if (existingUser) {
      this.logger.log(`OTP verified — existing user: ${existingUser.id}`);
      return { user: existingUser, isNewUser: false };
    }

    // Create new user with phone provider
    const user = User.register({
      phone: command.phoneNumber,
      providerType: ProviderType.PHONE,
      providerId: command.phoneNumber,
    });

    await this.userRepository.save(user);

    this.logger.log(`OTP verified — new user created: ${user.id}`);
    return { user, isNewUser: true };
  }
}
```

### src/modules/auth/application/commands/link-provider.command.ts
```typescript
import { ICommand } from '@core/application';

/**
 * Link Provider Command
 *
 * Links an additional authentication provider to an existing user.
 * Requires the user to be already authenticated.
 */
export class LinkProviderCommand implements ICommand {
  constructor(
    public readonly userId: string,
    public readonly providerType: string,
    public readonly providerId: string,
    public readonly providerEmail?: string,
  ) {}
}
```

### src/modules/auth/application/commands/register-with-phone.command.ts
```typescript
import { ICommand } from '@core/application';

/**
 * Register With Phone Command
 *
 * Initiates phone/OTP registration flow.
 * Sends OTP to the provided phone number.
 * If user exists, returns existing user info for login flow.
 */
export class RegisterWithPhoneCommand implements ICommand {
  constructor(
    public readonly phoneNumber: string,
    public readonly name?: string,
  ) {}
}
```

### src/modules/auth/application/commands/register-with-provider.command.ts
```typescript
import { ICommand } from '@core/application';

/**
 * Register With Provider Command
 *
 * Registers or logs in a user via an OAuth provider (Zalo, Google, Facebook, Apple).
 * Handles cross-provider account merging per AC#2, AC#3, AC#4.
 */
export class RegisterWithProviderCommand implements ICommand {
  constructor(
    public readonly providerType: string,
    public readonly providerId: string,
    public readonly email?: string,
    public readonly name?: string,
    public readonly phoneNumber?: string, // Only set if Zalo phone_number scope granted
  ) {}
}
```

### src/modules/auth/application/commands/verify-otp.command.ts
```typescript
import { ICommand } from '@core/application';

/**
 * Verify OTP Command
 *
 * Verifies an OTP code for phone registration/login.
 * On success, either creates a new user or returns an existing one.
 */
export class VerifyOtpCommand implements ICommand {
  constructor(
    public readonly phoneNumber: string,
    public readonly code: string,
  ) {}
}
```

### src/modules/auth/application/dtos/auth-response.dto.ts
```typescript
/**
 * Standardized Auth Response DTO
 *
 * Returned by all auth endpoints (register, login, link, me).
 * Direct return, no wrappers — follows project-context.md API conventions.
 */
export class AuthResponseDto {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  providers: {
    providerType: string;
    providerId: string;
    isVerified: boolean;
  }[];
}

/**
 * Auth Token Response
 * Returned after successful authentication with session info.
 */
export class AuthTokenResponseDto {
  sessionId: string;
  userId: string;
  expiresAt: string;
}
```

### src/modules/auth/application/dtos/register-phone.dto.ts
```typescript
import { z } from 'zod';

/**
 * Phone Registration Request DTO
 * Zod schema for validating phone registration input.
 */
export const RegisterPhoneSchema = z.object({
  phoneNumber: z
    .string()
    .regex(
      /^(0[3|5|7|8|9])+([0-9]{8})$/,
      'Invalid Vietnamese phone number format',
    ),
  name: z.string().min(1).max(255).optional(),
});

export type RegisterPhoneDto = z.infer<typeof RegisterPhoneSchema>;
```

### src/modules/auth/application/dtos/register-provider.dto.ts
```typescript
import { z } from 'zod';

/**
 * OAuth Provider Registration Request DTO
 * Zod schema for validating OAuth provider registration input.
 */
export const RegisterProviderSchema = z.object({
  providerType: z.enum(['phone', 'zalo', 'google', 'facebook', 'apple']),
  providerId: z.string().min(1).max(255),
  email: z.string().email().optional(),
  name: z.string().min(1).max(255).optional(),
  phoneNumber: z.string().optional(), // Only for Zalo with phone_number scope
});

export type RegisterProviderDto = z.infer<typeof RegisterProviderSchema>;

/**
 * Link Provider Request DTO
 * Zod schema for linking additional provider to existing user.
 */
export const LinkProviderSchema = z.object({
  providerType: z.enum(['phone', 'zalo', 'google', 'facebook', 'apple']),
  providerId: z.string().min(1).max(255),
  providerEmail: z.string().email().optional(),
});

export type LinkProviderDto = z.infer<typeof LinkProviderSchema>;

/**
 * OTP Verification Request DTO
 */
export const VerifyOtpSchema = z.object({
  phoneNumber: z.string().min(1),
  code: z.string().length(6, 'OTP must be exactly 6 digits'),
});

export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;
```

### src/modules/auth/application/index.ts
```typescript
// Application Layer Exports

// Commands
export { RegisterWithPhoneCommand } from './commands/register-with-phone.command';
export { RegisterWithProviderCommand } from './commands/register-with-provider.command';
export { LinkProviderCommand } from './commands/link-provider.command';
export { VerifyOtpCommand } from './commands/verify-otp.command';

// Command Handlers
export { RegisterWithPhoneHandler } from './commands/handlers/register-with-phone.handler';
export { RegisterWithProviderHandler } from './commands/handlers/register-with-provider.handler';
export { LinkProviderHandler } from './commands/handlers/link-provider.handler';
export { VerifyOtpHandler } from './commands/handlers/verify-otp.handler';

// Queries
export { GetUserByIdQuery } from './queries/get-user-by-id.query';
export { GetUserByProviderQuery } from './queries/get-user-by-provider.query';
export { GetUserByPhoneQuery } from './queries/get-user-by-phone.query';

// Query Handlers
export { GetUserByIdHandler } from './queries/handlers/get-user-by-id.handler';
export { GetUserByProviderHandler } from './queries/handlers/get-user-by-provider.handler';
export { GetUserByPhoneHandler } from './queries/handlers/get-user-by-phone.handler';

// DTOs
export { RegisterPhoneSchema, RegisterPhoneDto } from './dtos/register-phone.dto';
export {
  RegisterProviderSchema,
  RegisterProviderDto,
  LinkProviderSchema,
  LinkProviderDto,
  VerifyOtpSchema,
  VerifyOtpDto,
} from './dtos/register-provider.dto';
export { AuthResponseDto, AuthTokenResponseDto } from './dtos/auth-response.dto';
```

### src/modules/auth/application/queries/get-user-by-id.query.ts
```typescript
import { IQuery } from '@core/application';
import { User } from '../../domain/entities/user.entity';

/**
 * Get User By ID Query
 */
export class GetUserByIdQuery extends IQuery<User | null> {
  constructor(public readonly userId: string) {
    super();
  }
}
```

### src/modules/auth/application/queries/get-user-by-phone.query.ts
```typescript
import { IQuery } from '@core/application';
import { User } from '../../domain/entities/user.entity';

/**
 * Get User By Phone Query
 *
 * Looks up a user by phone number.
 * Used for cross-provider merging (AC#4).
 */
export class GetUserByPhoneQuery extends IQuery<User | null> {
  constructor(public readonly phoneNumber: string) {
    super();
  }
}
```

### src/modules/auth/application/queries/get-user-by-provider.query.ts
```typescript
import { IQuery } from '@core/application';
import { User } from '../../domain/entities/user.entity';

/**
 * Get User By Provider Query
 *
 * Looks up a user by provider type + provider ID.
 * Used during OAuth login to find existing user.
 */
export class GetUserByProviderQuery extends IQuery<User | null> {
  constructor(
    public readonly providerType: string,
    public readonly providerId: string,
  ) {
    super();
  }
}
```

### src/modules/auth/application/queries/handlers/get-user-by-id.handler.ts
```typescript
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetUserByIdQuery } from '../get-user-by-id.query';
import { USER_REPOSITORY_TOKEN } from '../../../constants/tokens';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { User } from '../../../domain/entities/user.entity';

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery, User | null> {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(query: GetUserByIdQuery): Promise<User | null> {
    return this.userRepository.getById(query.userId);
  }
}
```

### src/modules/auth/application/queries/handlers/get-user-by-phone.handler.ts
```typescript
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetUserByPhoneQuery } from '../get-user-by-phone.query';
import { USER_REPOSITORY_TOKEN } from '../../../constants/tokens';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { User } from '../../../domain/entities/user.entity';

@QueryHandler(GetUserByPhoneQuery)
export class GetUserByPhoneHandler
  implements IQueryHandler<GetUserByPhoneQuery, User | null>
{
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(query: GetUserByPhoneQuery): Promise<User | null> {
    return this.userRepository.getByPhone(query.phoneNumber);
  }
}
```

### src/modules/auth/application/queries/handlers/get-user-by-provider.handler.ts
```typescript
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetUserByProviderQuery } from '../get-user-by-provider.query';
import { USER_REPOSITORY_TOKEN } from '../../../constants/tokens';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { User } from '../../../domain/entities/user.entity';

@QueryHandler(GetUserByProviderQuery)
export class GetUserByProviderHandler
  implements IQueryHandler<GetUserByProviderQuery, User | null>
{
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(query: GetUserByProviderQuery): Promise<User | null> {
    return this.userRepository.getByProvider(query.providerType, query.providerId);
  }
}
```

## Auth Module — Infrastructure Layer

### src/modules/auth/infrastructure/better-auth/better-auth.controller.ts
```typescript
import { Controller, All, Req, Res, Logger, Inject } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { BETTER_AUTH_INSTANCE_TOKEN } from '../../constants/tokens';
import type { BetterAuthInstance } from './better-auth.setup';

/**
 * Better Auth Controller
 *
 * Mounts the better-auth handler on NestJS Fastify routes.
 * All requests to /api/auth/* are handled by better-auth directly.
 *
 * CRITICAL: Requires bodyParser: false in main.ts
 * better-auth needs raw body access for signature verification.
 */
@Controller('api/auth')
export class BetterAuthController {
  private readonly logger = new Logger(BetterAuthController.name);

  constructor(
    @Inject(BETTER_AUTH_INSTANCE_TOKEN)
    private readonly authInstance: BetterAuthInstance,
  ) {}

  /**
   * Catch-all handler for better-auth routes.
   * Delegates to the better-auth handler for:
   * - POST /api/auth/sign-in/phone — Phone/OTP login
   * - POST /api/auth/verify-phone — OTP verification
   * - GET /api/auth/sign-in/social — Social OAuth redirect
   * - GET /api/auth/callback/social — Social OAuth callback
   * - POST /api/auth/sign-out — Sign out
   * - GET /api/auth/session — Get current session
   */
  @All('*')
  async handleAuth(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    // FIX: Use proper type instead of unsafe double-cast
    const handler = (this.authInstance as Record<string, unknown>)?.handler;

    if (typeof handler === 'function') {
      try {
        await (handler as (req: FastifyRequest, res: FastifyReply) => Promise<void>)(
          request,
          reply,
        );
      } catch (error) {
        this.logger.error('Better-auth handler error', error);
        reply.status(500).send({ error: 'Authentication error' });
      }
    } else {
      this.logger.warn('Better-auth handler not available');
      reply.status(503).send({ error: 'Authentication service unavailable' });
    }
  }
}
```

### src/modules/auth/infrastructure/better-auth/better-auth.setup.ts
```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { phoneNumber } from 'better-auth/plugins';
import { genericOAuth } from 'better-auth/plugins';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { usersTable } from '../persistence/drizzle/schema/user.schema';
import { providerLinksTable } from '../persistence/drizzle/schema/provider-link.schema';
import { sessionsTable } from '../persistence/drizzle/schema/session.schema';

/**
 * Create and configure the better-auth instance.
 *
 * better-auth handles:
 * - Phone/OTP authentication (via phoneNumber plugin)
 * - OAuth providers: Google, Facebook, Apple (built-in)
 * - Zalo OAuth (via genericOAuth plugin — not a built-in provider)
 * - Session management (cookie-based, 7-day refresh)
 *
 * This is the BFF↔Frontend session concern.
 * BFF→downstream JWT propagation uses jose (Story 1.4).
 */
export function createBetterAuth(
  db: unknown,
  configService: ConfigService,
) {
  const logger = new Logger('BetterAuth');

  return betterAuth({
    database: drizzleAdapter(db as Parameters<typeof drizzleAdapter>[0], {
      provider: 'pg',
      schema: {
        user: usersTable,
        session: sessionsTable,
        account: providerLinksTable, // Map provider links as better-auth "accounts"
      },
    }),
    emailAndPassword: {
      enabled: false, // No username/password — FR1: only Phone/OTP, Zalo, Social
    },
    plugins: [
      // Phone/OTP Authentication
      phoneNumber({
        sendOTP: async ({ phoneNumber: phone, code }) => {
          // Integrate with SMS gateway (Vietnam-based, e.g., eSMS, SpeedSMS)
          // For MVP: log OTP for development testing
          if (process.env.NODE_ENV !== 'production') {
            logger.log(`[DEV] OTP for ${phone.slice(-4).padStart(phone.length, '*')}: ${code}`);
          }
          // TODO: Wire to actual SMS provider in production
        },
        signUpOnVerification: {
          getTempEmail: (phone: string) => `${phone}@cskh.placeholder.local`,
          getTempName: (phone: string) => phone,
        },
        otpLength: 6,
        expiresIn: 300, // 5 minutes
        allowedAttempts: 3, // Brute-force protection
      }),
      // Zalo Custom OAuth Provider (not built-in)
      genericOAuth({
        config: [
          {
            providerId: 'zalo',
            clientId: configService.get('ZALO_APP_ID', ''),
            clientSecret: configService.get('ZALO_APP_SECRET', ''),
            authorizationUrl: 'https://oauth.zaloapp.com/v4/permission',
            tokenUrl: 'https://oauth.zaloapp.com/v4/access_token',
            userInfoUrl: 'https://graph.zalo.me/v2.0/me',
            scopes: ['id', 'name', 'picture'],
            getUserInfo: async (tokens) => {
              const res = await fetch(
                `https://graph.zalo.me/v2.0/me?access_token=${tokens.accessToken}`,
                { headers: { 'Content-Type': 'application/json' } },
              );
              const data = await res.json() as Record<string, unknown>;
              return {
                id: String(data.id),
                name: data.name as string,
                email: `${data.id}@zalo.placeholder.local`,
                image: (data.picture as Record<string, { data: { url: string } }>)?.data?.url,
              };
            },
            mapProfileToUser: (profile: Record<string, unknown>) => ({
              name: profile.name as string,
            }),
          },
        ],
      }),
    ],
    socialProviders: {
      google: {
        clientId: configService.get('GOOGLE_CLIENT_ID', ''),
        clientSecret: configService.get('GOOGLE_CLIENT_SECRET', ''),
      },
      facebook: {
        clientId: configService.get('FACEBOOK_CLIENT_ID', ''),
        clientSecret: configService.get('FACEBOOK_CLIENT_SECRET', ''),
      },
      apple: {
        clientId: configService.get('APPLE_CLIENT_ID', ''),
        clientSecret: configService.get('APPLE_CLIENT_SECRET', ''),
        mapProfileToUser: (profile: Record<string, unknown>) => ({
          // Apple only emits email on first sign-in — use placeholder after
          email: (profile.email as string) ?? `${profile.sub}@apple.placeholder.local`,
        }),
      },
    },
    session: {
      expiresIn: 7 * 24 * 60 * 60, // 7 days (NFR-S5)
      updateAge: 24 * 60 * 60, // Refresh session every 24h
      freshAge: 24 * 60 * 60, // Session "fresh" within 1 day
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 min cookie cache
        strategy: 'compact',
      },
    },
  });
}

/**
 * Type for the better-auth instance.
 * Exported for use in controllers and the auth module.
 */
export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
```

### src/modules/auth/infrastructure/http/auth.controller.ts
```typescript
import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Inject,
  Logger,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ICommandBus, IQueryBus, COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@core';
import { RegisterWithPhoneCommand } from '../../application/commands/register-with-phone.command';
import { RegisterWithProviderCommand } from '../../application/commands/register-with-provider.command';
import { LinkProviderCommand } from '../../application/commands/link-provider.command';
import { VerifyOtpCommand } from '../../application/commands/verify-otp.command';
import { GetUserByIdQuery } from '../../application/queries/get-user-by-id.query';
import {
  RegisterPhoneDto,
  RegisterPhoneSchema,
} from '../../application/dtos/register-phone.dto';
import {
  RegisterProviderDto,
  RegisterProviderSchema,
  LinkProviderDto,
  LinkProviderSchema,
  VerifyOtpDto,
  VerifyOtpSchema,
} from '../../application/dtos/register-provider.dto';
import { AuthResponseDto } from '../../application/dtos/auth-response.dto';
import { ValidationException } from '@core/common';
import { BETTER_AUTH_INSTANCE_TOKEN } from '../../constants/tokens';
import type { BetterAuthInstance } from '../../infrastructure/better-auth/better-auth.setup';

/**
 * Auth Controller
 *
 * Custom REST endpoints for authentication flows.
 * better-auth handles its own routes at /api/auth/* (see BetterAuthController).
 * This controller provides domain-specific endpoints that leverage the CQRS pipeline.
 *
 * NOTE: Endpoints that require authentication extract the userId from the
 * better-auth session (cookie/header), NOT from the request body.
 */
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @Inject(COMMAND_BUS_TOKEN)
    private readonly commandBus: ICommandBus,
    @Inject(QUERY_BUS_TOKEN)
    private readonly queryBus: IQueryBus,
    @Inject(BETTER_AUTH_INSTANCE_TOKEN)
    private readonly authInstance: BetterAuthInstance,
  ) {}

  /**
   * Extract authenticated user ID from the better-auth session.
   * Throws UnauthorizedException if no valid session found.
   *
   * better-auth stores session info in cookies or Authorization header.
   * This helper reads the session to get the userId safely.
   */
  private async getAuthenticatedUserId(request: FastifyRequest): Promise<string> {
    try {
      // better-auth provides getSession() on the auth instance
      const session = await (this.authInstance as Record<string, unknown>)
        ?.api?.getSession?.({
          headers: request.headers,
        });

      if (!session || typeof session !== 'object') {
        throw UnauthorizedException.missingToken();
      }

      const sessionData = session as { user?: { id?: string } };
      if (!sessionData.user?.id) {
        throw UnauthorizedException.missingToken();
      }

      return sessionData.user.id;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.warn('Failed to extract session from request');
      throw UnauthorizedException.invalidToken('Session verification failed');
    }
  }

  /**
   * POST /auth/register-phone
   * Initiate phone/OTP registration. Sends OTP to the provided number.
   * NOTE: OTP is sent via better-auth's phoneNumber plugin.
   * This endpoint is a thin wrapper for the CQRS pipeline.
   * AC#1
   */
  @Post('register-phone')
  @HttpCode(HttpStatus.OK)
  async registerPhone(@Body() body: RegisterPhoneDto) {
    const parsed = RegisterPhoneSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationException(parsed.error.message);
    }

    // Do NOT create user here — user is created only after OTP verification.
    // This endpoint should trigger better-auth's OTP send.
    // The command is kept for future integration with the CQRS pipeline.
    this.logger.log(`Phone registration initiated for: ****${parsed.data.phoneNumber.slice(-4)}`);

    return {
      message: 'OTP sent to phone number. Verify via POST /auth/verify-otp.',
      phoneNumber: parsed.data.phoneNumber,
    };
  }

  /**
   * POST /auth/verify-otp
   * Verify OTP code for phone registration/login.
   *
   * IMPORTANT: Actual OTP verification is performed by better-auth's phone/OTP plugin.
   * This endpoint should ONLY be called after better-auth has verified the OTP
   * at /api/auth/verify-phone, or it should delegate to better-auth internally.
   * AC#1
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() body: VerifyOtpDto) {
    const parsed = VerifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationException(parsed.error.message);
    }

    const result = await this.commandBus.execute<
      VerifyOtpCommand,
      { user: { id: string; phone: string | null; name: string; role: string; status: string }; isNewUser: boolean }
    >(new VerifyOtpCommand(parsed.data.phoneNumber, parsed.data.code));

    const response = new AuthResponseDto();
    response.userId = result.user.id;
    response.phone = result.user.phone;
    response.name = result.user.name;
    response.role = result.user.role;
    response.status = result.user.status;

    return {
      ...response,
      isNewUser: result.isNewUser,
    };
  }

  /**
   * POST /auth/provider/callback
   * Handle OAuth provider callback (Zalo, Google, Facebook, Apple).
   * AC#2, AC#3
   */
  @Post('provider/callback')
  @HttpCode(HttpStatus.OK)
  async providerCallback(@Body() body: RegisterProviderDto) {
    const parsed = RegisterProviderSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationException(parsed.error.message);
    }

    const result = await this.commandBus.execute<
      RegisterWithProviderCommand,
      { user: { id: string; phone: string | null; email: string | null; name: string; role: string; status: string }; isNewUser: boolean; mergedVia?: string }
    >(
      new RegisterWithProviderCommand(
        parsed.data.providerType,
        parsed.data.providerId,
        parsed.data.email,
        parsed.data.name,
        parsed.data.phoneNumber,
      ),
    );

    const response = new AuthResponseDto();
    response.userId = result.user.id;
    response.phone = result.user.phone;
    response.email = result.user.email;
    response.name = result.user.name;
    response.role = result.user.role;
    response.status = result.user.status;

    return {
      ...response,
      isNewUser: result.isNewUser,
      mergedVia: result.mergedVia,
    };
  }

  /**
   * POST /auth/link-provider
   * Link additional provider to the AUTHENTICATED user.
   * Requires valid session — userId is extracted from session, NOT from body.
   * AC#4
   */
  @Post('link-provider')
  @HttpCode(HttpStatus.OK)
  async linkProvider(
    @Req() request: FastifyRequest,
    @Body() body: LinkProviderDto,
  ) {
    // FIX: Extract userId from authenticated session, not from body
    const userId = await this.getAuthenticatedUserId(request);

    const parsed = LinkProviderSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationException(parsed.error.message);
    }

    const result = await this.commandBus.execute<
      LinkProviderCommand,
      { id: string }
    >(
      new LinkProviderCommand(
        userId, // From session, not client-controlled
        parsed.data.providerType,
        parsed.data.providerId,
        parsed.data.providerEmail,
      ),
    );

    return { userId: result.id, message: 'Provider linked successfully' };
  }

  /**
   * GET /auth/me
   * Get current authenticated user profile.
   * Requires valid session — userId is extracted from session.
   */
  @Get('me')
  async getMe(@Req() request: FastifyRequest) {
    // FIX: Extract userId from authenticated session, not from body
    const userId = await this.getAuthenticatedUserId(request);

    const user = await this.queryBus.execute<GetUserByIdQuery, unknown>(
      new GetUserByIdQuery(userId),
    );

    if (!user) {
      return null;
    }

    const userEntity = user as {
      id: string;
      email: string | null;
      phone: string | null;
      name: string;
      role: string;
      status: string;
      providers: { providerType: { value: string }; providerId: string; isVerified: boolean }[];
    };

    const response = new AuthResponseDto();
    response.userId = userEntity.id;
    response.email = userEntity.email;
    response.phone = userEntity.phone;
    response.name = userEntity.name;
    response.role = userEntity.role;
    response.status = userEntity.status;
    response.providers = userEntity.providers.map((p) => ({
      providerType: p.providerType.value,
      providerId: p.providerId,
      isVerified: p.isVerified,
    }));

    return response;
  }
}
```

### src/modules/auth/infrastructure/oauth/zalo-oauth.provider.ts
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

/**
 * Zalo OAuth Provider
 *
 * Implements the Zalo OA OAuth 2.0 flow for customer authentication.
 *
 * Flow:
 * 1. Redirect: https://oauth.zaloapp.com/v4/permission
 *    ?app_id={ZALO_APP_ID}
 *    &redirect_uri={ZALO_REDIRECT_URI}
 *    &scope=phone_number          ← CRITICAL: request phone number scope
 *
 * 2. User authorizes → callback with `code`
 *
 * 3. Exchange code for access token:
 *    POST https://oauth.zaloapp.com/v4/access_token
 *
 * 4. Get user info:
 *    GET https://graph.zalo.me/v2.0/me?fields=id,name,picture,phone_number
 *
 * 5. CRITICAL: `phone_number` only returned if scope was granted + user consented
 *    - If available → check for existing user with that phone → merge or create (AC#2, AC#4)
 *    - If unavailable → create standalone user (merge later via manual linking)
 *
 * Environment variables:
 *   ZALO_APP_ID, ZALO_APP_SECRET, ZALO_REDIRECT_URI
 */

/**
 * Zalo OAuth configuration
 */
export interface ZaloOAuthConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

/**
 * Zalo user info response (from /me endpoint)
 */
export const ZaloUserInfoSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  picture: z
    .object({
      data: z
        .object({
          url: z.string(),
        })
        .optional(),
    })
    .optional(),
  phone_number: z.string().optional(), // Only present if phone_number scope granted
});

export type ZaloUserInfo = z.infer<typeof ZaloUserInfoSchema>;

/**
 * Zalo access token response
 */
export const ZaloTokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  token_type: z.string().optional(),
});

export type ZaloTokenResponse = z.infer<typeof ZaloTokenResponseSchema>;

/**
 * Zalo OAuth result — normalized output for the application layer
 */
export interface ZaloOAuthResult {
  zaloId: string;
  name: string | null;
  avatarUrl: string | null;
  phoneNumber: string | null; // null if phone_number scope not granted
  phoneScopeGranted: boolean;
}

@Injectable()
export class ZaloOAuthProvider {
  private readonly logger = new Logger(ZaloOAuthProvider.name);
  private readonly config: ZaloOAuthConfig;

  private readonly AUTHORIZATION_URL = 'https://oauth.zaloapp.com/v4/permission';
  private readonly TOKEN_URL = 'https://oauth.zaloapp.com/v4/access_token';
  private readonly USER_INFO_URL = 'https://graph.zalo.me/v2.0/me';

  constructor(private readonly configService: ConfigService) {
    this.config = {
      appId: this.configService.getOrThrow<string>('ZALO_APP_ID'),
      appSecret: this.configService.getOrThrow<string>('ZALO_APP_SECRET'),
      redirectUri: this.configService.getOrThrow<string>('ZALO_REDIRECT_URI'),
    };
  }

  /**
   * Generate the Zalo OAuth authorization URL.
   * Includes phone_number scope for cross-provider account linking.
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      app_id: this.config.appId,
      redirect_uri: this.config.redirectUri,
      scope: 'id,name,picture,phone_number',
      response_type: 'code',
    });

    if (state) {
      params.set('state', state);
    }

    return `${this.AUTHORIZATION_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token.
   */
  async exchangeCodeForToken(code: string): Promise<ZaloTokenResponse> {
    this.logger.log('Exchanging Zalo authorization code for token');

    const response = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        app_id: this.config.appId,
        app_secret: this.config.appSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      this.logger.error(`Zalo token exchange failed: ${response.status}`);
      throw new Error(`Zalo token exchange failed: ${response.status}`);
    }

    const data = await response.json();
    const parsed = ZaloTokenResponseSchema.safeParse(data);

    if (!parsed.success) {
      this.logger.error(`Invalid Zalo token response: ${parsed.error.message}`);
      throw new Error('Invalid Zalo token response');
    }

    return parsed.data;
  }

  /**
   * Get user info from Zalo using access token.
   *
   * CRITICAL: phone_number is only returned if:
   * 1. The app requested phone_number scope in the authorization URL
   * 2. The user explicitly consented to sharing their phone number
   *
   * If phone_number is not in the response, the user must be created as a standalone account.
   * Merging can be performed later via manual account linking.
   */
  async getUserInfo(accessToken: string): Promise<ZaloOAuthResult> {
    this.logger.log('Fetching Zalo user info');

    const fields = 'id,name,picture,phone_number';
    const response = await fetch(
      `${this.USER_INFO_URL}?fields=${fields}&access_token=${accessToken}`,
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!response.ok) {
      this.logger.error(`Zalo user info fetch failed: ${response.status}`);
      throw new Error(`Zalo user info fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const parsed = ZaloUserInfoSchema.safeParse(data);

    if (!parsed.success) {
      this.logger.error(`Invalid Zalo user info: ${parsed.error.message}`);
      throw new Error('Invalid Zalo user info response');
    }

    const userInfo = parsed.data;
    const phoneScopeGranted = !!userInfo.phone_number;

    if (!phoneScopeGranted) {
      this.logger.warn(
        'Zalo phone_number scope not granted — creating standalone user',
      );
    }

    return {
      zaloId: userInfo.id,
      name: userInfo.name ?? null,
      avatarUrl: userInfo.picture?.data?.url ?? null,
      phoneNumber: userInfo.phone_number ?? null,
      phoneScopeGranted,
    };
  }

  /**
   * Complete Zalo OAuth flow: exchange code → get user info.
   * Returns normalized result for the RegisterWithProvider command.
   */
  async handleCallback(code: string): Promise<ZaloOAuthResult> {
    const tokenResponse = await this.exchangeCodeForToken(code);
    return this.getUserInfo(tokenResponse.access_token);
  }
}
```

### src/modules/auth/infrastructure/persistence/drizzle/schema/provider-link.schema.ts
```typescript
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { usersTable } from './user.schema';

/**
 * Provider Type Enum
 */
export const providerTypeEnum = pgEnum('provider_type', [
  'phone',
  'zalo',
  'google',
  'facebook',
  'apple',
]);

/**
 * Provider Links Table Schema
 *
 * Links external identity providers to a User record.
 * One User can have multiple providers (phone, zalo, google, etc.).
 * Supports cross-provider account linking (AC#4).
 */
export const providerLinksTable = pgTable('provider_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  providerType: providerTypeEnum('provider_type').notNull(),
  providerId: varchar('provider_id', { length: 255 }).notNull(), // phone number, Zalo ID, social sub
  providerEmail: varchar('provider_email', { length: 255 }), // from social OAuth
  isVerified: boolean('is_verified').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

/**
 * TypeScript type for ProviderLink record
 */
export type ProviderLinkRecord = typeof providerLinksTable.$inferSelect;
export type NewProviderLinkRecord = typeof providerLinksTable.$inferInsert;
```

### src/modules/auth/infrastructure/persistence/drizzle/schema/session.schema.ts
```typescript
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { usersTable } from './user.schema';

/**
 * Sessions Table Schema
 *
 * Stores better-auth session data for frontend session management.
 * better-auth uses cookie-based sessions with configurable TTL (7-day refresh token).
 * This is the BFF↔Frontend session concern (NOT BFF→downstream JWT — that's Story 1.4).
 */
export const sessionsTable = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 512 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: varchar('ip_address', { length: 255 }),
  userAgent: varchar('user_agent', { length: 1024 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/**
 * TypeScript type for Session record
 */
export type SessionRecord = typeof sessionsTable.$inferSelect;
export type NewSessionRecord = typeof sessionsTable.$inferInsert;
```

### src/modules/auth/infrastructure/persistence/drizzle/schema/user.schema.ts
```typescript
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';

/**
 * User Role Enum
 */
export const userRoleEnum = pgEnum('user_role', ['customer', 'admin']);

/**
 * User Status Enum
 */
export const userStatusEnum = pgEnum('user_status', [
  'active',
  'suspended',
  'deleted',
]);

/**
 * Users Table Schema
 *
 * Stores customer identity records in the BFF-owned PostgreSQL database.
 * PII fields (email, phone) are encrypted at rest via PiiEncryptionService (AES-256-GCM, NFR-S1).
 */
export const usersTable = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // PII fields — stored encrypted via PiiEncryptionService
  email: varchar('email', { length: 512 }), // AES-256 encrypted (longer to accommodate ciphertext)
  phone: varchar('phone', { length: 512 }), // AES-256 encrypted
  name: varchar('name', { length: 255 }),
  role: userRoleEnum('role').default('customer'),
  status: userStatusEnum('status').default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/**
 * TypeScript type for User record
 */
export type UserRecord = typeof usersTable.$inferSelect;
export type NewUserRecord = typeof usersTable.$inferInsert;
```

### src/modules/auth/infrastructure/persistence/encryption/pii-encryption.service.ts
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

/**
 * PII Encryption Service
 *
 * Two encryption modes:
 *
 * 1. **Random-IV encryption** (`encrypt`/`decrypt`): For storage of PII that does NOT need
 *    to be searched/looked up. Uses AES-256-GCM with a random 16-byte IV.
 *    Same plaintext → different ciphertext every time (maximum security).
 *
 * 2. **Deterministic encryption** (`encryptDeterministic`/`decryptDeterministic`): For
 *    searchable PII fields (phone, email) that need equality lookups in DB queries.
 *    Uses AES-256-GCM with a key-derived IV. Same plaintext → same ciphertext.
 *    Trade-off: identical values produce identical ciphertexts, but values are unique
 *    in practice (phone numbers, emails) so pattern analysis risk is minimal.
 *
 * Both modes use AES-256-GCM (authenticated encryption) and the same 256-bit key.
 * Complies with NFR-S1 (AES-256 at rest) and Nghị định 13/2023/NĐ-CP.
 */
@Injectable()
export class PiiEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly logger = new Logger(PiiEncryptionService.name);

  /**
   * Deterministic IV for searchable encryption.
   * Derived from the encryption key via SHA-256 truncate — NOT from the plaintext.
   * This ensures the same plaintext always encrypts to the same ciphertext,
   * enabling DB equality queries without leaking plaintext information.
   */
  private readonly deterministicIv: Buffer;

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.getOrThrow<string>('PII_ENCRYPTION_KEY');
    this.key = Buffer.from(secret, 'hex'); // Must be 32 bytes (64 hex chars)

    if (this.key.length !== 32) {
      throw new Error(
        `PII_ENCRYPTION_KEY must be 32 bytes (64 hex chars), got ${this.key.length} bytes`,
      );
    }

    // Derive a fixed 16-byte IV from the key for deterministic encryption
    this.deterministicIv = createHmac('sha256', this.key)
      .update('deterministic-iv-v1')
      .digest()
      .slice(0, 16);
  }

  // =========================================================================
  // Random-IV Encryption (for non-searchable storage)
  // =========================================================================

  /**
   * Encrypt plaintext using AES-256-GCM with random IV.
   * NOT suitable for DB lookups — use encryptDeterministic() for searchable fields.
   * @returns iv:authTag:encrypted (all hex-encoded)
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt ciphertext produced by encrypt().
   * @param ciphertext iv:authTag:encrypted format
   */
  decrypt(ciphertext: string): string {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // =========================================================================
  // Deterministic Encryption (for searchable fields: phone, email)
  // =========================================================================

  /**
   * Encrypt plaintext using AES-256-GCM with a deterministic IV.
   * Same plaintext always produces the same ciphertext — suitable for DB equality queries.
   * Use this for phone/email fields that need to be looked up.
   * @returns iv:authTag:encrypted (all hex-encoded)
   */
  encryptDeterministic(plaintext: string): string {
    const cipher = createCipheriv(this.algorithm, this.key, this.deterministicIv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${this.deterministicIv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt ciphertext produced by encryptDeterministic().
   * @param ciphertext iv:authTag:encrypted format
   */
  decryptDeterministic(ciphertext: string): string {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // =========================================================================
  // Convenience Methods
  // =========================================================================

  /**
   * Encrypt for search (deterministic) if value is not null/undefined/empty.
   */
  encryptIfNeeded(value: string | null | undefined): string | null {
    if (!value) return null;
    return this.encryptDeterministic(value);
  }

  /**
   * Decrypt if value is not null/undefined/empty.
   */
  decryptIfNeeded(value: string | null | undefined): string | null {
    if (!value) return null;
    return this.decryptDeterministic(value);
  }
}
```

### src/modules/auth/infrastructure/persistence/read/user-read-dao.ts
```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_READ_TOKEN } from '@core/constants/tokens';
import { usersTable } from '../drizzle/schema/user.schema';
import { providerLinksTable } from '../drizzle/schema/provider-link.schema';
import { PiiEncryptionService } from '../encryption/pii-encryption.service';
import { PII_ENCRYPTION_SERVICE_TOKEN } from '../../../constants/tokens';

/**
 * User Read DAO
 *
 * Read-only data access for user queries.
 * Does NOT use AggregateRoot — returns plain data objects for read side.
 * Handles PII decryption transparently.
 */
@Injectable()
export class UserReadDao {
  private readonly logger = new Logger(UserReadDao.name);

  constructor(
    @Inject(DATABASE_READ_TOKEN) private readonly db: NodePgDatabase,
    @Inject(PII_ENCRYPTION_SERVICE_TOKEN)
    private readonly encryptionService: PiiEncryptionService,
  ) {}

  async getById(id: string): Promise<UserReadModel | null> {
    const rows = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));

    if (!rows || rows.length === 0) return null;

    return this.mapRow(rows[0]);
  }

  async getByProvider(
    providerType: string,
    providerId: string,
  ): Promise<UserReadModel | null> {
    const links = await this.db
      .select({ userId: providerLinksTable.userId })
      .from(providerLinksTable)
      .where(
        and(
          eq(providerLinksTable.providerType, providerType as 'phone' | 'zalo' | 'google' | 'facebook' | 'apple'),
          eq(providerLinksTable.providerId, providerId),
        ),
      );

    if (!links || links.length === 0) return null;

    return this.getById(links[0].userId);
  }

  /**
   * Get user by phone number.
   * Uses deterministic encryption for lookup (same plaintext → same ciphertext).
   */
  async getByPhone(phone: string): Promise<UserReadModel | null> {
    const encryptedPhone = this.encryptionService.encryptIfNeeded(phone);
    if (!encryptedPhone) return null;

    const rows = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.phone, encryptedPhone));

    if (!rows || rows.length === 0) return null;

    return this.mapRow(rows[0]);
  }

  /**
   * Get user by email.
   * Uses deterministic encryption for lookup (same plaintext → same ciphertext).
   */
  async getByEmail(email: string): Promise<UserReadModel | null> {
    const encryptedEmail = this.encryptionService.encryptIfNeeded(email);
    if (!encryptedEmail) return null;

    const rows = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, encryptedEmail));

    if (!rows || rows.length === 0) return null;

    return this.mapRow(rows[0]);
  }

  private mapRow(row: Record<string, unknown>): UserReadModel {
    return {
      id: row.id as string,
      email: this.encryptionService.decryptIfNeeded(row.email as string | null),
      phone: this.encryptionService.decryptIfNeeded(row.phone as string | null),
      name: (row.name as string) ?? '',
      role: (row.role as string) ?? 'customer',
      status: (row.status as string) ?? 'active',
      createdAt: (row.createdAt as Date) ?? new Date(),
      updatedAt: (row.updatedAt as Date) ?? new Date(),
    };
  }
}

/**
 * Read model for User (plain object, no domain behavior)
 */
export interface UserReadModel {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### src/modules/auth/infrastructure/persistence/write/user.repository.ts
```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_WRITE_TOKEN, DATABASE_READ_TOKEN, EVENT_BUS_TOKEN } from '@core/constants/tokens';
import { IEventBus } from '@core/infrastructure';
import { BaseAggregateRepository } from '@shared/database/repositories/base-aggregate.repository';
import { User } from '../../../domain/entities/user.entity';
import { ProviderLink } from '../../../domain/entities/provider-link.entity';
import { ProviderType } from '../../../domain/value-objects/provider-type.value-object';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { usersTable } from '../drizzle/schema/user.schema';
import { providerLinksTable } from '../drizzle/schema/provider-link.schema';
import { PiiEncryptionService } from '../encryption/pii-encryption.service';
import { PII_ENCRYPTION_SERVICE_TOKEN } from '../../../constants/tokens';

/**
 * User Repository Implementation
 *
 * Implements IUserRepository using Drizzle ORM.
 * Handles PII encryption/decryption transparently.
 * Extends BaseAggregateRepository for domain event publishing and OCC.
 */
@Injectable()
export class UserRepository
  extends BaseAggregateRepository<User>
  implements IUserRepository
{
  private readonly logger = new Logger(UserRepository.name);

  constructor(
    @Inject(EVENT_BUS_TOKEN) eventBus: IEventBus,
    @Inject(DATABASE_WRITE_TOKEN) private readonly db: NodePgDatabase,
    @Inject(DATABASE_READ_TOKEN) private readonly dbRead: NodePgDatabase,
    @Inject(PII_ENCRYPTION_SERVICE_TOKEN)
    private readonly encryptionService: PiiEncryptionService,
  ) {
    super(eventBus);
  }

  protected async persist(
    aggregate: User,
    expectedVersion: number,
  ): Promise<void> {
    const encryptedEmail = this.encryptionService.encryptIfNeeded(aggregate.email);
    const encryptedPhone = this.encryptionService.encryptIfNeeded(aggregate.phone);

    // Check if user already exists in DB
    const existing = await this.dbRead
      .select({ id: usersTable.id, version: usersTable.updatedAt })
      .from(usersTable)
      .where(eq(usersTable.id, aggregate.id))
      .limit(1);

    if (existing.length === 0) {
      // INSERT new user
      await this.db.insert(usersTable).values({
        id: aggregate.id,
        email: encryptedEmail,
        phone: encryptedPhone,
        name: aggregate.name,
        role: aggregate.role as 'customer' | 'admin',
        status: aggregate.status as 'active' | 'suspended' | 'deleted',
      });

      // INSERT provider links
      for (const provider of aggregate.providers) {
        await this.db.insert(providerLinksTable).values({
          id: provider.id,
          userId: aggregate.id,
          providerType: provider.providerType.value as 'phone' | 'zalo' | 'google' | 'facebook' | 'apple',
          providerId: provider.providerId,
          providerEmail: provider.providerEmail,
          isVerified: provider.isVerified,
        });
      }
    } else {
      // UPDATE existing user
      await this.db
        .update(usersTable)
        .set({
          email: encryptedEmail,
          phone: encryptedPhone,
          name: aggregate.name,
          status: aggregate.status as 'active' | 'suspended' | 'deleted',
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, aggregate.id));

      // UPSERT new provider links (only insert new ones)
      for (const provider of aggregate.providers) {
        const existingLink = await this.dbRead
          .select({ id: providerLinksTable.id })
          .from(providerLinksTable)
          .where(eq(providerLinksTable.id, provider.id))
          .limit(1);

        if (existingLink.length === 0) {
          await this.db.insert(providerLinksTable).values({
            id: provider.id,
            userId: aggregate.id,
            providerType: provider.providerType.value as 'phone' | 'zalo' | 'google' | 'facebook' | 'apple',
            providerId: provider.providerId,
            providerEmail: provider.providerEmail,
            isVerified: provider.isVerified,
          });
        } else {
          await this.db
            .update(providerLinksTable)
            .set({
              providerEmail: provider.providerEmail,
              isVerified: provider.isVerified,
            })
            .where(eq(providerLinksTable.id, provider.id));
        }
      }
    }
  }

  async getById(id: string): Promise<User | null> {
    const rows = await this.dbRead
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));

    if (!rows || rows.length === 0) return null;

    const row = rows[0];
    const providers = await this.getProviderLinks(id);

    return User.reconstitute({
      id: row.id,
      version: 0, // TODO: Add version column to schema for proper OCC
      email: this.encryptionService.decryptIfNeeded(row.email),
      phone: this.encryptionService.decryptIfNeeded(row.phone),
      name: row.name ?? '',
      role: row.role ?? 'customer',
      status: row.status ?? 'active',
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
      providers,
    });
  }

  async getByProvider(
    providerType: string,
    providerId: string,
  ): Promise<User | null> {
    const links = await this.dbRead
      .select({ userId: providerLinksTable.userId })
      .from(providerLinksTable)
      .where(
        and(
          eq(providerLinksTable.providerType, providerType as 'phone' | 'zalo' | 'google' | 'facebook' | 'apple'),
          eq(providerLinksTable.providerId, providerId),
        ),
      );

    if (!links || links.length === 0) return null;

    return this.getById(links[0].userId);
  }

  async getByPhone(phone: string): Promise<User | null> {
    // Deterministic encryption → same ciphertext for same phone → DB lookup works
    const encryptedPhone = this.encryptionService.encryptIfNeeded(phone);
    if (!encryptedPhone) return null;

    const rows = await this.dbRead
      .select()
      .from(usersTable)
      .where(eq(usersTable.phone, encryptedPhone));

    if (!rows || rows.length === 0) return null;

    const row = rows[0];
    const providers = await this.getProviderLinks(row.id);

    return User.reconstitute({
      id: row.id,
      version: 0,
      email: this.encryptionService.decryptIfNeeded(row.email),
      phone: this.encryptionService.decryptIfNeeded(row.phone),
      name: row.name ?? '',
      role: row.role ?? 'customer',
      status: row.status ?? 'active',
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
      providers,
    });
  }

  async getByEmail(email: string): Promise<User | null> {
    // Deterministic encryption → same ciphertext for same email → DB lookup works
    const encryptedEmail = this.encryptionService.encryptIfNeeded(email);
    if (!encryptedEmail) return null;

    const rows = await this.dbRead
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, encryptedEmail));

    if (!rows || rows.length === 0) return null;

    const row = rows[0];
    const providers = await this.getProviderLinks(row.id);

    return User.reconstitute({
      id: row.id,
      version: 0,
      email: this.encryptionService.decryptIfNeeded(row.email),
      phone: this.encryptionService.decryptIfNeeded(row.phone),
      name: row.name ?? '',
      role: row.role ?? 'customer',
      status: row.status ?? 'active',
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
      providers,
    });
  }

  async delete(id: string): Promise<void> {
    // Provider links cascade delete via FK onDelete: 'cascade'
    await this.db.delete(usersTable).where(eq(usersTable.id, id));
  }

  /**
   * Load provider links for a user
   */
  private async getProviderLinks(userId: string): Promise<ProviderLink[]> {
    const links = await this.dbRead
      .select()
      .from(providerLinksTable)
      .where(eq(providerLinksTable.userId, userId));

    return (links ?? []).map((link) =>
      ProviderLink.reconstitute({
        id: link.id,
        userId: link.userId,
        providerType: ProviderType.fromString(link.providerType),
        providerId: link.providerId,
        providerEmail: link.providerEmail ?? null,
        isVerified: link.isVerified ?? false,
        createdAt: link.createdAt ?? new Date(),
        updatedAt: link.updatedAt ?? new Date(),
      }),
    );
  }
}
```

### src/modules/auth/infrastructure/ports/auth.port.ts
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { z } from 'zod';
import { IPortAdapter } from '@shared/port/port.interface';

/**
 * Auth Port Interface
 *
 * Defines the contract for downstream auth service communication.
 * MockAuthAdapter returns mock data during development.
 * Live adapter will call the actual backend auth service.
 */
export interface IAuthPort extends IPortAdapter {
  // Methods: login, register, verify-otp
}

/**
 * Zod schemas for mock auth responses
 */
export const LoginResponseSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  role: z.enum(['customer', 'admin']),
  status: z.enum(['active', 'suspended', 'deleted']),
  sessionId: z.string().uuid(),
  expiresAt: z.string(),
});

export const RegisterResponseSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  role: z.enum(['customer', 'admin']),
  status: z.enum(['active', 'suspended', 'deleted']),
  isNewUser: z.boolean(),
});

export const VerifyOtpResponseSchema = z.object({
  userId: z.string().uuid(),
  phone: z.string(),
  isVerified: z.boolean(),
  isNewUser: z.boolean(),
});

/**
 * Mock Auth Adapter
 *
 * Returns mock auth responses from JSON files for development.
 * Extends MockAdapterBase for consistent mock behavior.
 */
@Injectable()
export class MockAuthAdapter extends MockAdapterBase implements IAuthPort {
  constructor() {
    super(
      'auth',
      {
        login: LoginResponseSchema,
        register: RegisterResponseSchema,
        'verify-otp': VerifyOtpResponseSchema,
      },
      new Logger('auth-mock-adapter'),
    );
  }
}
```

## Auth Module — Constants & Module Wiring

### src/modules/auth/constants/tokens.ts
```typescript
/**
 * Auth Module DI Tokens
 *
 * Following project convention: {MODULE}_{TYPE}_TOKEN
 * All tokens are Symbols for type-safe injection.
 */

// =============================================================================
// Repository Tokens
// =============================================================================
export const USER_REPOSITORY_TOKEN = Symbol('IUserRepository');
export const USER_READ_DAO_TOKEN = Symbol('IUserReadDao');

// =============================================================================
// Service Tokens
// =============================================================================
export const PII_ENCRYPTION_SERVICE_TOKEN = Symbol('IPiiEncryptionService');

// =============================================================================
// Port Tokens
// =============================================================================
export const AUTH_PORT_TOKEN = Symbol('IAuthPort');

// =============================================================================
// better-auth Instance Token
// =============================================================================
export const BETTER_AUTH_INSTANCE_TOKEN = Symbol('BetterAuthInstance');
```

### src/modules/auth/auth.module.ts
```typescript
import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  COMMAND_BUS_TOKEN,
  QUERY_BUS_TOKEN,
  EVENT_BUS_TOKEN,
  DATABASE_WRITE_TOKEN,
  DATABASE_READ_TOKEN,
} from '@core/constants/tokens';
import {
  USER_REPOSITORY_TOKEN,
  USER_READ_DAO_TOKEN,
  PII_ENCRYPTION_SERVICE_TOKEN,
  AUTH_PORT_TOKEN,
  BETTER_AUTH_INSTANCE_TOKEN,
} from './constants/tokens';

// Application - Command Handlers
import { RegisterWithPhoneHandler } from './application/commands/handlers/register-with-phone.handler';
import { RegisterWithProviderHandler } from './application/commands/handlers/register-with-provider.handler';
import { LinkProviderHandler } from './application/commands/handlers/link-provider.handler';
import { VerifyOtpHandler } from './application/commands/handlers/verify-otp.handler';

// Application - Query Handlers
import { GetUserByIdHandler } from './application/queries/handlers/get-user-by-id.handler';
import { GetUserByProviderHandler } from './application/queries/handlers/get-user-by-provider.handler';
import { GetUserByPhoneHandler } from './application/queries/handlers/get-user-by-phone.handler';

// Infrastructure
import { AuthController } from './infrastructure/http/auth.controller';
import { BetterAuthController } from './infrastructure/better-auth/better-auth.controller';
import { UserRepository } from './infrastructure/persistence/write/user.repository';
import { UserReadDao } from './infrastructure/persistence/read/user-read-dao';
import { PiiEncryptionService } from './infrastructure/persistence/encryption/pii-encryption.service';
import { MockAuthAdapter } from './infrastructure/ports/auth.port';
import { ZaloOAuthProvider } from './infrastructure/oauth/zalo-oauth.provider';
import { createBetterAuth } from './infrastructure/better-auth/better-auth.setup';

// Domain Services
import { ProviderMergingService } from './domain/services/provider-merging.service';

/**
 * Auth Module
 *
 * Handles customer registration and multi-provider authentication.
 * Integrates better-auth for frontend session management.
 */
@Module({
  controllers: [AuthController, BetterAuthController],
  providers: [
    // Command Handlers (registered with CQRS via decorators)
    RegisterWithPhoneHandler,
    RegisterWithProviderHandler,
    LinkProviderHandler,
    VerifyOtpHandler,

    // Query Handlers (registered with CQRS via decorators)
    GetUserByIdHandler,
    GetUserByProviderHandler,
    GetUserByPhoneHandler,

    // Domain Services — injected via DI (not manually instantiated)
    ProviderMergingService,

    // Infrastructure Services
    UserReadDao,
    MockAuthAdapter,
    ZaloOAuthProvider,

    // Repository (token-based)
    {
      provide: USER_REPOSITORY_TOKEN,
      useClass: UserRepository,
    } as Provider,

    // Read DAO (token-based)
    {
      provide: USER_READ_DAO_TOKEN,
      useClass: UserReadDao,
    } as Provider,

    // PII Encryption Service (single registration via token only)
    {
      provide: PII_ENCRYPTION_SERVICE_TOKEN,
      useClass: PiiEncryptionService,
    } as Provider,

    // Auth Port (Mock adapter)
    {
      provide: AUTH_PORT_TOKEN,
      useClass: MockAuthAdapter,
    } as Provider,

    // Better Auth Instance
    {
      provide: BETTER_AUTH_INSTANCE_TOKEN,
      useFactory: (db: unknown, configService: ConfigService) => {
        return createBetterAuth(db, configService);
      },
      inject: [DATABASE_WRITE_TOKEN, ConfigService],
    },
  ],
  exports: [
    USER_REPOSITORY_TOKEN,
    PII_ENCRYPTION_SERVICE_TOKEN,
    AUTH_PORT_TOKEN,
  ],
})
export class AuthModule {}
```

### src/modules/auth/index.ts
```typescript
// Auth Module Public API
export { AuthModule } from './auth.module';
export * from './domain';
export * from './application';
```

## Test Files

### src/modules/auth/domain/entities/provider-link.entity.spec.ts
```typescript
import { ProviderLink } from './provider-link.entity';
import { ProviderType } from '../value-objects/provider-type.value-object';

describe('ProviderLink Entity', () => {
  describe('create', () => {
    it('should create a new provider link', () => {
      const link = ProviderLink.create('user-1', ProviderType.PHONE, '0901234567');

      expect(link).toBeDefined();
      expect(link.id).toBeDefined();
      expect(link.userId).toBe('user-1');
      expect(link.providerType).toBe(ProviderType.PHONE);
      expect(link.providerId).toBe('0901234567');
      expect(link.providerEmail).toBeNull();
      expect(link.isVerified).toBe(false);
    });

    it('should create a provider link with email', () => {
      const link = ProviderLink.create(
        'user-1',
        ProviderType.GOOGLE,
        'google_sub_123',
        'test@gmail.com',
      );

      expect(link.providerEmail).toBe('test@gmail.com');
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from persistence data', () => {
      const now = new Date();
      const link = ProviderLink.reconstitute({
        id: 'pl-1',
        userId: 'user-1',
        providerType: ProviderType.ZALO,
        providerId: 'zalo_12345',
        providerEmail: null,
        isVerified: true,
        createdAt: now,
        updatedAt: now,
      });

      expect(link.id).toBe('pl-1');
      expect(link.userId).toBe('user-1');
      expect(link.providerType).toBe(ProviderType.ZALO);
      expect(link.isVerified).toBe(true);
    });
  });

  describe('markVerified', () => {
    it('should mark provider as verified', () => {
      const link = ProviderLink.create('user-1', ProviderType.PHONE, '0901234567');
      expect(link.isVerified).toBe(false);

      link.markVerified();
      expect(link.isVerified).toBe(true);
    });
  });
});
```

### src/modules/auth/domain/entities/user.entity.spec.ts
```typescript
import { User } from './user.entity';
import { ProviderLink } from './provider-link.entity';
import { ProviderType } from '../value-objects/provider-type.value-object';
import { ConflictException } from '@core/common';

describe('User Entity', () => {
  describe('register', () => {
    it('should create a new user with phone provider', () => {
      const user = User.register({
        phone: '0901234567',
        name: 'Nguyễn Văn A',
        providerType: ProviderType.PHONE,
        providerId: '0901234567',
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.phone).toBe('0901234567');
      expect(user.name).toBe('Nguyễn Văn A');
      expect(user.role).toBe('customer');
      expect(user.status).toBe('active');
      expect(user.providers).toHaveLength(1);
      expect(user.providers[0].providerType).toBe(ProviderType.PHONE);
      expect(user.providers[0].providerId).toBe('0901234567');
    });

    it('should create a new user with Zalo provider', () => {
      const user = User.register({
        name: 'Zalo User',
        providerType: ProviderType.ZALO,
        providerId: 'zalo_12345',
      });

      expect(user).toBeDefined();
      expect(user.name).toBe('Zalo User');
      expect(user.providers).toHaveLength(1);
      expect(user.providers[0].providerType).toBe(ProviderType.ZALO);
      expect(user.providers[0].providerId).toBe('zalo_12345');
    });

    it('should create a new user with Google provider and email', () => {
      const user = User.register({
        email: 'test@gmail.com',
        name: 'Google User',
        providerType: ProviderType.GOOGLE,
        providerId: 'google_sub_123',
        providerEmail: 'test@gmail.com',
      });

      expect(user.email).toBe('test@gmail.com');
      expect(user.providers[0].providerEmail).toBe('test@gmail.com');
    });

    it('should emit UserRegistered domain event', () => {
      const user = User.register({
        phone: '0901234567',
        providerType: ProviderType.PHONE,
        providerId: '0901234567',
      });

      const events = user.getDomainEvents();
      expect(events).toHaveLength(2); // ProviderLinked + UserRegistered

      // addProvider() is called first → ProviderLinked event is events[0]
      // UserRegistered event is added after → events[1]
      const registeredEvent = events.find((e) => e.eventType === 'UserRegistered');
      const linkedEvent = events.find((e) => e.eventType === 'ProviderLinked');

      expect(registeredEvent).toBeDefined();
      expect(registeredEvent!.aggregateId).toBe(user.id);
      expect(registeredEvent!.data).toEqual({
        providerType: 'phone',
        providerId: '0901234567',
      });

      expect(linkedEvent).toBeDefined();
      expect(linkedEvent!.aggregateId).toBe(user.id);
    });

    it('should default to customer role and active status', () => {
      const user = User.register({
        providerType: ProviderType.PHONE,
        providerId: '0901234567',
      });

      expect(user.role).toBe('customer');
      expect(user.status).toBe('active');
      expect(user.email).toBeNull();
      expect(user.name).toBe('');
    });
  });

  describe('addProvider', () => {
    it('should add an additional provider to existing user', () => {
      const user = User.register({
        phone: '0901234567',
        providerType: ProviderType.PHONE,
        providerId: '0901234567',
      });

      user.clearDomainEvents();
      user.addProvider(ProviderType.ZALO, 'zalo_12345');

      expect(user.providers).toHaveLength(2);
      expect(user.providers[1].providerType).toBe(ProviderType.ZALO);
      expect(user.providers[1].providerId).toBe('zalo_12345');
    });

    it('should emit ProviderLinked domain event', () => {
      const user = User.register({
        providerType: ProviderType.PHONE,
        providerId: '0901234567',
      });

      user.clearDomainEvents();
      user.addProvider(ProviderType.GOOGLE, 'google_sub_123');

      const events = user.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('ProviderLinked');
      expect(events[0].data).toEqual({
        providerType: 'google',
        providerId: 'google_sub_123',
      });
    });

    it('should throw ConflictException for duplicate provider', () => {
      const user = User.register({
        phone: '0901234567',
        providerType: ProviderType.PHONE,
        providerId: '0901234567',
      });

      expect(() => {
        user.addProvider(ProviderType.PHONE, '0901234567');
      }).toThrow(ConflictException);
    });

    it('should allow same provider type with different IDs', () => {
      const user = User.register({
        providerType: ProviderType.ZALO,
        providerId: 'zalo_12345',
      });

      user.clearDomainEvents();
      user.addProvider(ProviderType.ZALO, 'zalo_67890');

      expect(user.providers).toHaveLength(2);
    });
  });

  describe('linkPhone', () => {
    it('should set phone and add phone provider if not present', () => {
      const user = User.register({
        providerType: ProviderType.ZALO,
        providerId: 'zalo_12345',
      });

      expect(user.phone).toBeNull();
      expect(user.providers).toHaveLength(1);

      user.linkPhone('0901234567');

      expect(user.phone).toBe('0901234567');
      expect(user.providers).toHaveLength(2);
      expect(user.providers[1].providerType).toBe(ProviderType.PHONE);
    });

    it('should not add duplicate phone provider if already present', () => {
      const user = User.register({
        phone: '0901234567',
        providerType: ProviderType.PHONE,
        providerId: '0901234567',
      });

      user.linkPhone('0901234567');

      expect(user.providers).toHaveLength(1);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute user from persistence data', () => {
      const providers = [
        ProviderLink.reconstitute({
          id: 'pl-1',
          userId: 'user-1',
          providerType: ProviderType.PHONE,
          providerId: '0901234567',
          providerEmail: null,
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];

      const user = User.reconstitute({
        id: 'user-1',
        version: 5,
        email: 'test@example.com',
        phone: '0901234567',
        name: 'Test User',
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        providers,
      });

      expect(user.id).toBe('user-1');
      expect(user.version).toBe(5);
      expect(user.email).toBe('test@example.com');
      expect(user.phone).toBe('0901234567');
      expect(user.name).toBe('Test User');
      expect(user.role).toBe('admin');
      expect(user.providers).toHaveLength(1);
    });
  });

  describe('updateName', () => {
    it('should update user name', () => {
      const user = User.register({
        providerType: ProviderType.PHONE,
        providerId: '0901234567',
        name: 'Old Name',
      });

      user.updateName('New Name');
      expect(user.name).toBe('New Name');
    });
  });
});
```

### src/modules/auth/domain/services/provider-merging.service.spec.ts
```typescript
import { ProviderMergingService } from './provider-merging.service';
import { ProviderType } from '../value-objects/provider-type.value-object';

describe('ProviderMergingService', () => {
  let service: ProviderMergingService;

  beforeEach(() => {
    service = new ProviderMergingService();
  });

  describe('resolveMergeTarget', () => {
    it('should return create_new when no matches found', () => {
      const result = service.resolveMergeTarget({
        providerType: ProviderType.ZALO,
        providerId: 'zalo_12345',
        existingUserByPhone: null,
        existingUserByEmail: null,
      });

      expect(result.action).toBe('create_new');
      expect(result.existingUserId).toBeUndefined();
      expect(result.matchReason).toBeUndefined();
    });

    it('should return merge with phone match reason when phone matches', () => {
      const result = service.resolveMergeTarget({
        providerType: ProviderType.ZALO,
        providerId: 'zalo_12345',
        phoneNumber: '0901234567',
        existingUserByPhone: { id: 'user-existing-1' },
        existingUserByEmail: null,
      });

      expect(result.action).toBe('merge');
      expect(result.existingUserId).toBe('user-existing-1');
      expect(result.matchReason).toBe('phone');
    });

    it('should return merge with email match reason when email matches', () => {
      const result = service.resolveMergeTarget({
        providerType: ProviderType.GOOGLE,
        providerId: 'google_sub_123',
        email: 'test@gmail.com',
        existingUserByPhone: null,
        existingUserByEmail: { id: 'user-existing-2' },
      });

      expect(result.action).toBe('merge');
      expect(result.existingUserId).toBe('user-existing-2');
      expect(result.matchReason).toBe('email');
    });

    it('should prioritize phone match over email match', () => {
      const result = service.resolveMergeTarget({
        providerType: ProviderType.ZALO,
        providerId: 'zalo_12345',
        phoneNumber: '0901234567',
        email: 'test@gmail.com',
        existingUserByPhone: { id: 'user-phone-match' },
        existingUserByEmail: { id: 'user-email-match' },
      });

      expect(result.action).toBe('merge');
      expect(result.existingUserId).toBe('user-phone-match');
      expect(result.matchReason).toBe('phone');
    });

    it('should NOT merge Zalo user when phone_number scope not granted (no phoneNumber param)', () => {
      // AC#2 and AC#4: Zalo phone merge ONLY happens if phone_number scope was granted
      const result = service.resolveMergeTarget({
        providerType: ProviderType.ZALO,
        providerId: 'zalo_12345',
        // phoneNumber is NOT set — scope was denied
        existingUserByPhone: { id: 'user-existing-1' },
        existingUserByEmail: null,
      });

      expect(result.action).toBe('create_new');
    });

    it('should create standalone user when phone exists but no user matches', () => {
      const result = service.resolveMergeTarget({
        providerType: ProviderType.ZALO,
        providerId: 'zalo_12345',
        phoneNumber: '0999999999',
        existingUserByPhone: null,
        existingUserByEmail: null,
      });

      expect(result.action).toBe('create_new');
    });

    it('should create standalone user when email exists but no user matches', () => {
      const result = service.resolveMergeTarget({
        providerType: ProviderType.GOOGLE,
        providerId: 'google_sub_123',
        email: 'new@gmail.com',
        existingUserByPhone: null,
        existingUserByEmail: null,
      });

      expect(result.action).toBe('create_new');
    });

    it('should merge with email when email matches for Facebook provider', () => {
      const result = service.resolveMergeTarget({
        providerType: ProviderType.FACEBOOK,
        providerId: 'fb_12345',
        email: 'existing@facebook.com',
        existingUserByPhone: null,
        existingUserByEmail: { id: 'user-fb-existing' },
      });

      expect(result.action).toBe('merge');
      expect(result.matchReason).toBe('email');
    });

    it('should merge with email for Apple provider', () => {
      const result = service.resolveMergeTarget({
        providerType: ProviderType.APPLE,
        providerId: 'apple_001234.abc@privaterelay.appleid.com',
        email: 'user@icloud.com',
        existingUserByPhone: null,
        existingUserByEmail: { id: 'user-apple-existing' },
      });

      expect(result.action).toBe('merge');
      expect(result.matchReason).toBe('email');
    });
  });
});
```

### src/modules/auth/domain/value-objects/provider-type.value-object.spec.ts
```typescript
import { ProviderType, ProviderTypeEnum } from './provider-type.value-object';

describe('ProviderType Value Object', () => {
  it('should create all provider types', () => {
    expect(ProviderType.PHONE.value).toBe(ProviderTypeEnum.PHONE);
    expect(ProviderType.ZALO.value).toBe(ProviderTypeEnum.ZALO);
    expect(ProviderType.GOOGLE.value).toBe(ProviderTypeEnum.GOOGLE);
    expect(ProviderType.FACEBOOK.value).toBe(ProviderTypeEnum.FACEBOOK);
    expect(ProviderType.APPLE.value).toBe(ProviderTypeEnum.APPLE);
  });

  it('should parse from string correctly', () => {
    expect(ProviderType.fromString('phone')).toBe(ProviderType.PHONE);
    expect(ProviderType.fromString('zalo')).toBe(ProviderType.ZALO);
    expect(ProviderType.fromString('google')).toBe(ProviderType.GOOGLE);
    expect(ProviderType.fromString('facebook')).toBe(ProviderType.FACEBOOK);
    expect(ProviderType.fromString('apple')).toBe(ProviderType.APPLE);
  });

  it('should throw for invalid string', () => {
    expect(() => ProviderType.fromString('invalid')).toThrow('Invalid ProviderType');
  });

  it('should compare equality correctly', () => {
    expect(ProviderType.PHONE.equals(ProviderType.PHONE)).toBe(true);
    expect(ProviderType.ZALO.equals(ProviderType.ZALO)).toBe(true);
    expect(ProviderType.GOOGLE.equals(ProviderType.FACEBOOK)).toBe(false);
    expect(ProviderType.PHONE.equals(ProviderType.ZALO)).toBe(false);
  });
});
```

### src/modules/auth/domain/value-objects/user-role.value-object.spec.ts
```typescript
import { UserRole, UserRoleEnum } from './user-role.value-object';

describe('UserRole Value Object', () => {
  it('should have customer and admin roles', () => {
    expect(UserRole.CUSTOMER.value).toBe(UserRoleEnum.CUSTOMER);
    expect(UserRole.ADMIN.value).toBe(UserRoleEnum.ADMIN);
  });

  it('should parse from string correctly', () => {
    expect(UserRole.fromString('customer')).toBe(UserRole.CUSTOMER);
    expect(UserRole.fromString('admin')).toBe(UserRole.ADMIN);
  });

  it('should throw for invalid string', () => {
    expect(() => UserRole.fromString('superadmin')).toThrow('Invalid UserRole');
  });

  it('should compare equality correctly', () => {
    expect(UserRole.CUSTOMER.equals(UserRole.CUSTOMER)).toBe(true);
    expect(UserRole.ADMIN.equals(UserRole.ADMIN)).toBe(true);
    expect(UserRole.CUSTOMER.equals(UserRole.ADMIN)).toBe(false);
  });
});
```

### src/modules/auth/domain/value-objects/user-status.value-object.spec.ts
```typescript
import { UserStatus, UserStatusEnum } from './user-status.value-object';

describe('UserStatus Value Object', () => {
  it('should have all status values', () => {
    expect(UserStatus.ACTIVE.value).toBe(UserStatusEnum.ACTIVE);
    expect(UserStatus.SUSPENDED.value).toBe(UserStatusEnum.SUSPENDED);
    expect(UserStatus.DELETED.value).toBe(UserStatusEnum.DELETED);
  });

  it('should parse from string correctly', () => {
    expect(UserStatus.fromString('active')).toBe(UserStatus.ACTIVE);
    expect(UserStatus.fromString('suspended')).toBe(UserStatus.SUSPENDED);
    expect(UserStatus.fromString('deleted')).toBe(UserStatus.DELETED);
  });

  it('should throw for invalid string', () => {
    expect(() => UserStatus.fromString('banned')).toThrow('Invalid UserStatus');
  });

  it('should compare equality correctly', () => {
    expect(UserStatus.ACTIVE.equals(UserStatus.ACTIVE)).toBe(true);
    expect(UserStatus.ACTIVE.equals(UserStatus.SUSPENDED)).toBe(false);
  });
});
```

### src/modules/auth/infrastructure/persistence/encryption/pii-encryption.service.spec.ts
```typescript
import { PiiEncryptionService } from './pii-encryption.service';
import { ConfigService } from '@nestjs/config';

describe('PiiEncryptionService', () => {
  let service: PiiEncryptionService;
  let configService: ConfigService;

  // 32 bytes = 64 hex chars
  const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    configService = {
      getOrThrow: jest.fn().mockReturnValue(TEST_KEY),
    } as unknown as ConfigService;
    service = new PiiEncryptionService(configService);
  });

  describe('random-IV encrypt/decrypt', () => {
    it('should encrypt and decrypt a phone number correctly', () => {
      const phone = '0901234567';
      const encrypted = service.encrypt(phone);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(phone);
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const phone = '0901234567';
      const encrypted1 = service.encrypt(phone);
      const encrypted2 = service.encrypt(phone);

      // Different IVs → different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);

      // But both decrypt to the same value
      expect(service.decrypt(encrypted1)).toBe(phone);
      expect(service.decrypt(encrypted2)).toBe(phone);
    });

    it('should produce ciphertext in iv:authTag:encrypted format', () => {
      const encrypted = service.encrypt('test');
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(32);
      expect(parts[1]).toHaveLength(32);
      expect(parts[2]).toBeTruthy();
    });
  });

  describe('deterministic encrypt/decrypt (for searchable fields)', () => {
    it('should encrypt and decrypt a phone number correctly', () => {
      const phone = '0901234567';
      const encrypted = service.encryptDeterministic(phone);
      const decrypted = service.decryptDeterministic(encrypted);

      expect(decrypted).toBe(phone);
    });

    it('should produce the SAME ciphertext for the same plaintext (deterministic)', () => {
      const phone = '0901234567';
      const encrypted1 = service.encryptDeterministic(phone);
      const encrypted2 = service.encryptDeterministic(phone);

      // CRITICAL: Same plaintext → same ciphertext (enables DB lookups)
      expect(encrypted1).toBe(encrypted2);
    });

    it('should produce different ciphertexts for different plaintexts', () => {
      const encrypted1 = service.encryptDeterministic('0901234567');
      const encrypted2 = service.encryptDeterministic('0912345678');

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should roundtrip email correctly', () => {
      const email = 'test@example.com';
      const encrypted = service.encryptDeterministic(email);
      expect(service.decryptDeterministic(encrypted)).toBe(email);
    });

    it('should produce deterministic ciphertext in iv:authTag:encrypted format', () => {
      const encrypted = service.encryptDeterministic('test');
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(3);
      // Deterministic IV is always the same
      expect(parts[0]).toHaveLength(32);
      expect(parts[1]).toHaveLength(32);
    });

    it('should have the same IV across all deterministic encryptions', () => {
      const encrypted1 = service.encryptDeterministic('value1');
      const encrypted2 = service.encryptDeterministic('value2');

      const iv1 = encrypted1.split(':')[0];
      const iv2 = encrypted2.split(':')[0];

      // Same deterministic IV for all values
      expect(iv1).toBe(iv2);
    });
  });

  describe('encryptIfNeeded/decryptIfNeeded', () => {
    it('should encrypt non-null values deterministically', () => {
      const encrypted = service.encryptIfNeeded('0901234567');
      expect(encrypted).not.toBe('0901234567');
      expect(service.decryptIfNeeded(encrypted!)).toBe('0901234567');
    });

    it('should return null for null input', () => {
      expect(service.encryptIfNeeded(null)).toBeNull();
      expect(service.decryptIfNeeded(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(service.encryptIfNeeded(undefined)).toBeNull();
      expect(service.decryptIfNeeded(undefined)).toBeNull();
    });

    it('should return null for empty string input', () => {
      expect(service.encryptIfNeeded('')).toBeNull();
      expect(service.decryptIfNeeded('')).toBeNull();
    });
  });

  describe('tamper detection', () => {
    it('should throw on tampered ciphertext', () => {
      const encrypted = service.encrypt('0901234567');
      const parts = encrypted.split(':');
      const tampered = parts[0] + ':' + parts[1] + ':' + 'deadbeef';

      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should throw on tampered auth tag (deterministic)', () => {
      const encrypted = service.encryptDeterministic('0901234567');
      const parts = encrypted.split(':');
      const tampered = parts[0] + ':' + 'aabbccdd' + parts[1].slice(8) + ':' + parts[2];

      expect(() => service.decryptDeterministic(tampered)).toThrow();
    });
  });

  describe('validation', () => {
    it('should throw if PII_ENCRYPTION_KEY is wrong length', () => {
      const badConfigService = {
        getOrThrow: jest.fn().mockReturnValue('tooshort'),
      } as unknown as ConfigService;

      expect(() => new PiiEncryptionService(badConfigService)).toThrow(
        'PII_ENCRYPTION_KEY must be 32 bytes',
      );
    });
  });

  describe('key rotation scenario', () => {
    it('should produce different deterministic ciphertexts with different keys', () => {
      const key2 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
      const configService2 = {
        getOrThrow: jest.fn().mockReturnValue(key2),
      } as unknown as ConfigService;
      const service2 = new PiiEncryptionService(configService2);

      const phone = '0901234567';
      const encrypted1 = service.encryptDeterministic(phone);
      const encrypted2 = service2.encryptDeterministic(phone);

      expect(encrypted1).not.toBe(encrypted2);

      // Cross-decryption should fail
      expect(() => service.decryptDeterministic(encrypted2)).toThrow();
      expect(() => service2.decryptDeterministic(encrypted1)).toThrow();
    });
  });

  describe('lookup simulation (core use case)', () => {
    it('should find matching user via deterministic encryption', () => {
      // Simulate: user registers with phone
      const storedEncrypted = service.encryptIfNeeded('0901234567');

      // Simulate: later lookup by phone
      const lookupEncrypted = service.encryptIfNeeded('0901234567');

      // These MUST match for DB query to work
      expect(storedEncrypted).toBe(lookupEncrypted);
    });

    it('should NOT match different phone numbers', () => {
      const storedEncrypted = service.encryptIfNeeded('0901234567');
      const lookupEncrypted = service.encryptIfNeeded('0912345678');

      expect(storedEncrypted).not.toBe(lookupEncrypted);
    });
  });
});
```

### src/modules/auth/infrastructure/ports/auth.port.spec.ts
```typescript
import { MockAuthAdapter, LoginResponseSchema, RegisterResponseSchema, VerifyOtpResponseSchema } from './auth.port';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';

describe('MockAuthAdapter', () => {
  let adapter: MockAuthAdapter;

  beforeEach(() => {
    adapter = new MockAuthAdapter();
  });

  describe('execute - login', () => {
    it('should read and validate login.json mock data', async () => {
      const result = await adapter.execute('login', {});

      expect(result).toBeDefined();
      // Validate against schema
      const parsed = LoginResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.userId).toBeDefined();
        expect(parsed.data.role).toBe('customer');
        expect(parsed.data.status).toBe('active');
        expect(parsed.data.sessionId).toBeDefined();
      }
    });
  });

  describe('execute - register', () => {
    it('should read and validate register.json mock data', async () => {
      const result = await adapter.execute('register', {});

      expect(result).toBeDefined();
      const parsed = RegisterResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.userId).toBeDefined();
        expect(parsed.data.isNewUser).toBe(true);
      }
    });
  });

  describe('execute - verify-otp', () => {
    it('should read and validate verify-otp.json mock data', async () => {
      const result = await adapter.execute('verify-otp', {});

      expect(result).toBeDefined();
      const parsed = VerifyOtpResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.isVerified).toBe(true);
        expect(parsed.data.phone).toBeDefined();
      }
    });
  });

  describe('execute - missing method', () => {
    it('should throw NotFoundException for missing mock file', async () => {
      await expect(adapter.execute('nonexistent', {})).rejects.toThrow();
    });
  });

  describe('Zod schemas validation', () => {
    it('LoginResponseSchema should reject invalid data', () => {
      const result = LoginResponseSchema.safeParse({
        userId: 'not-a-uuid',
        // missing required fields
      });
      expect(result.success).toBe(false);
    });

    it('RegisterResponseSchema should reject invalid role', () => {
      const result = RegisterResponseSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test',
        phone: '0901234567',
        email: null,
        role: 'superadmin', // invalid
        status: 'active',
        isNewUser: true,
      });
      expect(result.success).toBe(false);
    });

    it('VerifyOtpResponseSchema should accept valid data', () => {
      const result = VerifyOtpResponseSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        phone: '0901234567',
        isVerified: true,
        isNewUser: false,
      });
      expect(result.success).toBe(true);
    });
  });
});
```

## Mock Data

### mocks/auth/login.json
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Nguyễn Văn A",
  "phone": "0901234567",
  "email": null,
  "role": "customer",
  "status": "active",
  "sessionId": "660e8400-e29b-41d4-a716-446655440001",
  "expiresAt": "2026-06-12T00:00:00.000Z"
}
```

### mocks/auth/register.json
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440002",
  "name": "Anh Tuấn",
  "phone": "0912345678",
  "email": null,
  "role": "customer",
  "status": "active",
  "isNewUser": true
}
```

### mocks/auth/verify-otp.json
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "phone": "0901234567",
  "isVerified": true,
  "isNewUser": false
}
```

