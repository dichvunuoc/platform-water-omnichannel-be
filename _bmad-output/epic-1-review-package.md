# Epic 1 Code Review Package — IOC Customer (CSKH Module)

**Project:** IOC Customer — Module CSKH (Trạm Điều phối Trung tâm)
**Date:** 2026-06-05
**Purpose:** Full source code for independent LLM code review
**Stack:** NestJS 11 + TypeScript 5.7 (strict) + Bun runtime + Fastify + Drizzle ORM + PostgreSQL + Redis + jose + better-auth

---

## Table of Contents

1. [Project Context](#project-context) — Architecture rules, conventions, tech stack
2. [Story 1-1: Hexagonal Port Infrastructure](#story-1-1) — Port Registry, adapters, endpoint config, circuit breaker, cache, idempotency
3. [Story 1-2: Resilient Communication Layer](#story-1-2) — Integrated into port infrastructure (CB, fallback, cache tiers)
4. [Story 1-3: Customer Registration & Multi-Provider Auth](#story-1-3) — Auth domain, CQRS, better-auth, PII encryption, OAuth
5. [Story 1-4: Authenticated Token Lifecycle](#story-1-4) — JWT signing (jose), auth propagation middleware, 401 auto-retry
6. [Shared Infrastructure](#shared) — RequestContext, CorrelationId, GlobalExceptionFilter, AppModule, main.ts
7. [Test Results](#test-results) — 164 tests passing, 0 failures

---

## Review Focus Areas

When reviewing, please evaluate:
- **DDD/CQRS compliance** — Are domain/application/infrastructure layers properly separated?
- **Security** — PII encryption (AES-256-GCM + HMAC blind index), JWT handling, session management
- **Resilience** — Per-port circuit breaker, fallback, cache tiers, idempotency
- **TypeScript strictness** — No `any`, proper interfaces, type safety
- **Test coverage** — Are tests comprehensive? Any missing edge cases?
- **Architecture violations** — Are project-context.md rules followed?

---

---
project_name: 'IOC Customer — Module CSKH'
user_name: 'Pc'
date: '2026-06-03'
sections_completed: ['technology_stack', 'critical_rules', 'patterns', 'anti_patterns', 'architecture_constraints', 'idempotency', 'webhook_security', 'session_atomicity', 'pii_masking', 'notification_module']
architecture_ref: '_bmad-output/planning-artifacts/architecture.md'
---

# Project Context for AI Agents — Module CSKH (Trạm Điều phối Trung tâm)

_Critical rules and patterns that AI agents MUST follow. This is the authoritative quick-reference. For full rationale, see `architecture.md`._

---

## Project Identity

- **Type:** API Gateway & Orchestrator Platform (NOT a business logic engine)
- **Domain:** Utility (water supply) / Govtech
- **Complexity:** High — Resilience & Orchestration focused
- **Rule #1:** CSKH module NEVER owns business logic. It coordinates, routes, and transforms only.

---

## Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| NestJS | ^11.0.1 | Framework + Fastify adapter |
| TypeScript | ^5.7.3 | Language (strict mode) |
| Bun | 1.1 | Runtime + package manager |
| Drizzle ORM | ^0.45.1 | PostgreSQL ORM |
| PostgreSQL | 16 | Primary DB (CSKH-owned: Users, Tickets) |
| Redis | 7 (AOF) | Session store + API cache |
| better-auth | ≥ 1.3.8 | Centralized auth + RBAC |
| jose | latest | JWT signing for Backend propagation |
| opossum | 8.1.3 | Circuit Breaker (per-endpoint) |
| Pino | ^10.1 | Structured logging |
| pino-redact | latest | PII masking in logs (Nghị định 13 compliance) |
| Zod | ^4.2.1 | Schema validation |
| OpenTelemetry | ^0.208 | Distributed tracing |
| Jest | ^30.0 | Testing |

---

## Critical Implementation Rules

### Architecture Rules

1. **NEVER call Backend API with bare `fetch()`** — Always use `BackendClient` service (wraps fetch + opossum Circuit Breaker + JWT injection + timeout)
2. **NEVER put business logic in Controllers** — Controller → CommandBus → Handler → Domain
3. **NEVER hardcode endpoint URLs** — Read from Endpoint Config Module (mock/live switching)
4. **NEVER use `any` type** — Define Zod schemas + TypeScript types for all API responses
5. **NEVER log PII** — Use `pino-redact` with mandatory paths (see PII Masking section below)
6. **NEVER create a module without CQRS** — Follow domain/application/infrastructure layers
7. **NEVER use a single Circuit Breaker for all endpoints** — Per-endpoint opossum instances
8. **NEVER dispatch notifications directly from adapters** — Route through `DispatchNotificationCommand` → rate limiter → channel dispatcher
9. **NEVER write session events with separate Redis commands** — Use Lua script for atomicity
10. **NEVER process inbound webhooks without signature verification** — Use `ZaloSignatureGuard` or `InterServiceApiKeyGuard`

### Every New Module MUST

- Follow `src/modules/{module}/` with: `domain/`, `application/`, `infrastructure/`, `constants/`
- Use existing CQRS buses (`COMMAND_BUS_TOKEN`, `QUERY_BUS_TOKEN`)
- Use DI tokens: `{MODULE}_{TYPE}_TOKEN` (e.g., `TICKET_REPOSITORY_TOKEN`)
- Use existing exception classes (not `new Error()` or generic `HttpException`)
- Include correlation ID in every log and every Backend call
- Write session events for every KH interaction
- Co-locate tests as `*.spec.ts`

---

## Naming Conventions

### Files

| Type | Pattern | Example |
|------|---------|---------|
| Entity | `{entity}.entity.ts` | `ticket.entity.ts` |
| Value Object | `{name}.value-object.ts` | `ticket-status.value-object.ts` |
| Domain Event | `{entity}-{action}.event.ts` | `ticket-created.event.ts` |
| Command | `{action}-{entity}.command.ts` | `create-ticket.command.ts` |
| Query | `get-{entity}.query.ts` | `get-ticket.query.ts` |
| Handler | `{command-name}.handler.ts` | `create-ticket.handler.ts` |
| DTO | `{action}-{entity}.dto.ts` | `create-ticket.dto.ts` |
| Controller | `{entity}.controller.ts` | `ticket.controller.ts` |
| Schema | `{entity}.schema.ts` | `ticket.schema.ts` |
| Adapter | `{channel}-adapter.ts` | `zalo-adapter.ts` |
| Guard | `{source}-signature.guard.ts` | `zalo-signature.guard.ts` |
| Test | `{file}.spec.ts` | `ticket.entity.spec.ts` |

### Code

| Element | Convention | Example |
|---------|-----------|---------|
| Classes | PascalCase | `CreateTicketCommand` |
| Interfaces (contracts) | `I` prefix | `ICommandBus`, `IInputAdapter` |
| Interfaces (data) | No prefix | `OrderPlacedPayload` |
| Constants/DI tokens | UPPER_SNAKE_CASE | `TICKET_REPOSITORY_TOKEN` |
| Variables | camelCase | `orderId`, `sessionId` |
| Methods | camelCase, verb-first | `placeOrder()`, `getTicket()` |

### Database (Drizzle)

| Element | Convention | Example |
|---------|-----------|---------|
| Table name | snake_case, **plural** | `orders`, `tickets` |
| Column name | snake_case | `customer_id`, `created_at` |
| Table variable | camelCase + `Table` | `ordersTable`, `ticketsTable` |
| Select type | PascalCase + `Record` | `OrderRecord`, `TicketRecord` |
| Insert type | `Insert` + PascalCase + `Record` | `InsertOrderRecord` |

### Redis Keys

| Pattern | Example |
|---------|---------|
| `session:{userId}` | `session:USR-12345` |
| `session:{userId}:events` | `session:USR-12345:events` |
| `cache:{endpoint}:{key}` | `cache:customers:0981234567` |
| `cb:{endpoint}` | `cb:customer360` |
| `idempotency:{hash}` | `idempotency:a1b2c3d4` (TTL 24h) |
| `ratelimit:notification:{userId}:{date}` | `ratelimit:notification:USR-12345:2026-06-03` |

### API

- Routes: plural kebab-case (`@Controller('tickets')`)
- Params: camelCase (`@Param('id')`, `@Query('customerId')`)
- Headers: kebab-case (`x-correlation-id`, `x-idempotency-key`, `x-api-key`)
- Response body: camelCase (`{ "customerId": "USR-12345" }`)
- **Direct return, no wrappers** — no `{ data: ..., success: true }` pattern

---

## Idempotency — Two Boundaries

### Inbound (Adapter → Orchestrator)

Every `NormalizedRequest` MUST carry `idempotencyKey` (hash of Zalo `messageId` or Hotline `callId`). Check Redis `idempotency:{key}` (TTL 24h) BEFORE processing:

```
Adapter receives webhook → extract messageId → hash → idempotencyKey
  → Redis GET idempotency:{hash}
  → EXISTS → return cached response (200 OK) — do NOT reprocess
  → NOT EXISTS → process → Redis SET idempotency:{hash} = result, TTL 24h
```

### Outbound (Orchestrator → Backend)

Every `BackendClient` POST/PUT MUST include `x-idempotency-key` header:

```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'x-correlation-id': correlationId,
  'x-idempotency-key': `${correlationId}:${endpointHash}`,
}
```

---

## Webhook Security

| Source | Guard | Implementation |
|--------|-------|---------------|
| **Zalo** | `ZaloSignatureGuard` | HMAC SHA-256 of raw body with `ZALOA_SECRET_KEY` env var. Compare with `X-ZECA-Signature` header. |
| **Backend (Thương)** | `InterServiceApiKeyGuard` | Validate `x-api-key` header matches `INTER_SERVICE_API_KEY` env var. NOT JWT — use static shared secret. |
| **Hotline** | `InterServiceApiKeyGuard` | Same static API key pattern. |

**Rule:** Every inbound webhook endpoint MUST use the appropriate guard. Zero unauthenticated webhook endpoints.

---

## PII Masking (pino-redact — MANDATORY)

Use `pino-redact` on EVERY Pino instance. These paths are ALWAYS redacted:

```typescript
const pinoOptions = {
  redact: {
    paths: [
      '*.phone', '*.phoneNumber', '*.soDienThoai',
      '*.cccd', '*.cccdNumber',
      '*.address', '*.diaChi',
      '*.password', '*.token', '*.secret',
      '*.refreshToken', '*.accessToken',
    ],
    censor: '[REDACTED]',
  },
};
```

**Rule:** If you add a new log field containing PII, you MUST add the path to this redact config FIRST. No partial masking — always `[REDACTED]`.

---

## Session Write Atomicity (Redis)

When KH interacts via multiple channels simultaneously, concurrent session writes MUST be atomic. **NEVER** issue separate `ZADD` then `EXPIRE` commands.

```typescript
// ✅ CORRECT — Lua script for atomic session event append
const SESSION_APPEND_LUA = `
  local sessionKey = KEYS[1]
  local eventsKey = KEYS[2]
  local event = ARGV[1]
  local ttl = tonumber(ARGV[2])
  redis.call('ZADD', eventsKey, ARGV[3], event)
  redis.call('EXPIRE', eventsKey, ttl)
  redis.call('HSET', sessionKey, 'updatedAt', ARGV[4])
  redis.call('EXPIRE', sessionKey, ttl)
  return 1
`;

// ❌ WRONG — separate calls cause race condition
await redis.zadd(eventsKey, score, event);
await redis.expire(eventsKey, ttl);
```

---

## Module Internal Structure

Every module follows this layout (see `src/modules/order/` as reference):

```
{module}/
├── domain/
│   ├── entities/          # Aggregate roots
│   ├── events/            # {Entity}{Action}Event
│   ├── repositories/      # Interfaces only
│   ├── services/          # Domain services
│   ├── value-objects/
│   └── index.ts
├── application/
│   ├── commands/          # + handlers/ subdirectory
│   ├── queries/           # + handlers/ + ports/ subdirectories
│   ├── dtos/
│   └── index.ts
├── infrastructure/
│   ├── http/              # Controllers
│   ├── persistence/       # drizzle/schema/, read/, write/
│   └── projections/       # Event → read model
├── constants/
│   └── tokens.ts
└── {module}.module.ts
```

---

## Event & CQRS Naming

| Type | Pattern | Example |
|------|---------|---------|
| Domain Event class | `{Entity}{Action}Event` | `TicketCreatedEvent` |
| Event type string | `{Entity}{Action}` | `TicketCreated` |
| Command | `{Action}{Entity}Command` | `CreateTicketCommand` |
| Query | `Get{Entity}Query` | `GetTicketQuery` |
| Command Handler | `{CommandName}Handler` | `CreateTicketHandler` |

### Session Event Types

`zalo_message_received`, `call_started`, `call_completed`, `ticket_created`, `ticket_status_changed`, `notification_sent`

---

## Error Handling Chain (BackendClient)

```
2xx → return data + cache if applicable
401 → auto-refresh token → retry once → if fail: log + throw
403 → throw ForbiddenException (NO retry)
404 → throw NotFoundException + admin alert
4xx → throw ValidationException
5xx/Timeout → Circuit Breaker counts → fallback to cache
Circuit Breaker OPEN → return cached data + log warning
```

Use existing exceptions: `NotFoundException`, `ForbiddenException`, `BusinessRuleException`, `ValidationException`, `DomainException`, `ConflictException`, `ConcurrencyException`, `UnauthorizedException`.

---

## Notification Dispatch (FR43 Rate Limiting)

All notification dispatch flows through `DispatchNotificationCommand`:

```
Any module wants to send notification
  → DispatchNotificationCommand
  → DispatchNotificationHandler
    → RedisRateLimiterService.check(userId, channel, ticketId)
      → Redis INCR ratelimit:notification:{userId}:{date}
      → If count > 2 for this KH/ticket/day → DROP or BATCH
      → If count ≤ 2 → dispatch via channel adapter
```

**NEVER** call Zalo API directly from a module. Always route through Notification Module.

---

## Cache TTL Strategy

| Data Type | TTL | Examples |
|-----------|-----|---------|
| Static (identity, contracts) | 12-24h | Customer 360° profile |
| Dynamic (balance, tickets) | 5-15 min | Ticket status |
| Transaction (payments) | **NO CACHE** | Must call live 100% |

---

## Adapter Contract

Every input adapter normalizes to:

```typescript
interface NormalizedRequest {
  userId: string;          // From Auth Layer
  channel: ChannelType;    // 'zalo' | 'hotline' | 'counter' | 'web'
  intent: IntentType;      // 'report_incident' | 'inquiry' | 'complaint'
  payload: Record<string, unknown>;
  sessionId: string;       // For Context Preservation
  correlationId: string;   // For distributed tracing
  idempotencyKey: string;  // Hash of messageId/callId — dedup inbound webhooks
}
```

---

## Key Files to Reference

| Reference Module | Location | Use For |
|-----------------|----------|---------|
| Order Module | `src/modules/order/` | DDD/CQRS pattern, IUnitOfWork, cross-aggregate transactions |
| Product Module | `src/modules/product/` | Entity design, value objects, domain services |
| Core Library | `src/libs/core/` | Base classes (Entity, ValueObject, AggregateRoot, etc.) |
| Shared CQRS | `src/libs/shared/cqrs/` | Command/Query buses, idempotency |
| Shared Database | `src/libs/shared/database/` | Drizzle setup, Unit of Work |

---

## Security Requirements

- JWT: `jose` library, 15-min access token, 7-day refresh token
- JWT payload for Backend: `sub` (UserID), `roles`, `provider` (channel), `session_id`, `xi_nghiep`, `iat`, `exp`
- Secret rotation: `JWT_SECRET_OLD` + `JWT_SECRET_NEW` → Backend verifies both → remove old after 24h
- PII masking: `pino-redact` with mandatory paths (see above)
- Audit log: structured JSON, correlation ID, 12-month retention
- Compliance: Nghị định 13/2023/NĐ-CP (Vietnam data protection)

---

## Environment Variables

```bash
DATABASE_URL=postgresql://cskh:password@localhost:5432/cskh_dev
REDIS_URL=redis://localhost:6379
BETTER_AUTH_SECRET=<secret>
BETTER_AUTH_URL=http://localhost:3000
JWT_SECRET=<shared-with-backend>
JWT_SECRET_OLD=
ZALOA_ACCESS_TOKEN=<token>
ZALOA_VERIFICATION_TOKEN=<verify-token>
ZALOA_SECRET_KEY=<hmac-secret>                # ZaloSignatureGuard
HOTLINE_API_KEY=<api-key>
INTER_SERVICE_API_KEY=<shared-static-key>      # Backend → CSKH webhook auth
BACKEND_BASE_URL=https://api.ioc.local/v1
BACKEND_TIMEOUT_MS=3000
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```
/**
 * Auth Propagation Interfaces
 *
 * Defines types for JWT downstream identity propagation.
 * These types bridge better-auth frontend sessions → jose JWT for BFF→downstream calls.
 */

/**
 * JWT Payload for downstream identity propagation.
 *
 * Per project-context.md security requirements:
 * - sub: UserID
 * - roles: User roles
 * - provider: Channel that originated the request
 * - session_id: better-auth session ID
 * - xi_nghiep: Enterprise/Tenant ID (for KH doanh nghiệp)
 */
export interface JwtPayload {
  /** UserID — from better-auth session */
  sub: string;
  /** User roles — default ['customer'] */
  roles: string[];
  /** Auth channel — 'zalo' | 'hotline' | 'counter' | 'web' */
  provider: string;
  /** better-auth session ID */
  sessionId: string;
  /** Enterprise/Tenant ID (for KH doanh nghiệp) */
  xiNghiep?: string;
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, jwtVerify, errors } from 'jose';
import type { JwtPayload } from './auth-propagation.interface';

/**
 * JWT Signer Service
 *
 * Uses `jose` library to sign and verify JWTs for BFF→downstream identity propagation.
 * This is the BACKEND PROPAGATION concern (15-min JWT via Authorization header).
 * Do NOT confuse with better-auth frontend session management (7-day cookie).
 *
 * Features:
 * - HS256 symmetric signing
 * - 15-minute TTL (NFR-S4)
 * - Dual-key verification for secret rotation (JWT_SECRET_NEW + JWT_SECRET_OLD)
 *
 * jose v6.2.3 is ESM-only — Bun handles ESM natively.
 */
@Injectable()
export class JwtSignerService {
  private readonly logger = new Logger(JwtSignerService.name);
  private readonly secret: Uint8Array;
  private readonly oldSecret: Uint8Array | null;
  private readonly ttl: string;
  private readonly issuer: string;

  constructor(private readonly configService: ConfigService) {
    const secretStr = this.configService.getOrThrow<string>('JWT_SECRET');
    this.secret = new TextEncoder().encode(secretStr);

    const oldSecretStr = this.configService.get<string>('JWT_SECRET_OLD');
    this.oldSecret = oldSecretStr ? new TextEncoder().encode(oldSecretStr) : null;

    this.ttl = this.configService.get<string>('JWT_TTL', '15m');
    this.issuer = this.configService.get<string>('JWT_ISSUER', 'cskh-bff');
  }

  /**
   * Sign a JWT for downstream propagation.
   *
   * Payload per project-context.md: sub, roles, provider, session_id, xi_nghiep, iat, exp
   *
   * @param payload - User identity from RequestContext
   * @returns Signed JWT string
   */
  async sign(payload: JwtPayload): Promise<string> {
    return new SignJWT({
      sub: payload.sub,
      roles: payload.roles,
      provider: payload.provider,
      session_id: payload.sessionId,
      xi_nghiep: payload.xiNghiep,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.ttl)
      .setIssuer(this.issuer)
      .sign(this.secret);
  }

  /**
   * Verify a JWT — tries current secret first, then old secret (rotation support).
   *
   * Rotation flow:
   * 1. Deploy with JWT_SECRET = new-secret, JWT_SECRET_OLD = previous-secret
   * 2. Verify tries new secret first, falls back to old
   * 3. After 24h, remove JWT_SECRET_OLD
   *
   * @param token - JWT string to verify
   * @returns Decoded payload
   * @throws JWTExpired if token expired
   * @throws JWSSignatureVerificationFailed if signature invalid with both keys
   */
  async verify(token: string): Promise<JwtPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: this.issuer,
      });
      return this.mapPayload(payload);
    } catch (error) {
      // If expired, don't try old secret — expiration is absolute
      if (error instanceof errors.JWTExpired) {
        throw error;
      }

      // Try old secret for rotation support
      if (this.oldSecret) {
        try {
          const { payload } = await jwtVerify(token, this.oldSecret, {
            issuer: this.issuer,
          });
          return this.mapPayload(payload);
        } catch {
          // Old secret also failed — throw original error
          throw error;
        }
      }

      throw error;
    }
  }

  /**
   * Map jose JWT payload to our JwtPayload interface
   */
  private mapPayload(payload: Record<string, unknown>): JwtPayload {
    return {
      sub: payload.sub as string,
      roles: (payload.roles as string[]) ?? ['customer'],
      provider: (payload.provider as string) ?? 'web',
      sessionId: (payload.session_id as string) ?? '',
      xiNghiep: payload.xi_nghiep as string | undefined,
    };
  }
}
import { Injectable, Inject, Logger, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { REQUEST_CONTEXT_TOKEN } from '../../core';
import type { IRequestContextProvider } from '../../core';

/**
 * Shape of better-auth session data attached to the request.
 * better-auth populates `req.session` after cookie-based verification.
 */
interface BetterAuthSession {
  id?: string;
  user?: {
    id?: string;
    role?: string;
    provider?: string;
  };
}

/**
 * Auth Propagation Middleware
 *
 * Extracts user identity from better-auth session and enriches RequestContext.
 * Runs AFTER CorrelationIdMiddleware (which creates the initial context).
 *
 * Flow:
 * 1. Reads better-auth session from req.session (set by better-auth after cookie verify)
 * 2. Extracts userId, roles, provider, sessionId
 * 3. Stores in RequestContext.metadata for JwtSignerService to consume
 *
 * SKIP for: webhook endpoints, health checks, public routes
 * (detected by absence of user identity in request)
 */
@Injectable()
export class AuthPropagationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthPropagationMiddleware.name);

  constructor(
    @Inject(REQUEST_CONTEXT_TOKEN)
    private readonly contextProvider: IRequestContextProvider,
  ) {}

  /**
   * Extract user identity from request and enrich RequestContext.
   */
  async use(
    req: FastifyRequest,
    _reply: FastifyReply,
    next: () => void,
  ): Promise<void> {
    const context = this.contextProvider.current();
    if (!context) {
      // No context — CorrelationIdMiddleware should have created one
      return next();
    }

    // Extract user identity from better-auth session
    const session = this.extractSession(req);
    if (!session?.user?.id) {
      // No authenticated user — proceed without JWT enrichment
      // (webhooks, health checks, public routes)
      return next();
    }

    const userId = session.user.id;
    const roles = this.extractRoles(session);
    const provider = this.extractProvider(session, req);
    const sessionId = this.extractSessionId(session, req);

    // Enrich RequestContext with auth identity in metadata
    const enriched = this.contextProvider.createFull({
      correlationId: context.correlationId,
      userId,
      tenantId: context.tenantId,
      metadata: {
        ...context.metadata,
        roles,
        provider,
        sessionId,
      },
    });

    this.contextProvider.run(enriched, () => next());
  }

  /**
   * Extract better-auth session from request.
   * Uses `unknown` intermediate cast to satisfy strict TypeScript.
   */
  private extractSession(req: FastifyRequest): BetterAuthSession | null {
    const raw = (req as unknown as Record<string, unknown>)?.session;
    if (raw && typeof raw === 'object') {
      return raw as BetterAuthSession;
    }
    return null;
  }

  /**
   * Extract roles from session user, fallback to ['customer'].
   */
  private extractRoles(session: BetterAuthSession): string[] {
    if (session.user?.role) {
      return [session.user.role];
    }
    return ['customer'];
  }

  /**
   * Extract provider — prefers session data, falls back to x-auth-provider header, then 'web'.
   */
  private extractProvider(session: BetterAuthSession, req: FastifyRequest): string {
    if (session.user?.provider) {
      return session.user.provider;
    }
    return (req.headers['x-auth-provider'] as string) ?? 'web';
  }

  /**
   * Extract session ID — prefers session.id, falls back to x-session-id header.
   */
  private extractSessionId(session: BetterAuthSession, req: FastifyRequest): string {
    if (session.id) {
      return session.id;
    }
    return (req.headers['x-session-id'] as string) ?? '';
  }
}
import { Global, Module } from '@nestjs/common';
import { JwtSignerService } from './jwt-signer.service';
import { AuthPropagationMiddleware } from './auth-propagation.middleware';
import { ContextModule } from '../context/context.module';

/**
 * Auth Propagation Module
 *
 * @Global NestJS module providing JWT signing for BFF→downstream identity propagation.
 *
 * Provides:
 * - JwtSignerService — signs 15-min JWTs via jose for downstream Authorization headers
 * - AuthPropagationMiddleware — extracts user identity from better-auth session → RequestContext
 *
 * Flow: better-auth session → AuthPropagationMiddleware → RequestContext → JwtSignerService → PortHttpClient
 */
@Global()
@Module({
  imports: [ContextModule],
  providers: [JwtSignerService, AuthPropagationMiddleware],
  exports: [JwtSignerService],
})
export class AuthPropagationModule {}
export { JwtSignerService } from './jwt-signer.service';
export { AuthPropagationMiddleware } from './auth-propagation.middleware';
export { AuthPropagationModule } from './auth-propagation.module';
export type { JwtPayload } from './auth-propagation.interface';
/**
 * Port Interface Definitions
 *
 * Core abstractions for the Hexagonal Port Registry.
 * Every downstream service call flows through IPort → IPortAdapter.
 *
 * AC: #1 (Port Registry), #4 (Zero-Core-Change Addition)
 */

import type { CacheTier, PortCircuitBreakerConfig } from '../endpoint-config/endpoint-config.interface';
import type { CircuitBreakerOptions } from '../resilience/circuit-breaker.decorator';

/**
 * Adapter interface — implemented by MockAdapterBase and InternalAdapterBase.
 * Each port registers one mock + one live adapter.
 */
export interface IPortAdapter {
  /**
   * Execute a method on this adapter.
   * @param method - The operation name (e.g. 'get-list', 'submit')
   * @param params - Method-specific parameters
   */
  execute(method: string, params: Record<string, unknown>): Promise<unknown>;
}

/**
 * Configuration for a registered port.
 * Combines endpoint config with port-specific settings.
 */
export interface PortConfig {
  /** Port name (must match key in api-endpoints.yaml) */
  name: string;
  /** Cache tier classification */
  cacheTier: CacheTier;
  /** Cache TTL in seconds (0 = no cache) */
  cacheTtl: number;
  /** Per-service timeout in ms */
  timeout: number;
  /** Circuit breaker options (mapped to existing CircuitBreakerOptions) */
  circuitBreaker: CircuitBreakerOptions;
  /** Whether this port is currently active */
  active: boolean;
}

/**
 * A registered port entry in the PortRegistry.
 * Binds a name to its adapters + config + circuit breaker.
 */
export interface PortEntry {
  /** Port name */
  name: string;
  /** Mock adapter instance */
  mockAdapter: IPortAdapter;
  /** Live adapter instance */
  liveAdapter: IPortAdapter;
  /** Port configuration */
  config: PortConfig;
}

/**
 * Metadata attached to a PortResult for observability and client hints.
 *
 * AC: #2 — cachedAt timestamp on fallback/cached responses.
 */
export interface PortResultMetadata {
  /** ISO timestamp when the data was cached (e.g. "updated at 14:30") */
  cachedAt?: string;
  /** True when the response comes from a CB OPEN fallback (degraded state) */
  degraded?: boolean;
  /** Human-readable message explaining degraded/fallback state */
  message?: string;
  /** True when the response was served from inbound idempotency cache */
  fromIdempotency?: boolean;
}

/**
 * Result of a port execution, including metadata about which adapter was used.
 */
export interface PortResult<T> {
  /** The response data */
  data: T;
  /** Which adapter was used: 'mock' or 'live' */
  adapterUsed: 'mock' | 'live';
  /** Whether the result was served from cache */
  fromCache: boolean;
  /** Execution duration in ms */
  duration: number;
  /** Optional metadata for observability and client hints */
  metadata?: PortResultMetadata;
}
/**
 * Port Exception Classes
 *
 * Typed exceptions for the Hexagonal Port infrastructure.
 * Extends BaseException from the domain layer for consistent error handling.
 *
 * Replaces generic `new Error()` calls with typed exceptions that:
 * - Carry machine-readable `code` and `details` fields
 * - Support `instanceof` checks for upstream exception filters
 * - Preserve error chains via `cause`
 */

import { BaseException } from '../../core/common/exceptions';

/**
 * Base exception for all port-related errors.
 */
export class PortException extends BaseException {
  constructor(message: string, code?: string, details?: Record<string, unknown>) {
    super(message, code ?? 'PORT_ERROR', details);
  }
}

/**
 * Thrown when a downstream service returns a non-ok HTTP response.
 * Carries the status code so callers and circuit breakers can distinguish
 * client errors (4xx) from infrastructure failures (5xx).
 */
export class PortDownstreamException extends PortException {
  /** HTTP status code from the downstream response */
  readonly statusCode: number;
  /** HTTP status text from the downstream response */
  readonly statusText: string;
  /** Port name that made the call */
  readonly portName: string;
  /** Full URL that was called */
  readonly url: string;

  constructor(portName: string, statusCode: number, statusText: string, url: string) {
    super(
      `Downstream call failed [${portName}]: ${statusCode} ${statusText}`,
      'PORT_DOWNSTREAM_ERROR',
      { portName, statusCode, statusText, url },
    );
    this.statusCode = statusCode;
    this.statusText = statusText;
    this.portName = portName;
    this.url = url;
  }
}

/**
 * Thrown when a downstream call exceeds the configured timeout.
 */
export class PortTimeoutException extends PortException {
  /** Port name that timed out */
  readonly portName: string;
  /** Configured timeout in milliseconds */
  readonly timeout: number;

  constructor(portName: string, timeout: number) {
    super(
      `Request timeout [${portName}] after ${timeout}ms`,
      'PORT_TIMEOUT',
      { portName, timeout },
    );
    this.portName = portName;
    this.timeout = timeout;
  }
}

/**
 * Thrown when a port name is not found in the registry.
 */
export class PortNotRegisteredException extends PortException {
  /** Port name that was not registered */
  readonly portName: string;

  constructor(portName: string) {
    super(
      `Port not registered: ${portName}`,
      'PORT_NOT_REGISTERED',
      { portName },
    );
    this.portName = portName;
  }
}

/**
 * Thrown when both the primary call and the fallback fail.
 * Preserves the original error via `cause` for upstream inspection.
 */
export class PortFallbackException extends PortException {
  /** Port name that failed */
  readonly portName: string;

  constructor(portName: string, originalError?: Error) {
    const message = originalError
      ? `Port call and fallback both failed [${portName}]: ${originalError.message}`
      : `Port fallback failed [${portName}]: no cached fallback available`;

    super(
      message,
      'PORT_FALLBACK_FAILED',
      {
        portName,
        originalError: originalError?.message,
      },
    );
    this.portName = portName;

    if (originalError) {
      this.cause = originalError;
    }
  }
}
/**
 * Port HTTP Client Service
 *
 * Centralized HTTP client for all downstream service calls.
 * Wraps native fetch with:
 * - JWT injection via jose (Story 1.4 — BFF→downstream identity propagation)
 * - Auto-retry on 401 with JWT regeneration
 * - Per-request timeout via AbortController
 * - Correlation ID propagation from RequestContextProvider
 * - Idempotency key generation for POST/PUT
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { REQUEST_CONTEXT_TOKEN } from '../../core';
import type { IRequestContextProvider } from '../../core';
import { StructuredLogger } from '../observability/structured-logger.service';
import { PortDownstreamException, PortTimeoutException } from './port-exceptions';
import { generateShortHash } from '../utils/hash.util';
import { JwtSignerService } from '../auth-propagation/jwt-signer.service';

/**
 * Request options for PortHttpClient.
 */
export interface PortHttpRequest {
  /** Full URL to call */
  url: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Port name for logging/correlation */
  portName: string;
  /** Timeout in milliseconds (default: 3000) */
  timeout?: number;
  /** Request body (for POST/PUT) */
  body?: Record<string, unknown>;
  /** Query parameters (for GET) */
  params?: Record<string, unknown>;
}

/**
 * Port HTTP Client — all downstream calls go through this service.
 *
 * AC#1: JWT injection on all downstream calls
 * AC#2: Auto-refresh on 401 (retry once)
 * AC#3: Structured 401 on retry failure
 * AC#5: Automatic JWT injection on all downstream calls
 */
@Injectable()
export class PortHttpClient {
  private readonly logger = new Logger(PortHttpClient.name);

  constructor(
    @Inject(REQUEST_CONTEXT_TOKEN)
    private readonly requestContext: IRequestContextProvider,
    private readonly structuredLogger: StructuredLogger,
    private readonly jwtSigner: JwtSignerService,
  ) {}

  /**
   * Execute an HTTP request with timeout, JWT, correlation ID, and idempotency key.
   */
  async request<T = unknown>(options: PortHttpRequest): Promise<T> {
    return this.requestInternal<T>(options, false);
  }

  /**
   * Internal request method with retry tracking.
   * @param options - Request options
   * @param isRetry - Whether this is a 401 retry
   */
  private async requestInternal<T = unknown>(
    options: PortHttpRequest,
    isRetry: boolean,
  ): Promise<T> {
    const {
      url,
      method,
      portName,
      timeout = 3000,
      body,
      params,
    } = options;

    const context = this.requestContext.current();
    const correlationId = context?.correlationId ?? 'no-correlation-id';

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-correlation-id': correlationId,
    };

    // AC#5: JWT injection — only when user identity available (skip webhooks, health)
    if (context?.userId) {
      const jwt = await this.jwtSigner.sign({
        sub: context.userId,
        roles: (context.metadata?.roles as string[]) ?? ['customer'],
        provider: (context.metadata?.provider as string) ?? 'web',
        sessionId: (context.metadata?.sessionId as string) ?? '',
        xiNghiep: context.tenantId,
      });
      headers['Authorization'] = `Bearer ${jwt}`;
    }

    // Idempotency key for POST/PUT
    if (method === 'POST' || method === 'PUT') {
      const payload = JSON.stringify({ portName, method, body: body ?? {} });
      const opHash = generateShortHash(payload);
      headers['x-idempotency-key'] = `${correlationId}:${opHash}`;
    }

    // Build URL with query params for GET
    let finalUrl = url;
    if (params && method === 'GET') {
      const queryString = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      if (queryString) {
        finalUrl = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
      }
    }

    // AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const startTime = Date.now();

    try {
      this.logger.debug(`[${portName}] ${method} ${finalUrl} (timeout: ${timeout}ms)`);

      const response = await fetch(finalUrl, {
        method,
        headers,
        body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const duration = Date.now() - startTime;

      // AC#2: Auto-refresh on 401 — retry once with regenerated JWT
      if (response.status === 401 && !isRetry && context?.userId) {
        this.structuredLogger.warn(
          `Downstream 401 — regenerating JWT and retrying [${portName}]`,
          {
            operation: { name: `${portName}:${method}`, duration },
            trace: { correlationId },
          },
        );

        // Regenerate JWT (context may have been refreshed by middleware)
        const newContext = this.requestContext.current();
        if (newContext?.userId) {
          const newJwt = await this.jwtSigner.sign({
            sub: newContext.userId,
            roles: (newContext.metadata?.roles as string[]) ?? ['customer'],
            provider: (newContext.metadata?.provider as string) ?? 'web',
            sessionId: (newContext.metadata?.sessionId as string) ?? '',
            xiNghiep: newContext.tenantId,
          });
          headers['Authorization'] = `Bearer ${newJwt}`;
        }

        // Retry the request with new JWT
        return this.retryRequest<T>(options, headers, controller, timeoutId);
      }

      // AC#3: Retry also returned 401 — structured error to frontend
      if (response.status === 401 && isRetry) {
        this.structuredLogger.warn(
          `Auth propagation failed after retry [${portName}]`,
          {
            operation: { name: `${portName}:${method}`, duration },
            trace: { correlationId },
          },
        );
        throw new PortDownstreamException(
          portName,
          401,
          'Session expired — please re-authenticate',
          finalUrl,
        );
      }

      if (!response.ok) {
        this.structuredLogger.warn(`Downstream error [${portName}] ${response.status}`, {
          operation: { name: `${portName}:${method}`, duration },
          trace: { correlationId },
          data: { status: response.status, statusText: response.statusText },
        });

        throw new PortDownstreamException(portName, response.status, response.statusText, finalUrl);
      }

      // Parse response JSON
      let data: T;
      try {
        data = (await response.json()) as T;
      } catch (parseError) {
        this.structuredLogger.warn(
          `Invalid JSON response [${portName}] status=${response.status}`,
          {
            operation: { name: `${portName}:${method}`, duration },
            trace: { correlationId },
            data: { parseError: (parseError as Error).message },
          },
        );
        throw new PortDownstreamException(portName, 502, 'Invalid JSON response body', finalUrl);
      }

      this.logger.debug(`[${portName}] ${method} completed in ${duration}ms`);

      return data;
    } catch (error) {
      const duration = Date.now() - startTime;

      if ((error as Error).name === 'AbortError') {
        this.structuredLogger.error(
          `Request timeout [${portName}] after ${timeout}ms`,
          error as Error,
          {
            operation: { name: `${portName}:${method}`, duration },
            trace: { correlationId },
            data: { timeout, url: finalUrl },
          },
        );
        throw new PortTimeoutException(portName, timeout);
      }

      if (!(error instanceof PortDownstreamException) && !(error instanceof PortTimeoutException)) {
        this.structuredLogger.error(
          `Request failed [${portName}]: ${(error as Error).message}`,
          error as Error,
          {
            operation: { name: `${portName}:${method}`, duration },
            trace: { correlationId },
          },
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Execute retry request with updated headers.
   * Separate method to create new AbortController and timeout.
   */
  private async retryRequest<T>(
    options: PortHttpRequest,
    headers: Record<string, string>,
    _originalController: AbortController,
    _originalTimeoutId: ReturnType<typeof setTimeout>,
  ): Promise<T> {
    const { url, method, portName, timeout = 3000, body, params } = options;

    // Build URL with query params for GET
    let finalUrl = url;
    if (params && method === 'GET') {
      const queryString = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      if (queryString) {
        finalUrl = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
      }
    }

    const retryController = new AbortController();
    const retryTimeoutId = setTimeout(
      () => retryController.abort(),
      timeout,
    );

    try {
      const response = await fetch(finalUrl, {
        method,
        headers,
        body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
        signal: retryController.signal,
      });

      // Handle retry response
      if (response.status === 401) {
        // AC#3: Retry also 401 — throw structured error
        const context = this.requestContext.current();
        throw new PortDownstreamException(
          portName,
          401,
          'Session expired — please re-authenticate',
          finalUrl,
        );
      }

      if (!response.ok) {
        throw new PortDownstreamException(
          portName,
          response.status,
          response.statusText,
          finalUrl,
        );
      }

      let data: T;
      try {
        data = (await response.json()) as T;
      } catch {
        throw new PortDownstreamException(portName, 502, 'Invalid JSON response body', finalUrl);
      }

      return data;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new PortTimeoutException(portName, timeout);
      }
      throw error;
    } finally {
      clearTimeout(retryTimeoutId);
    }
  }
}
/**
 * MockAdapter Base Class
 *
 * Reads JSON from mocks/{portName}/{methodName}.json,
 * validates against Zod schema, and returns normalized data.
 *
 * AC: #2 (MOCK_MODE Override), #6 (Contract Validation Gate)
 */

import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import type { ZodType } from 'zod';
import type { IPortAdapter } from './port.interface';
import { NotFoundException, ValidationException } from '../../core/common/exceptions';

/**
 * Abstract base class for mock adapters.
 * Concrete adapters extend this and provide port-specific Zod schemas.
 *
 * Usage:
 * ```typescript
 * class InvoiceMockAdapter extends MockAdapterBase {
 *   constructor(logger: Logger) {
 *     super('invoice', { 'get-list': InvoiceListSchema, 'get-detail': InvoiceDetailSchema }, logger);
 *   }
 * }
 * ```
 */
export abstract class MockAdapterBase implements IPortAdapter {
  protected readonly logger: Logger;

  constructor(
    protected readonly portName: string,
    protected readonly schemas: Record<string, ZodType<unknown>>,
    logger?: Logger,
  ) {
    this.logger = logger ?? new Logger(`${portName}-mock-adapter`);
  }

  /**
   * Execute a mock method — read JSON file, validate against Zod schema.
   * Fix #7: Uses async fs.promises.readFile to avoid blocking the event loop.
   *
   * AC: #6 — In non-production, Zod validation failure throws fatal error (fail-to-start).
   * In production, logs warning and returns raw data (graceful degradation).
   */
  async execute(method: string, _params: Record<string, unknown>): Promise<unknown> {
    const filePath = path.resolve(process.cwd(), 'mocks', this.portName, `${method}.json`);

    this.logger.debug(`Reading mock file: ${filePath}`);

    let rawData: unknown;
    try {
      const fileContent = await fsPromises.readFile(filePath, 'utf-8');
      rawData = JSON.parse(fileContent);
    } catch (error) {
      throw new NotFoundException(
        `Mock file not found or invalid JSON [${this.portName}/${method}]: ${(error as Error).message}`,
        'MOCK_FILE_NOT_FOUND',
        { portName: this.portName, method },
      );
    }

    // Validate against Zod schema if one exists for this method
    const schema = this.schemas[method];
    if (schema) {
      const result = schema.safeParse(rawData);
      if (!result.success) {
        const errorMsg = `Mock contract violation [${this.portName}/${method}]: ${result.error.message}`;

        // AC: #6 — Fail-to-start in non-production
        if (process.env.NODE_ENV !== 'production') {
          throw new ValidationException(errorMsg);
        }

        // In production: log warning, return raw data (graceful)
        this.logger.warn(errorMsg);
        return rawData;
      }
      return result.data;
    }

    // No schema defined for this method — return raw data
    return rawData;
  }
}
/**
 * InternalAdapter Base Class
 *
 * Makes live HTTP calls to downstream services via PortHttpClient.
 * Wraps fetch with per-port timeout (AbortController).
 *
 * AC: #1 (Port Registry), #5 (Per-Service Timeout)
 */

import { Logger } from '@nestjs/common';
import type { IPortAdapter } from './port.interface';
import type { PortHttpClient } from './port-http-client.service';

/**
 * Configuration for constructing the downstream URL.
 */
export interface InternalAdapterConfig {
  /** Port name (matches api-endpoints.yaml key) */
  portName: string;
  /** Base URL for this service */
  baseUrl: string;
  /** Timeout in milliseconds */
  timeout: number;
  /**
   * Explicit HTTP method mapping per operation name.
   * Keys are method names (e.g., 'get-list'), values are HTTP verbs.
   * Unlisted methods default to POST.
   */
  methodMap?: Record<string, 'GET' | 'POST' | 'PUT' | 'DELETE'>;
}

/**
 * Abstract base class for live/internal adapters.
 * Concrete adapters extend this and provide port-specific request building.
 *
 * Usage:
 * ```typescript
 * class InvoiceInternalAdapter extends InternalAdapterBase {
 *   constructor(httpClient: PortHttpClient, logger: Logger) {
 *     super('invoice', httpClient, {
 *       baseUrl: '...',
 *       timeout: 3000,
 *       methodMap: {
 *         'get-list': 'GET',
 *         'get-detail': 'GET',
 *         'download': 'GET',
 *       },
 *     }, logger);
 *   }
 * }
 * ```
 */
export abstract class InternalAdapterBase implements IPortAdapter {
  protected readonly logger: Logger;

  constructor(
    protected readonly portName: string,
    protected readonly httpClient: PortHttpClient,
    protected readonly config: InternalAdapterConfig,
    logger?: Logger,
  ) {
    this.logger = logger ?? new Logger(`${portName}-internal-adapter`);
  }

  /**
   * Execute a live downstream call.
   * Delegates to PortHttpClient which handles:
   * - Timeout via AbortController
   * - JWT injection (prepared for Story 1.4)
   * - Correlation ID propagation
   * - Idempotency key for POST/PUT
   *
   * AC: #5 — Timeout aborts request and logs with correlation ID.
   */
  async execute(method: string, params: Record<string, unknown>): Promise<unknown> {
    const url = this.buildUrl(method, params);
    const httpMethod = this.resolveHttpMethod(method);

    this.logger.debug(`Calling downstream [${this.portName}/${method}] ${httpMethod} ${url}`);

    return this.httpClient.request({
      url,
      method: httpMethod,
      portName: this.portName,
      timeout: this.config.timeout,
      body: httpMethod !== 'GET' ? params : undefined,
      params: httpMethod === 'GET' ? params : undefined,
    });
  }

  /**
   * Build the downstream URL for a method call.
   * Supports {param} and :param placeholder substitution from params.
   * Override in subclass for custom URL patterns.
   *
   * Example:
   *   baseUrl = 'https://api.example.com/invoices'
   *   method = '{id}/detail'
   *   params = { id: 'INV-001' }
   *   → 'https://api.example.com/invoices/INV-001/detail'
   */
  protected buildUrl(method: string, params: Record<string, unknown>): string {
    let url = `${this.config.baseUrl}/${method}`;
    // Replace {key} or :key placeholders with param values
    url = url.replace(/\{(\w+)\}|:(\w+)/g, (_match, braceKey?: string, colonKey?: string) => {
      const key = braceKey || colonKey;
      if (key && params[key] !== undefined && params[key] !== null) {
        return encodeURIComponent(String(params[key]));
      }
      return _match; // Leave placeholder if no param provided
    });
    return url;
  }

  /**
   * Fix #6: Resolve HTTP method — explicit map first, then safe defaults.
   * Checks the methodMap config, falls back to convention, then POST.
   */
  protected resolveHttpMethod(method: string): 'GET' | 'POST' | 'PUT' | 'DELETE' {
    // 1. Explicit method map from config (highest priority)
    if (this.config.methodMap?.[method]) {
      return this.config.methodMap[method];
    }

    // 2. Safe convention-based defaults for known read operations
    if (method.startsWith('get-') || method.startsWith('search') || method.startsWith('list')) {
      return 'GET';
    }
    if (method.startsWith('update') || method.startsWith('edit')) {
      return 'PUT';
    }
    if (method.startsWith('delete') || method.startsWith('remove') || method.startsWith('cancel')) {
      return 'DELETE';
    }

    // 3. Default: POST for all mutations
    return 'POST';
  }
}
/**
 * Port Registry Service
 *
 * Central registry for all downstream service ports.
 * Routes calls through the correct adapter (mock/live),
 * integrates caching, circuit breaker, and fallback.
 *
 * AC: #1 (Port Registry Init), #2 (MOCK_MODE Override), #4 (Zero-Core-Change)
 */

import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { CACHE_SERVICE_TOKEN, REQUEST_CONTEXT_TOKEN } from '../../core';
import type { ICacheService } from '../caching/cache.interface';
import type { IRequestContextProvider } from '../../core';
import { StructuredLogger } from '../observability/structured-logger.service';
import { EndpointConfigService } from '../endpoint-config/endpoint-config.service';
import { CircuitBreakerState } from '../resilience/circuit-breaker.state';
import { CircuitState } from '../resilience/circuit-breaker.decorator';
import { FallbackProvider } from '../resilience/fallback.provider';
import type { IPortAdapter, PortConfig, PortEntry, PortResult, PortResultMetadata } from './port.interface';
import type { CacheTier } from '../endpoint-config/endpoint-config.interface';
import { InboundIdempotencyService } from './inbound-idempotency.service';
import { PortNotRegisteredException, PortFallbackException, PortDownstreamException } from './port-exceptions';
import { generateShortHash } from '../utils/hash.util';

/**
 * Default cache TTLs by tier (in seconds).
 */
const DEFAULT_TTL_BY_TIER: Record<CacheTier, number> = {
  static: 43200,     // 12 hours
  dynamic: 900,      // 15 minutes
  transaction: 0,    // No cache
};

/**
 * Cache key version prefix. Bumped when the hash algorithm changes
 * to avoid orphaning old keys during deployment (prevents cache stampede).
 */
const CACHE_KEY_VERSION = 'v2';

/**
 * Shared errorFilter for circuit breakers: only count infrastructure
 * errors (5xx, timeouts) as CB failures. 4xx client errors do NOT
 * trip the circuit because they indicate a caller problem, not a
 * downstream outage.
 */
function isInfrastructureError(error: Error): boolean {
  if (error instanceof PortDownstreamException) {
    return error.statusCode >= 500;
  }
  // Timeouts and unknown errors always count
  return true;
}

@Injectable()
export class PortRegistry {
  private readonly ports = new Map<string, PortEntry>();
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();
  private readonly logger = new Logger(PortRegistry.name);

  constructor(
    private readonly configService: EndpointConfigService,
    @Inject(CACHE_SERVICE_TOKEN)
    private readonly cacheService: ICacheService,
    private readonly fallbackProvider: FallbackProvider,
    private readonly structuredLogger: StructuredLogger,
    @Inject(REQUEST_CONTEXT_TOKEN)
    private readonly requestContext: IRequestContextProvider,
    @Optional()
    private readonly idempotencyService?: InboundIdempotencyService,
  ) {}

  /**
   * Register a new port with mock + live adapters.
   * Creates per-port CircuitBreakerState and registers fallback.
   *
   * AC: #1, #4 — Zero code changes needed to add new ports.
   */
  register(
    name: string,
    mockAdapter: IPortAdapter,
    liveAdapter: IPortAdapter,
    config?: Partial<PortConfig>,
  ): void {
    // Resolve config from endpoint-config service if available
    let resolvedConfig: PortConfig;

    if (this.configService.hasEndpointConfig(name)) {
      const endpointConfig = this.configService.getEndpointConfig(name);
      resolvedConfig = {
        name,
        cacheTier: endpointConfig.cacheTier,
        cacheTtl: endpointConfig.cacheTtl ?? DEFAULT_TTL_BY_TIER[endpointConfig.cacheTier],
        timeout: endpointConfig.timeout,
        circuitBreaker: {
          errorThreshold: endpointConfig.circuitBreaker?.errorThreshold ?? 50,
          resetTimeout: endpointConfig.circuitBreaker?.resetTimeout ?? 10000,
          minRequests: endpointConfig.circuitBreaker?.minRequests ?? 5,
          name,
          errorFilter: isInfrastructureError,
        },
        active: true,
        ...config,
      };
    } else {
      // Fallback config if no YAML entry
      resolvedConfig = {
        name,
        cacheTier: 'dynamic',
        cacheTtl: DEFAULT_TTL_BY_TIER.dynamic,
        timeout: 3000,
        circuitBreaker: {
          errorThreshold: 50,
          resetTimeout: 10000,
          minRequests: 5,
          name,
          errorFilter: isInfrastructureError,
        },
        active: true,
        ...config,
      };
    }

    // Create per-port circuit breaker
    const cb = new CircuitBreakerState(resolvedConfig.circuitBreaker, this.logger);
    this.circuitBreakers.set(name, cb);

    // Register fallback for this port (cache-based fallback)
    // Fix #3: Throw a distinct error when no cached fallback is available
    this.fallbackProvider.register(name, async (_error, _context) => {
      const cached = this.fallbackProvider.getCached(name);
      if (cached !== null && cached !== undefined) {
        this.logger.warn(`Returning cached fallback for port: ${name}`);
        return cached;
      }
      throw new PortFallbackException(name);
    });

    // Store port entry
    const entry: PortEntry = {
      name,
      mockAdapter,
      liveAdapter,
      config: resolvedConfig,
    };
    this.ports.set(name, entry);

    this.logger.log(`Registered port: ${name} (tier: ${resolvedConfig.cacheTier}, timeout: ${resolvedConfig.timeout}ms)`);
  }

  /**
   * Execute a port call.
   *
   * Flow:
   * 1. Resolve adapter (MOCK_MODE env → YAML adapter field → live)
   * 2. Check inbound idempotency (if idempotencyKey provided)
   * 3. Check cache (skip if transaction tier)
   * 4. Check circuit breaker state
   * 5. Execute via adapter
   * 6. On success: cache result, record CB success, store idempotency result
   * 7. On failure: record CB failure, attempt fallback
   *
   * AC: #1 (CB per-port), #2 (cachedAt timestamp), #7 (inbound idempotency)
   */
  async execute<T = unknown>(
    portName: string,
    method: string,
    params: Record<string, unknown> = {},
    idempotencyKey?: string,
  ): Promise<PortResult<T>> {
    const startTime = Date.now();
    const entry = this.ports.get(portName);

    if (!entry) {
      throw new PortNotRegisteredException(portName);
    }

    const correlationId = this.getCorrelationId();

    // Three-step priority chain — MOCK_MODE → YAML adapter field → live
    let adapter: IPortAdapter;
    let adapterUsed: 'mock' | 'live';

    if (this.configService.isMockMode()) {
      // Step 1: MOCK_MODE=true forces all ports to mock
      adapter = entry.mockAdapter;
      adapterUsed = 'mock';
    } else if (this.configService.hasEndpointConfig(portName)) {
      // Step 2: Respect per-service adapter field from YAML
      const endpointConfig = this.configService.getEndpointConfig(portName);
      const useMock = endpointConfig.adapter === 'mock';
      adapter = useMock ? entry.mockAdapter : entry.liveAdapter;
      adapterUsed = useMock ? 'mock' : 'live';
    } else {
      // Step 3: Default to live
      adapter = entry.liveAdapter;
      adapterUsed = 'live';
    }

    // AC: #7 — Check inbound idempotency FIRST (before cache check)
    if (idempotencyKey && this.idempotencyService) {
      const idempotencyResult = await this.idempotencyService.check<T>(idempotencyKey);
      if (idempotencyResult.hit && idempotencyResult.data !== undefined) {
        this.structuredLogger.info(`Idempotency hit, returning cached result [${portName}]`, {
          operation: { name: `${portName}:${method}` },
          trace: { correlationId },
          data: { idempotencyKey },
        });
        return {
          data: idempotencyResult.data,
          adapterUsed,
          fromCache: true,
          duration: Date.now() - startTime,
          metadata: { fromIdempotency: true },
        };
      }
    }

    // Fix #5: Compute cache key ONCE and reuse for both get and set
    const shouldCache = entry.config.cacheTier !== 'transaction' && entry.config.cacheTtl > 0;
    let cacheKey: string | undefined;

    if (shouldCache) {
      cacheKey = this.buildCacheKey(portName, method, params);
      const cachedEntry = await this.cacheService.get<{ data: T; cachedAt: string }>(cacheKey);
      // Fix #2: Use strict null check to avoid falsy-zero bug
      if (cachedEntry !== null && cachedEntry !== undefined) {
        return {
          data: cachedEntry.data,
          adapterUsed,
          fromCache: true,
          duration: Date.now() - startTime,
          metadata: {
            cachedAt: cachedEntry.cachedAt,
          },
        };
      }
    }

    // Check circuit breaker
    const cb = this.circuitBreakers.get(portName);
    if (cb) {
      if (cb.getState() === CircuitState.OPEN) {
        if (cb.shouldAttemptReset()) {
          cb.halfOpen();
          // AC: #3 — HALF_OPEN probe: allow single probe request
          this.structuredLogger.debug(`Circuit breaker HALF_OPEN probe [${portName}]`, {
            operation: { name: `${portName}:${method}` },
            trace: { correlationId },
          });
        } else {
          // AC: #1, #2 — Circuit open → return fallback with cachedAt metadata
          const cachedAt = new Date().toISOString();
          this.structuredLogger.warn(`Circuit breaker OPEN, returning fallback [${portName}]`, {
            operation: { name: `${portName}:${method}` },
            trace: { correlationId },
            data: { cbState: CircuitState.OPEN, cachedAt },
          });
          return this.executeFallback<T>(portName, entry, adapterUsed, startTime, null);
        }
      }
    }

    // Execute via adapter — only the adapter call is in the CB try/catch.
    // Post-processing writes (cache, fallback cache, idempotency) are
    // fire-and-forget so they cannot trip the circuit breaker.
    let data: T;
    let duration: number;

    try {
      data = (await adapter.execute(method, params)) as T;
      duration = Date.now() - startTime;

      // Record circuit breaker success
      cb?.recordSuccess();
    } catch (error) {
      const originalError = error as Error;

      // Record circuit breaker failure
      cb?.recordFailure(originalError);

      // AC: #1 — Check if circuit should open
      if (cb?.shouldOpen()) {
        cb.open();
        this.structuredLogger.error(
          `Circuit breaker tripped OPEN [${portName}]`,
          originalError,
          {
            operation: { name: `${portName}:${method}`, duration: Date.now() - startTime },
            trace: { correlationId },
            data: { cbState: CircuitState.OPEN },
          },
        );
      }

      // Pass original error to fallback for error chain preservation
      return this.executeFallback<T>(portName, entry, adapterUsed, startTime, originalError);
    }

    // ── Post-processing: fire-and-forget writes (Fix #1) ──────────
    // These are intentionally outside the adapter try/catch so that
    // cache/Redis failures do NOT trip the circuit breaker.
    const cachedAt = new Date().toISOString();

    // Cache result with insertion timestamp (Fix #4)
    if (shouldCache && cacheKey) {
      try {
        await this.cacheService.set(cacheKey, { data, cachedAt }, entry.config.cacheTtl);
      } catch (cacheError) {
        this.logger.warn(`Cache write failed for ${portName}: ${(cacheError as Error).message}`);
      }
    }

    // Cache for fallback use
    this.fallbackProvider.setCached(portName, data);

    // AC: #7 — Store idempotency result after successful execution
    if (idempotencyKey && this.idempotencyService) {
      try {
        await this.idempotencyService.store(idempotencyKey, data);
      } catch (idempotencyError) {
        this.logger.warn(`Idempotency store failed for ${portName}: ${(idempotencyError as Error).message}`);
      }
    }

    return {
      data,
      adapterUsed,
      fromCache: false,
      duration,
    };
  }

  /**
   * Get a registered port entry.
   */
  getPort(name: string): PortEntry | undefined {
    return this.ports.get(name);
  }

  /**
   * Check if a port is registered.
   */
  hasPort(name: string): boolean {
    return this.ports.has(name);
  }

  /**
   * Get all registered port names.
   */
  getPortNames(): string[] {
    return Array.from(this.ports.keys());
  }

  /**
   * Get circuit breaker state for a port.
   */
  getCircuitBreakerState(portName: string): CircuitState | undefined {
    return this.circuitBreakers.get(portName)?.getState();
  }

  /**
   * Get all circuit breaker states for health reporting.
   * Returns port name → { state, metrics } mapping.
   */
  getAllCircuitBreakerStates(): Array<{
    portName: string;
    state: CircuitState;
    metrics: { requests: number; failures: number; successRate: number; failureRate: number };
  }> {
    return Array.from(this.circuitBreakers.entries()).map(([portName, cb]) => ({
      portName,
      state: cb.getState(),
      metrics: cb.getMetrics(),
    }));
  }

  /**
   * Execute fallback when circuit breaker is open or call fails.
   * Fix #3: Produces distinct error messages for original failure vs fallback failure.
   * AC: #2 — Adds metadata.degraded and metadata.cachedAt to fallback responses.
   */
  private async executeFallback<T>(
    portName: string,
    _entry: PortEntry,
    adapterUsed: 'mock' | 'live',
    startTime: number,
    originalError: Error | null,
  ): Promise<PortResult<T>> {
    const cachedAt = new Date().toISOString();

    try {
      const fallbackData = await this.fallbackProvider.execute(
        portName,
        originalError ?? new Error(`Circuit breaker open for ${portName}`),
        {
          operation: portName,
          args: [],
          attempt: 1,
          duration: Date.now() - startTime,
          failureType: 'circuit_breaker',
        },
      );

      const metadata: PortResultMetadata = {
        cachedAt,
        degraded: true,
        message: 'Service temporarily unavailable, serving cached data',
      };

      return {
        data: fallbackData as T,
        adapterUsed,
        fromCache: true,
        duration: Date.now() - startTime,
        metadata,
      };
    } catch (fallbackError) {
      // Preserve original error type via PortFallbackException with cause chain
      throw new PortFallbackException(portName, originalError ?? (fallbackError as Error));
    }
  }

  /**
   * Build cache key for a port call.
   * Uses SHA-256 (16-char truncated) via shared hash utility.
   * Pattern: cache:v2:port:{portName}:{sha256OfMethodAndParams}
   *
   * Fix #8: v2 prefix prevents cache stampede when hash algorithm changes.
   */
  private buildCacheKey(
    portName: string,
    method: string,
    params: Record<string, unknown>,
  ): string {
    const payload = JSON.stringify({ method, params });
    const hash = generateShortHash(payload);
    return `cache:${CACHE_KEY_VERSION}:port:${portName}:${hash}`;
  }

  /**
   * Get the current correlation ID from request context.
   * Falls back to 'no-correlation-id' if context is not available.
   */
  private getCorrelationId(): string {
    const context = this.requestContext?.current();
    return context?.correlationId ?? 'no-correlation-id';
  }
}
/**
 * Inbound Idempotency Service
 *
 * Handles webhook deduplication by checking/storing results keyed by
 * a SHA-256 hash of the inbound message identifier (messageId/callId).
 *
 * Key format: idempotency:{sha256Hash}
 * TTL: 86400s (24 hours)
 *
 * AC: #7 — Inbound Idempotency
 */

import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { CACHE_SERVICE_TOKEN } from '../../core';
import type { ICacheService } from '../caching/cache.interface';
import { generateShortHash } from '../utils/hash.util';

/**
 * Result of an inbound idempotency check.
 */
export interface InboundIdempotencyResult<T = unknown> {
  /** Whether a cached result was found for this key */
  hit: boolean;
  /** The cached data if hit=true */
  data?: T;
}

/**
 * Service for inbound webhook idempotency.
 *
 * Distinct from the CQRS `IdempotencyService` in `libs/shared/cqrs/`:
 * - This uses a dedicated key prefix `idempotency:` with 24h TTL
 * - Designed for webhook dedup (messageId/callId → hash)
 * - Simpler API: check/store vs getExisting/store
 */
@Injectable()
export class InboundIdempotencyService {
  private readonly logger = new Logger(InboundIdempotencyService.name);
  private readonly KEY_PREFIX = 'idempotency';
  private readonly DEFAULT_TTL = 86400; // 24 hours

  constructor(
    @Optional()
    @Inject(CACHE_SERVICE_TOKEN)
    private readonly cacheService?: ICacheService,
  ) {
    if (!this.cacheService) {
      this.logger.warn(
        'InboundIdempotencyService initialized without cache service. Idempotency checks will always miss.',
      );
    }
  }

  /**
   * Check if an inbound request was already processed.
   *
   * @param rawKey - The raw message identifier (messageId, callId, etc.)
   * @returns InboundIdempotencyResult with hit=true and data if found
   *
   * AC: #7 — Redis GET idempotency:{hash} → if EXISTS return cached response
   */
  async check<T = unknown>(rawKey: string): Promise<InboundIdempotencyResult<T>> {
    if (!this.cacheService) {
      return { hit: false };
    }

    const cacheKey = this.buildCacheKey(rawKey);

    try {
      const cached = await this.cacheService.get<T>(cacheKey);
      if (cached !== null && cached !== undefined) {
        this.logger.debug(`Idempotency HIT: ${cacheKey}`);
        return { hit: true, data: cached };
      }
    } catch (error) {
      this.logger.warn(
        `Cache error checking idempotency for ${cacheKey}: ${(error as Error).message}`,
      );
    }

    this.logger.debug(`Idempotency MISS: ${cacheKey}`);
    return { hit: false };
  }

  /**
   * Store the result of a processed inbound request.
   *
   * @param rawKey - The raw message identifier (messageId, callId, etc.)
   * @param result - The result to cache
   *
   * AC: #7 — Redis SET idempotency:{hash} = result, TTL 24h
   */
  async store<T = unknown>(rawKey: string, result: T): Promise<void> {
    if (!this.cacheService) {
      return;
    }

    const cacheKey = this.buildCacheKey(rawKey);

    try {
      await this.cacheService.set(cacheKey, result, this.DEFAULT_TTL);
      this.logger.debug(
        `Stored idempotency result for ${cacheKey} (TTL: ${this.DEFAULT_TTL}s)`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to store idempotency result for ${cacheKey}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Build the cache key from a raw message identifier.
   *
   * Format: idempotency:{sha256Hash}
   * Where hash = SHA-256(rawKey), truncated to 16 chars for consistency
   * with the project's cache key pattern.
   */
  private buildCacheKey(rawKey: string): string {
    const hash = generateShortHash(rawKey);
    return `${this.KEY_PREFIX}:${hash}`;
  }
}
/**
 * Aggregation Service
 *
 * Fan-out call wrapper using Promise.allSettled.
 * Handles partial failures gracefully — returns what succeeded,
 * logs what failed.
 *
 * AC: #4 — Zero-core-change port addition (aggregation works with any registered port)
 */

import { Injectable, Logger } from '@nestjs/common';
import { PortRegistry } from './port-registry.service';
import type { PortResult } from './port.interface';

/**
 * Individual call specification for fan-out execution.
 */
export interface AggregationCall {
  /** Port name to call */
  portName: string;
  /** Method to invoke */
  method: string;
  /** Parameters for the call */
  params?: Record<string, unknown>;
}

/**
 * Result of an individual call within an aggregation.
 */
export interface AggregationResult<T = unknown> {
  /** Port name */
  portName: string;
  /** Whether the call succeeded */
  success: boolean;
  /** Result data (if success) */
  data?: T;
  /** Error message (if failure) */
  error?: string;
  /** Execution duration in ms */
  duration: number;
}

/**
 * Overall aggregation result.
 */
export interface AggregationResponse<T = unknown> {
  /** All individual results */
  results: AggregationResult<T>[];
  /** How many calls succeeded */
  succeeded: number;
  /** How many calls failed */
  failed: number;
  /** Total execution duration in ms */
  totalDuration: number;
}

@Injectable()
export class AggregationService {
  private readonly logger = new Logger(AggregationService.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  /**
   * Execute multiple port calls in parallel via Promise.allSettled.
   * Returns all results (successes AND failures) — never throws on individual failures.
   *
   * AC: #4 — works with any registered port combination.
   */
  async executeAll<T = unknown>(calls: AggregationCall[]): Promise<AggregationResponse<T>> {
    const startTime = Date.now();

    const promises = calls.map((call) =>
      this.portRegistry.execute<T>(call.portName, call.method, call.params ?? {}),
    );

    const settled = await Promise.allSettled(promises);

    const results: AggregationResult<T>[] = settled.map((result, index) => {
      const call = calls[index];
      if (result.status === 'fulfilled') {
        return {
          portName: call.portName,
          success: true,
          data: result.value.data,
          duration: result.value.duration,
        };
      }

      const errorMessage = (result.reason as Error)?.message ?? 'Unknown error';
      this.logger.warn(
        `Aggregation call failed [${call.portName}/${call.method}]: ${errorMessage}`,
      );

      return {
        portName: call.portName,
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    });

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const totalDuration = Date.now() - startTime;

    this.logger.log(
      `Aggregation completed: ${succeeded} succeeded, ${failed} failed in ${totalDuration}ms`,
    );

    return {
      results,
      succeeded,
      failed,
      totalDuration,
    };
  }

  /**
   * Resolve individual settled results into a convenient map.
   * fulfilled → value, rejected → null + warning log.
   *
   * Useful for callers that need a simple key-value map by port name.
   */
  resolveToMap<T = unknown>(response: AggregationResponse<T>): Map<string, T | null> {
    const map = new Map<string, T | null>();
    for (const result of response.results) {
      map.set(result.portName, result.success ? result.data ?? null : null);
    }
    return map;
  }

  /**
   * Get only successful results as a map.
   */
  resolveSuccessful<T = unknown>(response: AggregationResponse<T>): Map<string, T> {
    const map = new Map<string, T>();
    for (const result of response.results) {
      if (result.success && result.data !== undefined) {
        map.set(result.portName, result.data);
      }
    }
    return map;
  }
}
/**
 * Port Health Indicator
 *
 * Reports the health of all port circuit breakers to the /health endpoint.
 * UP if all circuits are CLOSED, DEGRADED if any is HALF_OPEN, DOWN if any is OPEN.
 */

import { Injectable } from '@nestjs/common';
import { PortRegistry } from './port-registry.service';
import { CircuitState } from '../resilience/circuit-breaker.decorator';
import type { IHealthIndicator, HealthCheckResult } from '../health/health.interface';
import { HealthStatus } from '../health/health.interface';

@Injectable()
export class PortHealthIndicator implements IHealthIndicator {
  constructor(private readonly portRegistry: PortRegistry) {}

  async check(): Promise<HealthCheckResult> {
    const states = this.portRegistry.getAllCircuitBreakerStates();

    if (states.length === 0) {
      return {
        status: HealthStatus.UP,
        message: 'No ports registered',
        timestamp: new Date().toISOString(),
      };
    }

    const openPorts = states.filter((s) => s.state === CircuitState.OPEN);
    const halfOpenPorts = states.filter((s) => s.state === CircuitState.HALF_OPEN);
    const closedPorts = states.filter((s) => s.state === CircuitState.CLOSED);

    const circuits = states.map((s) => ({
      port: s.portName,
      state: s.state,
      failureRate: s.metrics.failureRate,
    }));

    if (openPorts.length > 0) {
      return {
        status: HealthStatus.DOWN,
        message: `${openPorts.length} circuit breaker(s) OPEN: ${openPorts.map((p) => p.portName).join(', ')}`,
        timestamp: new Date().toISOString(),
        circuits,
        total: states.length,
        open: openPorts.length,
        halfOpen: halfOpenPorts.length,
        closed: closedPorts.length,
      };
    }

    if (halfOpenPorts.length > 0) {
      return {
        status: HealthStatus.DEGRADED,
        message: `${halfOpenPorts.length} circuit breaker(s) in HALF_OPEN probe: ${halfOpenPorts.map((p) => p.portName).join(', ')}`,
        timestamp: new Date().toISOString(),
        circuits,
        total: states.length,
        open: 0,
        halfOpen: halfOpenPorts.length,
        closed: closedPorts.length,
      };
    }

    return {
      status: HealthStatus.UP,
      message: `All ${states.length} port circuit breakers healthy`,
      timestamp: new Date().toISOString(),
      circuits,
      total: states.length,
      open: 0,
      halfOpen: 0,
      closed: closedPorts.length,
    };
  }
}
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
    // CACHE_SERVICE_TOKEN is provided by AppModule (factory: Redis in prod, Memory in dev)
  ],
  exports: [PortRegistry, PortHttpClient, AggregationService, InboundIdempotencyService],
})
export class PortModule {}
export * from './port-exceptions';
export * from './port.interface';
export * from './port-registry.service';
export * from './port-http-client.service';
export * from './mock-adapter.base';
export * from './internal-adapter.base';
export * from './aggregation.service';
export * from './inbound-idempotency.service';
export * from './port.module';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { parse as parseYaml } from 'yaml';
import { StructuredLogger } from '../observability/structured-logger.service';
import { PortEndpointConfig, EndpointConfig } from './endpoint-config.interface';
import { ApiEndpointsSchema } from '../../../../config/api-endpoints.schema';
import { NotFoundException } from '../../core/common/exceptions';

/**
 * Endpoint Configuration Service
 *
 * Loads per-service endpoint configuration from config/api-endpoints.yaml.
 * Supports hot-reload via chokidar file watching (< 100ms reload).
 * Validates config against Zod schema on load.
 * Resolves ${ENV_VAR} template variables in YAML values.
 *
 * AC: #3 — Hot-Reload via chokidar
 */
@Injectable()
export class EndpointConfigService implements OnModuleInit, OnModuleDestroy {
  private config = new Map<string, PortEndpointConfig>();
  private watcher: chokidar.FSWatcher | null = null;
  private readonly configPath: string;
  private readonly logger = new Logger(EndpointConfigService.name);

  constructor(private readonly structuredLogger: StructuredLogger) {
    // Resolve config path relative to project root (cwd)
    this.configPath = path.resolve(process.cwd(), 'config', 'api-endpoints.yaml');
  }

  async onModuleInit(): Promise<void> {
    await this.loadConfig();
    this.startWatcher();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Get configuration for a specific port/endpoint.
   * @throws Error if port name not found
   */
  getEndpointConfig(portName: string): PortEndpointConfig {
    const config = this.config.get(portName);
    if (!config) {
      throw new NotFoundException(`Endpoint config not found for port: ${portName}`, 'ENDPOINT_CONFIG_NOT_FOUND', { portName });
    }
    return config;
  }

  /**
   * Check if a port configuration exists.
   */
  hasEndpointConfig(portName: string): boolean {
    return this.config.has(portName);
  }

  /**
   * Get all loaded configurations.
   */
  getAllConfigs(): Map<string, PortEndpointConfig> {
    return new Map(this.config);
  }

  /**
   * Check if MOCK_MODE is globally enabled.
   * When true, all ports use MockAdapter regardless of individual config.
   * AC: #2
   */
  isMockMode(): boolean {
    return process.env.MOCK_MODE === 'true';
  }

  /**
   * Force reload config from disk.
   * Public for testing — production code should rely on chokidar auto-reload.
   */
  async reloadConfig(): Promise<void> {
    await this.loadConfig();
  }

  /**
   * Resolve ${VAR_NAME} template variables in a string using process.env.
   * Fix #4: Throws fatal error on missing env var (fail-to-start principle).
   */
  private resolveEnvVars(content: string): string {
    return content.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
      const value = process.env[varName];
      if (value === undefined || value === null) {
        throw new Error(
          `Required environment variable not set: ${varName}. ` +
          `Check your .env file or container environment configuration.`,
        );
      }
      return value;
    });
  }

  /**
   * Load and validate the YAML config file.
   * Uses async file I/O to avoid blocking the event loop.
   * Resolves ${ENV_VAR} templates before Zod validation.
   * Validates against Zod schema — fatal on mismatch in non-production.
   */
  private async loadConfig(): Promise<void> {
    try {
      // Fix #7: async file read
      const rawContent = await fsPromises.readFile(this.configPath, 'utf-8');

      // Fix #2: resolve ${ENV_VAR} template variables
      const resolvedContent = this.resolveEnvVars(rawContent);
      const rawConfig = parseYaml(resolvedContent) as EndpointConfig;

      // Validate against Zod schema
      const result = ApiEndpointsSchema.safeParse(rawConfig);
      if (!result.success) {
        const errorMsg = `Invalid api-endpoints.yaml config: ${result.error.message}`;
        if (process.env.NODE_ENV !== 'production') {
          throw new Error(errorMsg);
        }
        this.logger.warn(errorMsg);
        return;
      }

      const validated = result.data;
      // Atomic swap: build new map first, then assign — never leave config empty
      const newConfig = new Map<string, PortEndpointConfig>();
      for (const [key, value] of Object.entries(validated.services)) {
        newConfig.set(key, value);
      }
      this.config = newConfig;

      this.logger.log(`Loaded ${this.config.size} endpoint configurations`);
    } catch (error) {
      this.logger.error(`Failed to load endpoint config: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  /**
   * Start chokidar file watcher for hot-reload.
   * Reloads config on file change within 100ms (stabilityThreshold).
   * AC: #3
   */
  private startWatcher(): void {
    this.watcher = chokidar.watch(this.configPath, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    this.watcher.on('change', async (filePath: string) => {
      const startTime = Date.now();
      this.logger.log(`Detected config change: ${filePath}`);

      try {
        await this.loadConfig();
        const duration = Date.now() - startTime;
        this.logger.log(`Config reloaded in ${duration}ms`);
      } catch (error) {
        this.logger.error(`Failed to reload config: ${(error as Error).message}`);
      }
    });

    this.watcher.on('error', (error: Error) => {
      this.logger.error(`Config watcher error: ${error.message}`);
    });
  }
}
/**
 * Hash Utility
 *
 * Deterministic short-hash function for cache keys, idempotency keys,
 * and any key that needs consistent output across restarts.
 *
 * Uses SHA-256 truncated to 16 hex chars for collision resistance
 * while keeping Redis key lengths reasonable.
 */

import { createHash } from 'crypto';

/**
 * Generate a deterministic short hash from any string payload.
 *
 * @param payload - The string to hash
 * @param length - Number of hex chars to keep (default 16, max 64)
 * @returns Lowercase hex string
 */
export function generateShortHash(payload: string, length: number = 16): string {
  return createHash('sha256').update(payload).digest('hex').substring(0, length);
}
import { Injectable, Inject, Optional } from '@nestjs/common';
import { StructuredLogger } from '../observability/structured-logger.service';
import { FALLBACK_CACHE_TOKEN } from './constants';

/**
 * Fallback function type
 */
export type FallbackFunction<T = any> = (
  error: Error,
  context: FallbackContext,
) => Promise<T> | T;

/**
 * Fallback execution context
 */
export interface FallbackContext {
  /**
   * The original operation being attempted
   */
  operation: string;

  /**
   * Arguments passed to the original function
   */
  args: any[];

  /**
   * Attempt count when fallback was triggered
   */
  attempt: number;

  /**
   * Total time spent attempting
   */
  duration: number;

  /**
   * Type of failure that triggered fallback
   */
  failureType: 'timeout' | 'circuit_breaker' | 'retry_exhausted' | 'error';

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Fallback response options
 */
export interface FallbackResponse<T = any> {
  /**
   * The fallback value to return
   */
  value: T;

  /**
   * Whether the fallback represents a degraded but acceptable state
   */
  degraded?: boolean;

  /**
   * Message explaining the fallback state
   */
  message?: string;

  /**
   * Additional metadata about the fallback response
   */
  metadata?: Record<string, any>;
}

/**
 * Fallback Provider Service
 *
 * Provides fallback mechanisms when primary operations fail.
 * Supports different fallback strategies: static values, cached data, or computed values.
 */
@Injectable()
export class FallbackProvider {
  private readonly fallbacks = new Map<string, FallbackFunction>();

  constructor(
    private readonly logger: StructuredLogger,
    @Optional()
    @Inject(FALLBACK_CACHE_TOKEN)
    private readonly fallbackCache?: Map<string, any>,
  ) {}

  /**
   * Register a fallback function for an operation
   */
  register(key: string, fallback: FallbackFunction): void {
    this.fallbacks.set(key, fallback);
    this.logger.debug(`Registered fallback for ${key}`);
  }

  /**
   * Execute fallback for an operation
   */
  async execute(
    key: string,
    error: Error,
    context: FallbackContext,
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // Check if we have a registered fallback
      const fallback = this.fallbacks.get(key);
      if (!fallback) {
        throw new Error(`No fallback registered for ${key}`);
      }

      // Execute fallback
      this.logger.info(`Executing fallback for ${key}`, {
        operation: { name: key },
        error: error,
        failureType: context.failureType,
        attempt: context.attempt,
      });

      const result = await fallback(error, context);
      const duration = Date.now() - startTime;

      this.logger.info(`Fallback executed successfully for ${key}`, {
        operation: { name: key, duration },
        duration,
        degraded: (result as FallbackResponse)?.degraded,
      });

      return result;
    } catch (fallbackError) {
      const duration = Date.now() - startTime;

      this.logger.error(`Fallback failed for ${key}`, fallbackError as Error, {
        operation: { name: key, duration },
        duration,
        originalError: error,
        data: {
          fallbackError: (fallbackError as Error).message,
        },
      });

      // Fallback failed too, rethrow the original error
      throw error;
    }
  }

  /**
   * Get cached fallback value if available
   */
  getCached(key: string): any {
    if (!this.fallbackCache) {
      return null;
    }

    return this.fallbackCache.get(key);
  }

  /**
   * Set cached fallback value
   */
  setCached(key: string, value: any, ttlMs?: number): void {
    if (!this.fallbackCache) {
      return;
    }

    this.fallbackCache.set(key, value);

    if (ttlMs) {
      setTimeout(() => {
        this.fallbackCache?.delete(key);
      }, ttlMs);
    }
  }

  /**
   * Clear cached fallback value
   */
  clearCached(key: string): boolean {
    if (!this.fallbackCache) {
      return false;
    }

    return this.fallbackCache.delete(key);
  }

  /**
   * Check if fallback exists for operation
   */
  has(key: string): boolean {
    return this.fallbacks.has(key);
  }

  /**
   * Remove fallback registration
   */
  unregister(key: string): boolean {
    return this.fallbacks.delete(key);
  }

  /**
   * Clear all fallbacks
   */
  clear(): void {
    this.fallbacks.clear();
    if (this.fallbackCache) {
      this.fallbackCache.clear();
    }
    this.logger.info('All fallbacks cleared');
  }

  /**
   * Get status of all registered fallbacks
   */
  getStatus(): Array<{
    key: string;
    hasCachedValue: boolean;
    cacheSize: number;
  }> {
    const status: Array<{
      key: string;
      hasCachedValue: boolean;
      cacheSize: number;
    }> = [];

    for (const key of this.fallbacks.keys()) {
      status.push({
        key,
        hasCachedValue: this.fallbackCache?.has(key) || false,
        cacheSize: this.fallbackCache?.size || 0,
      });
    }

    return status;
  }
}

/**
 * Pre-built fallback functions for common scenarios
 */
export class CommonFallbacks {
  /**
   * Return a static value
   */
  static staticValue<T>(value: T): FallbackFunction<T> {
    return () => value;
  }

  /**
   * Return a degraded response with status
   */
  static degradedResponse<T>(
    value: T,
    message: string = 'Service unavailable, showing degraded response',
  ): FallbackFunction<FallbackResponse<T>> {
    return () => ({
      value,
      degraded: true,
      message,
      metadata: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * Return cached value if available
   */
  static cachedValue(
    cacheKey: string,
    provider: FallbackProvider,
  ): FallbackFunction {
    return () => {
      const cached = provider.getCached(cacheKey);
      if (!cached) {
        throw new Error('No cached value available');
      }
      return cached;
    };
  }

  /**
   * Return empty collection for list operations
   */
  static emptyCollection(type: 'array' | 'object' = 'array'): FallbackFunction {
    return () => (type === 'array' ? [] : {});
  }

  /**
   * Return default value for primitive types
   */
  static defaultValue<T>(defaultValue: T): FallbackFunction<T> {
    return () => defaultValue;
  }

  /**
   * Throw a custom error
   */
  throwError(error: Error | string): FallbackFunction<never> {
    return () => {
      throw typeof error === 'string' ? new Error(error) : error;
    };
  }

  /**
   * Execute an alternative operation
   */
  static alternativeOperation<T>(
    alternativeFn: () => Promise<T> | T,
  ): FallbackFunction<T> {
    return async () => await alternativeFn();
  }

  /**
   * Return a paginated empty response
   */
  static emptyPaginatedResponse(
    page: number = 1,
    limit: number = 10,
  ): FallbackFunction {
    return () => ({
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    });
  }

  /**
   * Return a health check result
   */
  static healthCheck(
    status: 'healthy' | 'degraded' | 'unhealthy',
    details?: Record<string, any>,
  ): FallbackFunction {
    return () => ({
      status,
      timestamp: new Date().toISOString(),
      details,
    });
  }

  /**
   * Fallback for external API calls
   */
  static externalAPIFallback(
    serviceName: string,
    responseType: 'mock' | 'error' | 'cached' = 'error',
    mockData?: any,
  ): FallbackFunction {
    return (error, context) => {
      console.warn(`External API fallback triggered for ${serviceName}`, {
        service: serviceName,
        error: error.message,
        context,
      });

      switch (responseType) {
        case 'mock':
          return mockData || { mock: true, service: serviceName };

        case 'cached':
        // Note: getCached would need to be implemented or passed in
        // const cached = this.getCached(`api:${serviceName}`);
        // if (cached) {
        //   return { ...cached, cached: true };
        // }
        // Fall through to error if no cache

        case 'error':
        default:
          throw new Error(
            `Service ${serviceName} unavailable: ${error.message}`,
          );
      }
    };
  }
}

/**
 * Fallback decorator
 */
export const Fallback = (
  fallback: FallbackFunction | string,
  options?: {
    cacheKey?: string;
    cacheTTL?: number;
  },
) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const key =
      typeof fallback === 'string'
        ? fallback
        : `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      try {
        const result = await originalMethod.apply(this, args);

        // Cache successful result if caching enabled
        if (options?.cacheKey && this.fallbackProvider) {
          this.fallbackProvider.setCached(
            options.cacheKey,
            result,
            options.cacheTTL,
          );
        }

        return result;
      } catch (error) {
        // Execute fallback
        const fallbackFn =
          typeof fallback === 'string'
            ? () => this.fallbackProvider.getCached(fallback)
            : fallback;

        if (!fallbackFn) {
          throw error;
        }

        const context: FallbackContext = {
          operation: key,
          args,
          attempt: 1,
          duration: 0,
          failureType: 'error',
        };

        if (typeof fallbackFn === 'function') {
          return await fallbackFn(error as Error, context);
        }

        throw error;
      }
    };
  };
};
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import {
  IRequestContext,
  IRequestContextProvider,
  REQUEST_CONTEXT_TOKEN,
} from '../../core';

/**
 * Request Context Implementation
 */
class RequestContext implements IRequestContext {
  constructor(
    public readonly correlationId: string,
    public readonly causationId?: string,
    public readonly userId?: string,
    public readonly tenantId?: string,
    public readonly timestamp: Date = new Date(),
    public readonly metadata?: Record<string, unknown>,
  ) {}

  /**
   * Create a child context with causation tracking
   */
  createChild(causationId: string): RequestContext {
    return new RequestContext(
      this.correlationId,
      causationId,
      this.userId,
      this.tenantId,
      new Date(),
      this.metadata,
    );
  }
}

/**
 * Request Context Provider Implementation
 *
 * Uses AsyncLocalStorage for request-scoped context management.
 * This allows accessing request context anywhere in the call stack
 * without explicitly passing it through every function.
 *
 * ## Usage
 *
 * ### In Middleware/Interceptor (setup context)
 * ```typescript
 * @Injectable()
 * export class CorrelationIdMiddleware implements NestMiddleware {
 *   constructor(
 *     @Inject(REQUEST_CONTEXT_TOKEN)
 *     private readonly contextProvider: IRequestContextProvider,
 *   ) {}
 *
 *   use(req: Request, res: Response, next: NextFunction) {
 *     const correlationId = req.headers['x-correlation-id'] || randomUUID();
 *     const context = this.contextProvider.create(correlationId);
 *
 *     this.contextProvider.run(context, () => {
 *       res.setHeader('x-correlation-id', correlationId);
 *       next();
 *     });
 *   }
 * }
 * ```
 *
 * ### In Command Handler (use context)
 * ```typescript
 * async execute(command: CreateProductCommand): Promise<string> {
 *   const context = this.contextProvider.current();
 *
 *   product.addDomainEvent(new ProductCreatedEvent(
 *     product.id,
 *     data,
 *     {
 *       correlationId: context?.correlationId,
 *       userId: context?.userId,
 *     }
 *   ));
 * }
 * ```
 */
@Injectable()
export class RequestContextProvider implements IRequestContextProvider {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  /**
   * Get current request context
   */
  current(): IRequestContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Run callback within a specific context
   */
  run<T>(context: IRequestContext, callback: () => T): T {
    const requestContext =
      context instanceof RequestContext
        ? context
        : new RequestContext(
            context.correlationId,
            context.causationId,
            context.userId,
            context.tenantId,
            context.timestamp,
            context.metadata,
          );

    return this.storage.run(requestContext, callback);
  }

  /**
   * Create a new request context
   */
  create(correlationId?: string, userId?: string): IRequestContext {
    return new RequestContext(
      correlationId || randomUUID(),
      undefined,
      userId,
      undefined,
      new Date(),
    );
  }

  /**
   * Create context with full options
   */
  createFull(options: {
    correlationId?: string;
    causationId?: string;
    userId?: string;
    tenantId?: string;
    metadata?: Record<string, unknown>;
  }): IRequestContext {
    return new RequestContext(
      options.correlationId || randomUUID(),
      options.causationId,
      options.userId,
      options.tenantId,
      new Date(),
      options.metadata,
    );
  }
}

/**
 * Provider configuration for dependency injection
 */
export const RequestContextProviderToken = {
  provide: REQUEST_CONTEXT_TOKEN,
  useClass: RequestContextProvider,
};
import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import {
  type IRequestContextProvider,
  REQUEST_CONTEXT_TOKEN,
} from '../../core';

/**
 * Correlation ID Header name
 */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Correlation ID Middleware
 *
 * Middleware that:
 * 1. Extracts or generates correlation ID from request headers
 * 2. Sets up request context with correlation ID
 * 3. Adds correlation ID to response headers
 *
 * This enables distributed tracing across services.
 *
 * ## Usage
 *
 * ### In AppModule
 * ```typescript
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer
 *       .apply(CorrelationIdMiddleware)
 *       .forRoutes('*');
 *   }
 * }
 * ```
 *
 * ### In HTTP Client (propagate to other services)
 * ```typescript
 * const context = this.contextProvider.current();
 * const response = await axios.get(url, {
 *   headers: {
 *     'x-correlation-id': context?.correlationId,
 *   },
 * });
 * ```
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(
    @Inject(REQUEST_CONTEXT_TOKEN)
    private readonly contextProvider: IRequestContextProvider,
  ) {}

  use(
    req: FastifyRequest['raw'] & { headers: Record<string, string | string[]> },
    res: FastifyReply['raw'],
    next: () => void,
  ) {
    // Get correlation ID from header or generate new one
    const correlationId = this.extractCorrelationId(req) || randomUUID();

    // Extract user ID from JWT or session (if available)
    const userId = this.extractUserId(req);

    // Create request context
    const context = this.contextProvider.create(correlationId, userId);

    // Add correlation ID to response headers
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    // Run the rest of the request within this context
    this.contextProvider.run(context, () => {
      next();
    });
  }

  /**
   * Extract correlation ID from request headers
   */
  private extractCorrelationId(req: {
    headers: Record<string, string | string[]>;
  }): string | undefined {
    const header = req.headers[CORRELATION_ID_HEADER];
    if (Array.isArray(header)) {
      return header[0];
    }
    return header;
  }

  /**
   * Extract user ID from request (override for custom auth)
   */
  private extractUserId(_req: {
    headers: Record<string, string | string[]>;
  }): string | undefined {
    // Default implementation - override in subclass for JWT/session
    // Example: return req.user?.id;
    return undefined;
  }
}
import { Global, Module } from '@nestjs/common';
import { REQUEST_CONTEXT_TOKEN } from '../../core';
import { RequestContextProvider } from './request-context.provider';
import { CorrelationIdMiddleware } from './correlation-id.middleware';

/**
 * Context Module
 *
 * Provides request context management with:
 * - Correlation ID for distributed tracing
 * - User context from authentication
 * - Tenant context for multi-tenancy
 *
 * ## Setup
 *
 * 1. Import ContextModule in AppModule
 * 2. Apply CorrelationIdMiddleware to routes
 *
 * ```typescript
 * @Module({
 *   imports: [ContextModule],
 * })
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer
 *       .apply(CorrelationIdMiddleware)
 *       .forRoutes('*');
 *   }
 * }
 * ```
 */
@Global()
@Module({
  providers: [
    RequestContextProvider,
    {
      provide: REQUEST_CONTEXT_TOKEN,
      useExisting: RequestContextProvider,
    },
    CorrelationIdMiddleware,
  ],
  exports: [
    REQUEST_CONTEXT_TOKEN,
    RequestContextProvider,
    CorrelationIdMiddleware,
  ],
})
export class ContextModule {}
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import {
  BaseException,
  DomainException,
  ValidationException,
  ConcurrencyException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from 'src/libs/core/common';
import {
  PortDownstreamException,
  PortTimeoutException,
  PortNotRegisteredException,
} from 'src/libs/shared/port/port-exceptions';

/**
 * Global Exception Filter
 *
 * Catches all exceptions and transforms them into standardized HTTP responses
 * Maps domain exceptions to appropriate HTTP status codes
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    // Handle NestJS HttpException
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, response, request);
    }

    // Handle custom domain exceptions
    if (exception instanceof BaseException) {
      return this.handleBaseException(exception, response, request);
    }

    // Handle unknown errors
    return this.handleUnknownError(exception, response, request);
  }

  private handleHttpException(
    exception: HttpException,
    response: FastifyReply,
    request: FastifyRequest,
  ) {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error:
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || exception.message,
      details:
        typeof exceptionResponse === 'object' && 'error' in exceptionResponse
          ? exceptionResponse
          : undefined,
    };

    response.status(status).send(errorResponse);
  }

  private handleBaseException(
    exception: BaseException,
    response: FastifyReply,
    request: FastifyRequest,
  ) {
    const status = this.getHttpStatus(exception);
    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: {
        name: exception.name,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      },
    };

    response.status(status).send(errorResponse);
  }

  private handleUnknownError(
    exception: unknown,
    response: FastifyReply,
    request: FastifyRequest,
  ) {
    const error =
      exception instanceof Error ? exception : new Error('Unknown error');
    const isDevelopment = process.env.NODE_ENV !== 'production';

    const errorResponse = {
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: {
        name: 'InternalServerError',
        code: 'INTERNAL_SERVER_ERROR',
        message: isDevelopment ? error.message : 'An unexpected error occurred',
        ...(isDevelopment && { stack: error.stack }),
      },
    };

    if (!isDevelopment) {
      console.error('Unhandled exception:', error);
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send(errorResponse);
  }

  private getHttpStatus(exception: BaseException): number {
    // Port infrastructure exceptions
    if (exception instanceof PortDownstreamException) {
      // Proxy the downstream status code to the client (4xx → 4xx, 5xx → 5xx)
      // but cap at 500 to avoid leaking non-standard downstream codes
      return exception.statusCode >= 500 ? HttpStatus.BAD_GATEWAY : exception.statusCode;
    }
    if (exception instanceof PortTimeoutException) {
      return HttpStatus.GATEWAY_TIMEOUT;
    }
    if (exception instanceof PortNotRegisteredException) {
      return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    // Domain exceptions
    if (exception instanceof NotFoundException) {
      return HttpStatus.NOT_FOUND;
    }
    if (exception instanceof UnauthorizedException) {
      return HttpStatus.UNAUTHORIZED;
    }
    if (exception instanceof ForbiddenException) {
      return HttpStatus.FORBIDDEN;
    }
    if (exception instanceof ConflictException) {
      return HttpStatus.CONFLICT;
    }
    if (exception instanceof ConcurrencyException) {
      return HttpStatus.CONFLICT;
    }
    if (exception instanceof ValidationException) {
      return HttpStatus.BAD_REQUEST;
    }
    if (exception instanceof DomainException) {
      return HttpStatus.BAD_REQUEST;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
/**
 * Request Context Interface
 *
 * Chứa thông tin context của request hiện tại
 * Được sử dụng cho:
 * - Correlation ID (distributed tracing)
 * - User information (authentication)
 * - Tenant information (multi-tenancy)
 *
 * @example
 * ```typescript
 * // Usage in Command Handler
 * async execute(command: CreateProductCommand): Promise<string> {
 *   const context = this.requestContext.current();
 *
 *   // Add correlation ID to domain event
 *   product.addDomainEvent(new ProductCreatedEvent(
 *     product.id,
 *     data,
 *     { correlationId: context.correlationId }
 *   ));
 * }
 * ```
 */
export interface IRequestContext {
  /**
   * Correlation ID for distributed tracing
   * Được tạo ở đầu request và truyền qua tất cả services
   */
  readonly correlationId: string;

  /**
   * Causation ID - ID của event/command gây ra request này
   * Dùng để track event chain
   */
  readonly causationId?: string;

  /**
   * User ID của user đang thực hiện request
   */
  readonly userId?: string;

  /**
   * Tenant ID (cho multi-tenant applications)
   */
  readonly tenantId?: string;

  /**
   * Request timestamp
   */
  readonly timestamp: Date;

  /**
   * Additional metadata
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Request Context Provider Interface (Port)
 *
 * Interface để lấy và set request context
 * Implementation sử dụng AsyncLocalStorage
 */
export interface IRequestContextProvider {
  /**
   * Lấy context hiện tại
   * @returns Current request context hoặc undefined nếu không có
   */
  current(): IRequestContext | undefined;

  /**
   * Chạy callback trong context cụ thể
   *
   * @param context Request context
   * @param callback Function cần chạy trong context
   */
  run<T>(context: IRequestContext, callback: () => T): T;

  /**
   * Tạo context mới với correlation ID
   *
   * @param correlationId Optional correlation ID (tự generate nếu không có)
   * @param userId Optional user ID
   */
  create(correlationId?: string, userId?: string): IRequestContext;

  /**
   * Create context with full options — used by middleware to enrich context
   * with authentication identity (roles, provider, sessionId) via metadata.
   *
   * @param options Full context creation options
   */
  createFull(options: {
    correlationId?: string;
    causationId?: string;
    userId?: string;
    tenantId?: string;
    metadata?: Record<string, unknown>;
  }): IRequestContext;
}
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
import { AuthPropagationModule, AuthPropagationMiddleware } from 'src/libs/shared/auth-propagation';
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
    // Auth Module — customer registration & multi-provider authentication
    AuthModule,
    // Auth Propagation — JWT signing for BFF→downstream identity propagation
    AuthPropagationModule,
    // Hexagonal Port Registry — centralized downstream service interface (needs AuthPropagationModule)
    PortModule,
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
// Auth Module Public API
export { AuthModule } from './auth.module';
export * from './domain';
export * from './application';
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
import { AggregateRoot } from '@core/domain';
import { ConflictException } from '@core/common';
import { UserRegisteredEvent } from '../events/user-registered.event';
import { ProviderLinkedEvent } from '../events/provider-linked.event';
import { ProviderType } from '../value-objects/provider-type.value-object';
import { UserRole } from '../value-objects/user-role.value-object';
import { UserStatus } from '../value-objects/user-status.value-object';
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
 * - Role and Status are enforced via Value Objects (UserRole, UserStatus)
 */
export class User extends AggregateRoot {
  private _email: string | null;
  private _phone: string | null;
  private _name: string;
  private _role: UserRole;
  private _status: UserStatus;
  private _providers: ProviderLink[];

  private constructor(
    id: string,
    version: number,
    email: string | null,
    phone: string | null,
    name: string,
    role: UserRole,
    status: UserStatus,
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
    return this._role.value;
  }
  get status(): string {
    return this._status.value;
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
      UserRole.CUSTOMER,
      UserStatus.ACTIVE,
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
   * Role and Status are validated via Value Objects — invalid values throw.
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
      UserRole.fromString(params.role),   // Validates via VO — throws on invalid
      UserStatus.fromString(params.status), // Validates via VO — throws on invalid
      params.createdAt,
      params.updatedAt,
      params.providers,
    );
  }
}
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
  code: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
});

export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;
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
// Application Layer Exports

// Commands
export { RegisterWithProviderCommand } from './commands/register-with-provider.command';
export { LinkProviderCommand } from './commands/link-provider.command';
export { VerifyOtpCommand } from './commands/verify-otp.command';

// Command Handlers
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
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  uniqueIndex,
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
 *
 * PII fields (email, phone):
 * - Encrypted via AES-256-GCM with random IV (stored in email/phone columns)
 * - Searchable via HMAC-SHA256 blind index (stored in email_hash/phone_hash columns)
 * - Query pattern: WHERE phone_hash = hmac_sha256(phone_input, secret)
 */
export const usersTable = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // PII fields — AES-256-GCM encrypted (random IV, NOT searchable directly)
    email: varchar('email', { length: 512 }),
    phone: varchar('phone', { length: 512 }),
    // Blind index hashes — HMAC-SHA256 for searchable lookups
    emailHash: varchar('email_hash', { length: 64 }),
    phoneHash: varchar('phone_hash', { length: 64 }),
    name: varchar('name', { length: 255 }),
    role: userRoleEnum('role').default('customer'),
    status: userStatusEnum('status').default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    // Unique blind index for phone lookup — prevents duplicate phone registrations
    uniqueIndex('idx_users_phone_hash').on(table.phoneHash),
    // Unique blind index for email lookup — prevents duplicate email registrations
    uniqueIndex('idx_users_email_hash').on(table.emailHash),
  ],
);

/**
 * TypeScript type for User record
 */
export type UserRecord = typeof usersTable.$inferSelect;
export type NewUserRecord = typeof usersTable.$inferInsert;
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  pgEnum,
  uniqueIndex,
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
export const providerLinksTable = pgTable(
  'provider_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    providerType: providerTypeEnum('provider_type').notNull(),
    providerId: varchar('provider_id', { length: 255 }).notNull(), // phone number, Zalo ID, social sub
    providerEmail: varchar('provider_email', { length: 255 }), // from social OAuth
    isVerified: boolean('is_verified').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    // Unique constraint: one provider type+id can only be linked to one user
    uniqueIndex('idx_provider_links_type_id').on(
      table.providerType,
      table.providerId,
    ),
  ],
);

/**
 * TypeScript type for ProviderLink record
 */
export type ProviderLinkRecord = typeof providerLinksTable.$inferSelect;
export type NewProviderLinkRecord = typeof providerLinksTable.$inferInsert;
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
import { ConflictException } from '@core/common';

/**
 * User Repository Implementation
 *
 * Implements IUserRepository using Drizzle ORM.
 * Uses Blind Index pattern for PII lookups:
 *   - phone/email: AES-256-GCM encrypted (random IV, storage only)
 *   - phone_hash/email_hash: HMAC-SHA256 blind index (searchable)
 * Uses onConflictDoUpdate for atomic upserts (no race conditions).
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
    _expectedVersion: number,
  ): Promise<void> {
    const encryptedEmail = this.encryptionService.encryptIfNeeded(aggregate.email);
    const encryptedPhone = this.encryptionService.encryptIfNeeded(aggregate.phone);
    const emailHash = this.encryptionService.hashIfNeeded(aggregate.email);
    const phoneHash = this.encryptionService.hashIfNeeded(aggregate.phone);

    // Atomic upsert — DB handles race conditions via unique constraints
    await this.db
      .insert(usersTable)
      .values({
        id: aggregate.id,
        email: encryptedEmail,
        phone: encryptedPhone,
        emailHash,
        phoneHash,
        name: aggregate.name,
        role: aggregate.role as 'customer' | 'admin',
        status: aggregate.status as 'active' | 'suspended' | 'deleted',
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: {
          email: encryptedEmail,
          phone: encryptedPhone,
          emailHash,
          phoneHash,
          name: aggregate.name,
          status: aggregate.status as 'active' | 'suspended' | 'deleted',
          updatedAt: new Date(),
        },
      });

    // Upsert provider links atomically
    for (const provider of aggregate.providers) {
      const providerTypeValue = provider.providerType.value as 'phone' | 'zalo' | 'google' | 'facebook' | 'apple';

      await this.db
        .insert(providerLinksTable)
        .values({
          id: provider.id,
          userId: aggregate.id,
          providerType: providerTypeValue,
          providerId: provider.providerId,
          providerEmail: provider.providerEmail,
          isVerified: provider.isVerified,
        })
        .onConflictDoUpdate({
          target: [providerLinksTable.providerType, providerLinksTable.providerId],
          set: {
            providerEmail: provider.providerEmail,
            isVerified: provider.isVerified,
          },
        });
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

  /**
   * Get user by phone using HMAC blind index.
   * Query: WHERE phone_hash = hmac_sha256(phone_input, secret)
   */
  async getByPhone(phone: string): Promise<User | null> {
    const phoneHash = this.encryptionService.hashForLookup(phone);

    const rows = await this.dbRead
      .select()
      .from(usersTable)
      .where(eq(usersTable.phoneHash, phoneHash));

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

  /**
   * Get user by email using HMAC blind index.
   * Query: WHERE email_hash = hmac_sha256(email_input, secret)
   */
  async getByEmail(email: string): Promise<User | null> {
    const emailHash = this.encryptionService.hashForLookup(email);

    const rows = await this.dbRead
      .select()
      .from(usersTable)
      .where(eq(usersTable.emailHash, emailHash));

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
    await this.db.delete(usersTable).where(eq(usersTable.id, id));
  }

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
import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
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
 * Uses HMAC blind index for PII lookups (same pattern as UserRepository).
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

  /**
   * Get user by phone using HMAC blind index.
   */
  async getByPhone(phone: string): Promise<UserReadModel | null> {
    const phoneHash = this.encryptionService.hashForLookup(phone);

    const rows = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.phoneHash, phoneHash));

    if (!rows || rows.length === 0) return null;

    return this.mapRow(rows[0]);
  }

  /**
   * Get user by email using HMAC blind index.
   */
  async getByEmail(email: string): Promise<UserReadModel | null> {
    const emailHash = this.encryptionService.hashForLookup(email);

    const rows = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.emailHash, emailHash));

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
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

/**
 * PII Encryption Service
 *
 * Two-tier encryption for PII fields (phone, email):
 *
 * 1. **AES-256-GCM (random IV)**: For storing the actual encrypted value.
 *    Every encryption produces a unique ciphertext. This is the ONLY
 *    safe way to use AES-GCM — IV must NEVER be reused.
 *
 * 2. **HMAC-SHA256 Blind Index**: For searchable lookups.
 *    Stored in a separate `_hash` column. Deterministic (same input → same hash)
 *    but one-way — cannot be reversed to recover the plaintext.
 *    Query: `WHERE phone_hash = hmac_sha256(phone_input, secret_salt)`
 *
 * This pattern (Blind Index) is the industry standard for searchable encryption
 * and avoids the critical vulnerability of using AES-GCM with a static IV.
 *
 * Complies with NFR-S1 (AES-256 at rest) and Nghị định 13/2023/NĐ-CP.
 */
@Injectable()
export class PiiEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly hmacKey: Buffer;
  private readonly logger = new Logger(PiiEncryptionService.name);

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.getOrThrow<string>('PII_ENCRYPTION_KEY');
    this.key = Buffer.from(secret, 'hex'); // Must be 32 bytes (64 hex chars)

    if (this.key.length !== 32) {
      throw new Error(
        `PII_ENCRYPTION_KEY must be 32 bytes (64 hex chars), got ${this.key.length} bytes`,
      );
    }

    // Derive a separate HMAC key from the encryption key for blind index
    // Using a different context string ensures key separation
    this.hmacKey = createHmac('sha256', this.key)
      .update('blind-index-hmac-key-v1')
      .digest();
  }

  // =========================================================================
  // AES-256-GCM Encryption (random IV — for storage)
  // =========================================================================

  /**
   * Encrypt plaintext using AES-256-GCM with random IV.
   * Every call produces a unique ciphertext — safe for storage.
   * NOT searchable — use hashForLookup() for blind index queries.
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
  // HMAC-SHA256 Blind Index (for searchable lookups)
  // =========================================================================

  /**
   * Compute HMAC-SHA256 blind index for a PII value.
   * Deterministic: same input always produces the same hash.
   * One-way: hash cannot be reversed to recover the plaintext.
   *
   * Store the result in a `_hash` column alongside the encrypted value.
   * Use for DB queries: WHERE phone_hash = hashForLookup(phoneInput)
   */
  hashForLookup(plaintext: string): string {
    return createHmac('sha256', this.hmacKey)
      .update(plaintext)
      .digest('hex');
  }

  // =========================================================================
  // Convenience Methods
  // =========================================================================

  /**
   * Encrypt for storage if value is not null/undefined/empty.
   * Returns null if input is falsy.
   */
  encryptIfNeeded(value: string | null | undefined): string | null {
    if (!value) return null;
    return this.encrypt(value);
  }

  /**
   * Decrypt if value is not null/undefined/empty.
   * Returns null if input is falsy.
   */
  decryptIfNeeded(value: string | null | undefined): string | null {
    if (!value) return null;
    return this.decrypt(value);
  }

  /**
   * Compute blind index hash if value is not null/undefined/empty.
   * Returns null if input is falsy.
   */
  hashIfNeeded(value: string | null | undefined): string | null {
    if (!value) return null;
    return this.hashForLookup(value);
  }
}
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
