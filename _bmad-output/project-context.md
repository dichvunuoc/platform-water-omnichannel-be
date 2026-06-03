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
