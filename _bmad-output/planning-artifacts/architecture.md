---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-06-03'
inputDocuments:
  - product-brief-IOC-Customer-2026-06-02.md
  - prd.md
  - docs/Mota_Tinh_Nang_KinhDoanh_KhachHang (AutoRecovered).docx
workflowType: 'architecture'
project_name: 'nestjs-project-example'
user_name: 'Pc'
date: '2026-06-03'
projectClassification:
  type: 'API Gateway & Orchestrator Platform'
  domain: 'Utility'
  subDomain: 'Govtech'
  complexity: 'High'
  complexityFocus: 'Resilience & Orchestration (NOT business logic)'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Positioning Summary

> **Core Insight (from Panel Review):** This project is NOT a business logic engine — it is a **Coordination & Resilience Layer**. The architectural complexity lives in orchestration, circuit breaking, context preservation, and mock→live migration — not in domain business rules.

| Criterion | Refined Value | Rationale |
|-----------|--------------|-----------|
| **Project Type** | API Gateway & Orchestrator Platform | Stateful sessions (Redis), smart routing, centralized Auth, multi-channel integration orchestration. Does NOT own business logic. |
| **Domain** | Utility (Sub: Govtech) | Direct interaction with physical infrastructure (SCADA, GIS, water meters) under strict government regulation for essential public services. |
| **Complexity** | **High** — Resilience & Orchestration focus | Key risks: (1) Chain failure from 3rd-party APIs, (2) Multi-channel context preservation, (3) Zero-downtime Mock→Live migration |

### Risk Assessment (from Murat's Analysis)

| Risk Area | Reason | Level |
|-----------|--------|-------|
| Integration Testing | Dependencies on Backend APIs (Thương) without control | 🔴 High |
| Concurrent Channel Testing | K1 Context Preservation requires simultaneous Zalo + Hotline testing | 🔴 High |
| Resilience Testing | Circuit Breaker, cache fallback, queue handling when backend APIs fail | 🔴 High |
| Migration Testing | Mock→Live config switching requires zero-downtime and absolute schema accuracy | 🟡 Medium-High |

## Project Context Analysis

### Requirements Overview

**Functional Requirements (43 total across 10 categories):**

| Category | Count | Architectural Impact |
|----------|-------|---------------------|
| Authentication & Identity (FR1-FR8) | 8 | Centralized Auth service, multi-provider linking, JWT lifecycle management |
| Multi-Channel Adapters (FR9-FR13) | 5 | Hexagonal input adapters, request normalization layer |
| Orchestrator Core (FR14-FR18) | 5 | Routing engine, intent recognition, mock/live switching |
| Ticket Lifecycle (FR19-FR22) | 4 | Owned DB (CSKH), event sourcing for status changes, dual update sources (NV + Backend webhook) |
| Context Preservation (FR23-FR26) | 4 | Redis session store + Event Sourcing, cross-channel user resolution, persistence (AOF) |
| Resilience & Degradation (FR27-FR30) | 4 | Circuit Breaker, tiered cache, fallback chain |
| Notification & CSAT (FR31-FR33, FR43) | 4 | Channel-aware notification dispatch, rate limiting, CSAT collection |
| Mocking System (FR34-FR36) | 3 | Config-driven mock/live, JSON schema validation |
| Identity Propagation (FR37-FR39) | 3 | JWT signing, shared secret, error handling chain |
| Error Handling (FR40-FR42) | 3 | Graceful user communication, admin alerting, auto-recovery |

**Non-Functional Requirements (27 total across 5 dimensions):**

| Dimension | Count | Key Driver |
|-----------|-------|-----------|
| Performance (NFR-P1 to P6) | 6 | Adapter < 200ms, Auth < 500ms, Backend timeout 3s, 500 concurrent sessions |
| Security (NFR-S1 to S9) | 9 | AES-256 at rest, TLS 1.3, 15-min access token, PII masking, 12-month audit log |
| Reliability (NFR-R1 to R5) | 5 | 99.5% uptime, **0% total outage**, Circuit Breaker < 10s, Session survive restart |
| Scalability (NFR-SC1 to SC3) | 3 | Horizontal scaling, new adapter = 0 core change, mock→live < 5% perf delta |
| Integration (NFR-I1 to I4) | 4 | OpenAPI schema gate (fail-to-start), Zalo OA compliance, IVR webhook < 500ms |

**Scale & Complexity:**

- Primary domain: API Gateway & Orchestrator Platform (Utility/Govtech)
- Complexity level: **High** — Resilience & Orchestration focused
- Estimated architectural components: **8-10** (Auth Service, Session Store, Orchestrator Core, Routing Engine, Resilience Layer, Config Manager, 2+ Input Adapters, Notification Dispatcher)

### Technical Constraints & Dependencies

| Constraint | Source | Architectural Implication |
|-----------|--------|--------------------------|
| better-auth for centralized auth | Product Brief | Auth service owns User/Session DB. Must support multi-provider linking. |
| Redis for session store | Product Brief (K1) | AOF persistence mandatory. TTL 24-48h. Event sourcing pattern. |
| PostgreSQL for User/Session DB | PRD (IR-9) | Owned by CSKH module. RBAC data lives here. |
| opossum for Circuit Breaker | Product Brief (K5) | Node.js library. Per-endpoint circuit breaker instances. |
| OpenAPI/Swagger from Backend | PRD (DR-6, PT-1) | Contract-first. Mock data generated from spec. CI/CD gate. |
| Zalo OA REST API | PRD (IR-6) | Inbound/Outbound. Rate limiting (FR43): max 2 msg/KH/ticket/day |
| BullMQ on Redis for Retry Queue | Product Brief (K5) | Exponential backoff. Dead Letter Queue. Phase 2. |
| Nghị định 13/2023/NĐ-CP compliance | PRD (DR-1) | PII encryption, audit logging, data retention policies |

### Cross-Cutting Concerns Identified

1. **Identity Propagation** — Every outbound request to Backend carries JWT. Token lifecycle (issue, refresh, error handling) spans Auth Layer + Orchestrator Core. Affects every adapter and every backend call.

2. **Resilience Boundary** — Every outbound HTTP call must be wrapped in Circuit Breaker + Cache fallback + Timeout. Not optional — NFR-R2 mandates 0% total outage. Requires a centralized resilience middleware layer.

3. **Audit & Correlation** — Every request carries correlation ID (PT-12). Structured logging spans all layers. PII masking (NFR-S9) must be applied before any log write. 12-month retention (NFR-S8).

4. **Config Hot-Reload** — Endpoint configs (mock/live URLs, timeouts, thresholds) must be reloadable without restart (NFR-P5 < 100ms). Affects routing engine and circuit breaker instances.

5. **Contract Validation Gate** — CI/CD must validate mock JSON against latest OpenAPI spec (NFR-I1). Fail-to-start in dev/staging if mismatch. Creates hard dependency on Backend providing accurate specs.

## Starter Template Evaluation

### Primary Technology Domain

**API Backend / Orchestrator Platform** — Brownfield NestJS 11 project with established DDD/CQRS foundation.

### Existing Foundation (Already Established)

The project runs on a mature NestJS 11 + Fastify + TypeScript stack with:
- **DDD Core Library**: Base entities, value objects, specifications, repositories, unit of work
- **CQRS Infrastructure**: Custom command/query buses, event bus, idempotency support
- **Shared Infrastructure**: Drizzle ORM (PostgreSQL), Redis caching, Pino logging, OpenTelemetry, correlation ID middleware, transactional outbox
- **Existing Modules**: Product and Order modules as reference implementations
- **Testing**: Jest 30 + Supertest, TypeScript 5.7, Bun runtime

### Starter Decision: Build on Existing Foundation

**Rationale:** The existing codebase already provides 60-70% of the infrastructure patterns needed for the Orchestrator. The CQRS buses, correlation ID middleware, Redis caching, and Drizzle ORM map directly to CSKH requirements. Starting from scratch would waste this foundation.

**What the foundation provides for CSKH:**

| Existing Pattern | CSKH Mapping |
|-----------------|-------------|
| CQRS Command/Query buses | Orchestrator request routing + intent handling |
| Correlation ID middleware | Distributed tracing + audit logging (NFR-S7, PT-12) |
| Redis cache service | Session store + fallback cache tier |
| Drizzle ORM + PostgreSQL | User/Session/Ticket persistence (CSKH-owned DB) |
| Transactional outbox | Reliable session event publishing |
| Pino structured logging | Audit-compliant structured logs |
| Zod validation | OpenAPI schema validation (contract gate) |

**What must be added (CSKH-specific layers):**

1. **Auth Module** — better-auth integration via `nestjs-better-auth` (requires better-auth ≥ 1.3.8)
2. **Circuit Breaker Module** — opossum 8.1.3 wrapped as NestJS injectable service, per-endpoint instances
3. **Hexagonal Adapter Layer** — Abstract `InputAdapter` interface + concrete Zalo/Hotline adapters as NestJS modules
4. **Session Store Module** — Redis-based event sourcing on top of existing Redis cache service, AOF persistence
5. **Endpoint Config Module** — Hot-reloadable config layer on top of @nestjs/config for mock/live switching
6. **JWT Propagation Middleware** — Sign outbound requests with identity token for Backend API calls
7. **Notification Dispatcher** — Channel-aware dispatch with rate limiting (max 2 msg/KH/ticket/day per FR43)

**No initialization command needed** — project already exists. First implementation story should be: "Add Auth Module with better-auth integration."

## Core Architectural Decisions

### Decision Priority Analysis

**Already Decided (by existing codebase + PRD):**

| Decision | Choice | Locked By |
|----------|--------|-----------|
| Framework | NestJS 11 + Fastify | Existing codebase |
| Language | TypeScript 5.7 | Existing codebase |
| ORM / Database | Drizzle ORM + PostgreSQL | Existing codebase |
| Cache Layer | Redis | Existing codebase |
| Logging | Pino + nestjs-pino | Existing codebase |
| Auth Library | better-auth | PRD + Product Brief |
| Circuit Breaker | opossum | Product Brief (K5) |
| Architecture | Hexagonal + DDD/CQRS | Existing codebase + PRD |
| API Style | REST + OpenAPI/Swagger | PRD (PT-1) |
| Tracing | OpenTelemetry + Correlation ID | Existing codebase |
| Package Manager / Runtime | Bun 1.1 | Existing codebase |
| Testing | Jest 30 + Supertest | Existing codebase |
| Validation | Zod + class-validator | Existing codebase |

**Critical Decisions Made (This Step):**

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | JWT Signing Library | **`jose`** | Modern Web Crypto API, native JWK rotation support (matches K8 `JWT_SECRET_OLD`/`JWT_SECRET_NEW` strategy), Bun-compatible, no native deps |
| D2 | Mock Strategy | **Static JSON + Zod schema validation** | Full control, in-process (no extra service), integrates with Circuit Breaker directly, OpenAPI schema gate at startup (NFR-I1) |
| D3 | Session Event Storage | **Redis Hash + Sorted Set** | O(1) full session read, O(log N) time-range queries, straightforward TTL per session key, compatible with existing `RedisCacheService` |
| D4 | Config Hot-Reload | **File watch (`chokidar`) + `@nestjs/config`** | Simplest, no extra infra, < 100ms reload, single-instance for MVP. Phase 2 can migrate to Redis pub/sub for horizontal scaling |
| D5 | Backend API Client | **Custom `BackendClient` service (native `fetch` + opossum)** | Bun-optimized fetch, full control over Circuit Breaker/timeout/JWT injection per endpoint, testable, no generated code maintenance |
| D6 | Dev Environment | **Docker Compose (PostgreSQL + Redis) + native Bun (app)** | Consistent stateful services across team, fastest hot-reload for NestJS on Windows via native Bun |

**Deferred Decisions (Post-MVP):**

| Decision | Deferred To | Reason |
|----------|------------|--------|
| Redis pub/sub for config sync | Phase 2 (horizontal scaling) | Single-instance for MVP, file watch sufficient |
| OpenAPI code generation for Backend client | Phase 2 | Schema may change frequently during MVP; manual client more flexible |
| Kubernetes / container orchestration | Phase 3 | Docker Compose sufficient for MVP + early growth |
| BullMQ retry queue | Phase 2 | DLQ + exponential backoff not needed until full Graceful Degradation (G3) |
| Shadow Mode | When Backend ready | Only needed for billing-related API migration |

### Data Architecture

**Databases:**

| Store | Technology | Purpose | Owner |
|-------|-----------|---------|-------|
| Primary DB | PostgreSQL (via Drizzle ORM) | User, Session, Ticket, RBAC data | CSKH (owned) |
| Session Store | Redis (AOF persistence) | Active session events, context cache | CSKH (owned) |
| API Response Cache | Redis (same instance, separate key namespace) | Tiered cache: static 12-24h, dynamic 5-15min, transaction: NO CACHE | CSKH (owned) |

**Data Modeling Approach:**

- **Domain models**: DDD entities + value objects (existing core library patterns)
- **Persistence**: Drizzle ORM schema definitions, unit of work for transactional writes
- **Validation**: Zod schemas derived from OpenAPI spec — validated at startup and on every request
- **Migration**: Drizzle Kit (`db:generate` + `db:migrate`)

**Session Event Schema (Redis):**

```
Key: session:{userId}
  Hash fields:
    sessionId: string
    userId: string
    createdAt: timestamp
    expiresAt: timestamp

Key: session:{userId}:events
  Sorted Set (score = timestamp):
    member: JSON.stringify({ type, timestamp, content, metadata, channel })

TTL: 24-48h (configurable), AOF persistence ensures survive restart
```

**Session Write Atomicity (CRITICAL — prevents race conditions):**

When KH interacts simultaneously via multiple channels (e.g., Zalo + Hotline within milliseconds), concurrent writes to `session:{userId}:events` MUST be atomic. **NEVER** issue separate `ZADD` then `EXPIRE` commands.

```typescript
// ✅ CORRECT — Redis Lua script for atomic session event append
// All operations in single Redis call: ZADD + update session hash + refresh TTL
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
await redis.zadd(eventsKey, score, event);  // ← gap here: another write can interleave
await redis.expire(eventsKey, ttl);          // ← TTL applied to wrong state
```

**Cache TTL Strategy (from PRD):**

| Data Type | TTL | Examples |
|-----------|-----|---------|
| Static (KH identity, contracts, pricing) | 12-24h | Customer 360° profile |
| Dynamic (balance, payment history, ticket status) | 5-15 min | Ticket status, open incidents |
| Transaction (payments, SCADA commands) | **NO CACHE** | Must call live 100% |

### Authentication & Security

**Auth Architecture:**

| Layer | Technology | Responsibility |
|-------|-----------|---------------|
| Auth Service | better-auth (via `nestjs-better-auth`) | User registration, login, token management, multi-provider linking |
| Token Signing | `jose` library | JWT issue with HS256/RS256, key rotation support |
| Token Propagation | JWT in `Authorization: Bearer` header | Every Orchestrator → Backend request carries signed identity |
| RBAC Enforcement | NestJS Guards | 4 roles: `customer`, `employee`, `manager`, `admin` |

**JWT Token Strategy:**

| Token | TTL | Purpose |
|-------|-----|---------|
| Access Token | 15 minutes | API authorization, carries identity + roles + channel |
| Refresh Token | 7 days | Silent token renewal, better-auth refresh flow |

**JWT Payload (forwarded to Backend):**

```json
{
  "sub": "USR-12345",
  "roles": ["customer"],
  "provider": "zalo",
  "session_id": "SES-67890",
  "xi_nghiep": "central",
  "iat": 1748995200,
  "exp": 1749081600
}
```

**Security Measures:**

- **PII Masking (MANDATORY — Nghị định 13/2023/NĐ-CP compliance):**
  Use `pino-redact` library. The following JSON paths are **always** redacted in every log entry across the entire application. No exceptions.

  ```typescript
  // pino configuration — applied globally
  const pinoOptions = {
    redact: {
      paths: [
        '*.phone', '*.phoneNumber', '*.soDienThoai',
        '*.cccd', '*.cccdNumber',
        '*.address', '*.diaChi',
        '*.password', '*.token', '*.secret',
        '*.refreshToken', '*.accessToken',
      ],
      censor: '[REDACTED]',   // Exact replacement string — never use partial masking
    },
  };
  ```

  **Rule:** Every Pino instance in every module MUST inherit this redact configuration. If a developer adds a new log field containing PII that is not in the list above, they MUST add the path to the redact configuration first.

- Audit log: structured JSON, correlation ID on every entry, 12-month retention
- Secret management: `JWT_SECRET` env var, rotation via `JWT_SECRET_OLD` + `JWT_SECRET_NEW`
- TLS 1.3 for all transit, AES-256 at rest for PII fields

### API & Communication Patterns

**Internal Communication (within Orchestrator):**

| Pattern | Technology | Use Case |
|---------|-----------|---------|
| Command/Query routing | Existing CQRS buses | Adapter → Orchestrator Core → Backend Client |
| Domain events | Existing Event Bus + Transactional Outbox | Ticket status changes, session events |
| Session tracking | Redis Hash + Sorted Set | Context Preservation (K1) |

**External Communication (Orchestrator ↔ Backend):**

| Direction | Pattern | Details |
|-----------|---------|---------|
| Outbound (→ Backend) | `BackendClient` service | `fetch` + opossum Circuit Breaker + JWT injection + timeout 3s |
| Inbound (← Backend) | Webhook endpoint | Backend sends ticket status updates via `POST /webhooks/tickets/{id}/status` |
| Inbound (← Zalo) | Webhook endpoint | Zalo OA sends messages via callback URL |
| Inbound (← Hotline) | Webhook/SIP | Hotline system sends call events |

**Mock → Live Switching Flow:**

```
1. Admin edits config/api-endpoints.yaml: current: mock → current: live
2. chokidar file watcher detects change
3. @nestjs/config reloads in < 100ms
4. BackendClient receives new endpoint config
5. Circuit Breaker instance reset for affected endpoint
6. Next request uses live endpoint — zero downtime
```

**Contract Validation Gate (NFR-I1):**

```
CI/CD Pipeline:
  1. Fetch latest OpenAPI spec from Backend repo
  2. Validate mock JSON files against spec using Zod schemas derived from spec
  3. If validation fails → CI fails → block merge
  4. At app startup in dev/staging: same validation runs → fail to start if mismatch
```

### Infrastructure & Deployment

**Development Environment:**

```yaml
# docker-compose.yml (stateful services only)
services:
  postgres:
    image: postgres:16
    ports: 5432:5432
    environment:
      POSTGRES_DB: cskh_dev
      POSTGRES_USER: cskh
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --appendfsync everysec
    ports: 6379:6379
    volumes:
      - redisdata:/data
```

- App runs natively: `bun run start:dev` (fastest hot-reload on Windows)
- PostgreSQL + Redis in Docker Compose (consistent across team)

**Redis Configuration (Critical for NFR-R4):**

```
appendonly yes          # AOF persistence — session survive restart
appendfsync everysec    # Balance between durability and performance
maxmemory-policy allkeys-lru  # Evict least-recently-used when memory full
```

### Decision Impact Analysis

**Implementation Sequence:**

```
1. Docker Compose (PostgreSQL + Redis)           ← Foundation
2. Auth Module (better-auth + jose)              ← Blocks everything else
3. BackendClient service (fetch + opossum)       ← Blocks all Backend calls
4. Endpoint Config Module (chokidar hot-reload)  ← Enables mock/live switching
5. Mock Data System (JSON files + Zod gates)     ← Enables testing without Backend
6. Ticket Module (Drizzle schema + CQRS)         ← Core domain model
7. Session Store Module (Redis Hash + Sorted Set)← Context Preservation (K1)
8. Hexagonal Adapter Layer (abstract + Zalo + Hotline) ← Multi-channel
9. Notification Dispatcher (channel-aware + rate limiting) ← Closes the loop
10. Contract Validation Gate (CI/CD + startup)   ← Quality assurance
```

**Cross-Component Dependencies:**

| Dependency | From → To | Reason |
|-----------|----------|--------|
| Auth → BackendClient | Auth issues JWT that BackendClient injects | Every Backend call needs identity |
| BackendClient → Config Module | BackendClient reads endpoint configs | Mock/live switching |
| BackendClient → opossum | Every call wrapped in Circuit Breaker | Resilience boundary |
| Session Store → Auth | Session keyed by UserID from Auth | Context Preservation |
| Adapters → Session Store | Adapters write events to session | Cross-channel context |
| Adapters → CQRS Bus | Adapters dispatch commands to Orchestrator Core | Request routing |
| Ticket Module → BackendClient | Ticket creation forwards to Backend | Orchestrator → Backend coordination |
| Notification Dispatcher → Adapters | Dispatcher sends via channel adapters | Close the loop with KH |

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

**12 areas** where AI agents could make different choices — all resolved below.

### Naming Patterns

**Database Naming (Drizzle ORM):**

| Element | Convention | Example | Source |
|---------|-----------|---------|--------|
| Table name | snake_case, **plural** | `orders`, `tickets`, `sessions` | Existing: `ordersTable` |
| Column name | snake_case | `customer_id`, `created_at` | Existing: `customerId → 'customer_id'` |
| Table variable | camelCase + `Table` suffix | `ordersTable`, `ticketsTable` | Existing pattern |
| Type name | PascalCase + `Record` suffix | `OrderRecord`, `TicketRecord` | Existing pattern |
| Insert type | `Insert` + PascalCase + `Record` | `InsertOrderRecord` | Existing pattern |

**Redis Key Naming:**

| Pattern | Convention | Example |
|---------|-----------|---------|
| Session data | `session:{userId}` | `session:USR-12345` |
| Session events | `session:{userId}:events` | `session:USR-12345:events` |
| API cache | `cache:{endpoint}:{key}` | `cache:customers:0981234567` |
| Circuit Breaker state | `cb:{endpoint}` | `cb:customer360` |
| Config hash | `config:endpoints` | `config:endpoints` |

**API Naming:**

| Element | Convention | Example | Source |
|---------|-----------|---------|--------|
| Controller route | plural, kebab-case | `@Controller('tickets')` | Existing: `@Controller('orders')` |
| Path params | camelCase | `@Param('id')` | Existing pattern |
| Query params | camelCase | `@Query('customerId')` | Existing: `@Query('customerId')` |
| Headers | kebab-case | `x-correlation-id` | Existing: `CORRELATION_ID_HEADER` |

**Code Naming:**

| Element | Convention | Example | Source |
|---------|-----------|---------|--------|
| Files | kebab-case + dot-separated suffix | `place-order.command.ts` | Existing |
| Classes | PascalCase | `PlaceOrderCommand`, `ZaloAdapter` | Existing |
| Interfaces (contracts) | `I` prefix + PascalCase | `ICommandBus`, `IInputAdapter` | Existing |
| Interfaces (data) | PascalCase, no prefix | `OrderPlacedPayload` | Existing |
| Constants / DI tokens | UPPER_SNAKE_CASE + `_TOKEN` | `ORDER_REPOSITORY_TOKEN` | Existing |
| Variables | camelCase | `orderId`, `sessionId` | Existing |
| Methods | camelCase, verb-first | `placeOrder()`, `getTicket()` | Existing |

**CSKH-Specific Class Naming:**

| Type | Pattern | Example |
|------|---------|---------|
| Input Adapter | `{Channel}Adapter` | `ZaloAdapter`, `HotlineAdapter` |
| Adapter Interface | `IInputAdapter` | — |
| Session Event | `{Action}Event` (past tense) | `ZaloMessageReceived`, `TicketCreated` |
| Mock file | `{endpoint}.json` | `customer360.json`, `ticket-status.json` |
| Backend endpoint config key | camelCase | `customer360`, `ticketCrud`, `gisIncidents` |

### Structure Patterns

**Project Organization (extend existing pattern):**

```
src/
├── libs/
│   ├── core/                          # Existing — DDD primitives
│   └── shared/                        # Existing — shared infrastructure
│       ├── caching/                   # Existing — Redis + Memory cache
│       ├── context/                   # Existing — Correlation ID
│       ├── cqrs/                      # Existing — CQRS buses
│       ├── database/                  # Existing — Drizzle
│       └── ...                        # ADD new shared modules here
│
├── modules/
│   ├── order/                         # Existing — reference implementation
│   ├── product/                       # Existing — reference implementation
│   │
│   ├── auth/                          # NEW — Auth module
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── constants/
│   │
│   ├── ticket/                        # NEW — Ticket lifecycle
│   │   ├── domain/                    #   entities, events, repositories
│   │   ├── application/               #   commands, queries, dtos
│   │   ├── infrastructure/            #   http, persistence, projections
│   │   └── constants/
│   │
│   ├── session/                       # NEW — Context Preservation
│   │   ├── domain/                    #   event types, session aggregate
│   │   ├── application/               #   commands, queries
│   │   ├── infrastructure/            #   redis store, event persistence
│   │   └── constants/
│   │
│   ├── notification/                   # NEW — FR31-FR33, FR43: Notification funnel + rate limiter
│   │   ├── domain/
│   │   │   └── value-objects/
│   │   │       └── notification-channel.ts       # Channel type enum
│   │   ├── application/
│   │   │   ├── commands/
│   │   │   │   └── dispatch-notification.command.ts
│   │   │   └── handlers/
│   │   │       └── dispatch-notification.handler.ts  # Rate check → send → log
│   │   ├── infrastructure/
│   │   │   └── rate-limiter/
│   │   │       └── redis-rate-limiter.service.ts     # 2 msg/KH/ticket/day (FR43)
│   │   └── notification.module.ts
│   │
│   └── adapters/                      # NEW — Hexagonal adapter layer
│       ├── core/                      #   IInputAdapter interface, base classes
│       ├── zalo/                      #   Zalo OA adapter module
│       └── hotline/                   #   Hotline adapter module
│
├── config/                            # NEW — Endpoint configs
│   └── api-endpoints.yaml             #   Mock/live switching
│
├── mocks/                             # NEW — Mock data files
│   ├── customer360.json
│   ├── create-ticket.json
│   ├── ticket-status.json
│   ├── gis-incidents.json
│   └── notifications.json
│
└── app.module.ts
```

**Module Internal Structure (follow existing pattern):**

Every new module MUST follow the established DDD/CQRS structure:
```
{module}/
├── domain/
│   ├── entities/          # Aggregate roots, child entities
│   ├── events/            # Domain events ({Entity}{Action}Event)
│   ├── repositories/      # Repository interfaces
│   ├── services/          # Domain services
│   ├── value-objects/     # Value objects
│   └── index.ts           # Barrel export
├── application/
│   ├── commands/
│   │   ├── handlers/      # Command handlers ({CommandName}Handler)
│   │   ├── {action}-{entity}.command.ts
│   │   └── index.ts
│   ├── queries/
│   │   ├── handlers/      # Query handlers
│   │   ├── ports/         # Read DAO interfaces
│   │   └── index.ts
│   ├── dtos/              # Request/Response DTOs
│   └── index.ts
├── infrastructure/
│   ├── http/              # Controllers
│   ├── persistence/       # Drizzle schema, read DAO, write repo
│   │   ├── drizzle/schema/
│   │   ├── read/
│   │   └── write/
│   └── projections/       # Event handlers → read model updates
├── constants/
│   └── tokens.ts          # DI tokens ({MODULE}_{TYPE}_TOKEN)
└── {module}.module.ts     # NestJS module
```

**File Naming Rules:**

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
| Mock data | `{endpoint}.json` | `customer360.json` |
| Spec (test) | `{file}.spec.ts` (co-located) | `ticket.entity.spec.ts` |

### Format Patterns

**API Response Format:**

Follow existing convention — **direct return, no wrapper:**

```typescript
// ✅ CORRECT (existing pattern)
@Get(':id')
async getTicket(@Param('id') id: string): Promise<TicketReadModel | null> {
  return this.queryBus.execute(new GetTicketQuery(id));
}

// ❌ WRONG — do NOT introduce response wrappers
async getTicket(): Promise<{ data: TicketReadModel; success: boolean }> { ... }
```

**Error Response Format:**

Use existing exception hierarchy:

```typescript
// ✅ CORRECT — use existing custom exceptions
throw new NotFoundException('Ticket not found');
throw new ForbiddenException('Insufficient permissions');
throw new BusinessRuleException('Cannot cancel a resolved ticket');

// ❌ WRONG — do NOT throw generic HttpException
throw new HttpException('Error', 400);
```

**Date/Time Format:**

- All dates in JSON: **ISO 8601 strings** (`2026-06-03T14:30:00.000Z`)
- All timestamps in DB: `timestamp` type (Drizzle) — PostgreSQL handles serialization
- TTL values: **seconds** (Redis convention)

**JSON Field Naming:**

| Context | Convention | Example |
|---------|-----------|---------|
| API request/response body | camelCase | `{ "customerId": "USR-12345" }` |
| Database columns | snake_case | `customer_id` |
| Redis JSON values | camelCase | `{ "type": "zalo_message" }` |
| Config YAML | camelCase | `current: mock` |
| Domain events | camelCase | `{ "ticketId": "TK-001" }` |

**Correlation ID Format:**

- Header: `x-correlation-id` (lowercase, kebab-case)
- Value: UUID v4 (generated by `CorrelationIdMiddleware`)
- Propagated to Backend via `x-correlation-id` header on every `BackendClient` call
- Included in every Pino log entry

### Communication Patterns

**Domain Event Naming:**

| Pattern | Convention | Example |
|---------|-----------|---------|
| Event class | `{Entity}{Action}Event` | `TicketCreatedEvent` |
| Event type string | `{Entity}{Action}` | `TicketCreated` |
| Aggregate type | PascalCase singular | `Ticket` |
| File name | `{entity}-{action}.event.ts` | `ticket-created.event.ts` |

**Session Event Types:**

| Event Type | When | Payload |
|-----------|------|---------|
| `zalo_message_received` | KH sends Zalo message | `{ messageId, content, timestamp }` |
| `call_started` | Hotline call begins | `{ callId, phoneNumber, timestamp }` |
| `call_completed` | Hotline call ends | `{ callId, duration, outcome }` |
| `ticket_created` | Ticket created in system | `{ ticketId, type, channel }` |
| `ticket_status_changed` | Ticket status update | `{ ticketId, oldStatus, newStatus, actor }` |
| `notification_sent` | Notification dispatched | `{ channel, ticketId, timestamp }` |

**Command/Query Naming (CQRS):**

| Type | Pattern | Example |
|------|---------|---------|
| Command | `{Action}{Entity}Command` | `CreateTicketCommand`, `UpdateTicketStatusCommand` |
| Query | `Get{Entity}Query` / `Get{Entity}ListQuery` | `GetTicketQuery`, `GetTicketListQuery` |
| Command Handler | `{CommandName}Handler` | `CreateTicketHandler` |
| Query Handler | `{QueryName}Handler` | `GetTicketHandler` |
| DI Token | `{MODULE}_{TYPE}_TOKEN` | `TICKET_REPOSITORY_TOKEN` |

### Process Patterns

**Error Handling Chain (Orchestrator → Backend):**

```
BackendClient.call(endpoint, payload)
  ├── Success (2xx) → return data + cache if applicable
  ├── 401 Unauthorized → auto-refresh token → retry once → if fail: log + throw
  ├── 403 Forbidden → throw ForbiddenException (do NOT retry)
  ├── 404 Not Found → throw NotFoundException + admin alert
  ├── 4xx Client Error → throw ValidationException
  ├── 5xx / Timeout → Circuit Breaker counts failure → fallback to cache
  └── Circuit Breaker OPEN → return cached data + log warning
```

**Idempotency — Two Boundaries:**

_Inbound Idempotency (Adapter → Orchestrator):_
Every `NormalizedRequest` MUST carry an `idempotencyKey` (e.g., hash of Zalo `messageId` or Hotline `callId`). Before processing, check Redis `idempotency:{key}` (TTL 24h). If key exists → return cached result immediately. If not → process and store result under that key.

```
Adapter receives webhook → extract messageId → hash → idempotencyKey
  → Redis GET idempotency:{hash}
  → If exists → return cached response (200 OK) — do NOT reprocess
  → If not → process normally → Redis SET idempotency:{hash} = result, TTL 24h
```

_Outbound Idempotency (Orchestrator → Backend):_
Every `BackendClient` POST/PUT call MUST include header `x-idempotency-key` (correlation ID + endpoint hash). Backend (Thương) is required to use this key to prevent duplicate resource creation.

```typescript
// BackendClient automatically injects idempotency header on mutating calls
headers: {
  'Authorization': `Bearer ${token}`,
  'x-correlation-id': correlationId,
  'x-idempotency-key': `${correlationId}:${endpointHash}`,
}
```

**Cache Fallback Pattern:**

```typescript
// ✅ CORRECT pattern for every BackendClient call
async getCustomerProfile(phone: string): Promise<CustomerProfile> {
  return this.resilienceService.execute('customer360', async () => {
    return this.backendClient.get(`/customers/${phone}`);
  }, {
    fallback: async () => this.cacheService.get(`cache:customers:${phone}`),
    ttl: 15 * 60, // 15 minutes for dynamic data
  });
}
```

**Adapter Request Normalization:**

Every input adapter MUST normalize to a standard request before dispatching to the CQRS bus:

```typescript
interface NormalizedRequest {
  userId: string;          // From Auth Layer
  channel: ChannelType;    // 'zalo' | 'hotline' | 'counter' | 'web'
  intent: IntentType;      // 'report_incident' | 'inquiry' | 'complaint' | ...
  payload: Record<string, unknown>;
  sessionId: string;       // For Context Preservation
  correlationId: string;   // For distributed tracing
  idempotencyKey: string;  // Hash of messageId/callId — dedup inbound webhooks
}
```

### Enforcement Guidelines

**All AI Agents MUST:**

1. **Follow existing naming conventions** — kebab-case files, PascalCase classes, snake_case DB columns, camelCase API fields. No exceptions.
2. **Use the DDD/CQRS module structure** — domain/application/infrastructure layers. No flat module structures.
3. **Use existing exception classes** — `NotFoundException`, `ForbiddenException`, `BusinessRuleException`. No `new Error()` or `new HttpException()` for business logic.
4. **Inject via DI tokens** — `{MODULE}_{TYPE}_TOKEN` pattern. No direct class injection for cross-module dependencies.
5. **Include correlation ID** in every log entry and every outbound Backend call.
6. **Wrap every Backend call** in `BackendClient` + opossum Circuit Breaker. No bare `fetch` to Backend.
7. **Write session events** for every KH interaction. No interaction goes unrecorded.
8. **Co-locate tests** as `*.spec.ts` next to the file under test.

**Anti-Patterns (NEVER do these):**

| Anti-Pattern | Why | Do This Instead |
|-------------|-----|-----------------|
| `fetch()` directly to Backend | Bypasses Circuit Breaker, JWT injection, logging | Use `BackendClient` service |
| Business logic in Controllers | Violates CQRS separation | Controller → CommandBus → Handler → Domain |
| Hardcoded endpoint URLs | Breaks mock/live switching | Read from Endpoint Config Module |
| `any` type for API responses | Loses type safety, breaks schema validation | Define Zod schemas + TypeScript types |
| Storing PII in logs | Violates NFR-S9 + Nghị định 13 | Mask via Pino serializer |
| Creating new module without CQRS | Breaks consistency with existing modules | Follow domain/application/infrastructure layers |
| Singleton Circuit Breaker for all endpoints | One endpoint's failure blocks others | Per-endpoint opossum instances |

## Project Structure & Boundaries

### Complete Project Directory Structure

```
IOC_Customer/
│
├── .github/
│   └── workflows/
│       └── ci.yml                        # Contract validation gate (NFR-I1)
│
├── config/
│   ├── api-endpoints.yaml                # Mock/live switching config (D4)
│   └── api-endpoints.schema.ts           # Zod schema for config validation
│
├── mocks/
│   ├── customer360.json                  # GET /customers/{phone} mock
│   ├── create-ticket.json                # POST /tickets mock
│   ├── ticket-status.json                # GET /tickets/{id} mock
│   ├── gis-incidents.json                # GET /gis/incidents?area={code} mock
│   └── notifications.json                # POST /notifications mock
│
├── drizzle/                              # Drizzle Kit migrations
│   └── migrations/
│
├── scripts/
│   └── build-binary.sh                   # Existing
│
├── test/
│   ├── jest-e2e.json                     # Existing — E2E test config
│   ├── mocks/                            # NEW — Test mock helpers
│   │   ├── mock-backend-server.ts        #   HTTP server simulating Backend API
│   │   └── mock-zalo-webhook.ts          #   Zalo webhook simulator
│   └── integration/
│       ├── context-preservation.spec.ts   #   K1: Cross-channel context test
│       ├── circuit-breaker.spec.ts        #   K5: Resilience test
│       └── mock-live-switch.spec.ts       #   K6: Zero-downtime switch test
│
├── docker-compose.yml                    # PostgreSQL 16 + Redis 7 (AOF)
├── docker-compose.test.yml               # Test environment with mock backend
│
├── src/
│   ├── main.ts                           # Existing — Bootstrap
│   ├── app.module.ts                     # Updated — Import all CSKH modules
│   │
│   ├── libs/
│   │   ├── core/                         # EXISTING — DDD primitives (unchanged)
│   │   │   ├── application/              #   Command/Query/Event interfaces
│   │   │   ├── common/                   #   Exceptions, context
│   │   │   ├── constants/                #   DI tokens
│   │   │   ├── domain/                   #   Entities, VOs, specs, repos, services
│   │   │   └── infrastructure/           #   Caching, events, outbox, persistence
│   │   │
│   │   └── shared/                       # EXISTING + EXTENDED
│   │       ├── caching/                  #   Existing — Redis + Memory cache
│   │       ├── context/                  #   Existing — Correlation ID middleware
│   │       ├── cqrs/                     #   Existing — CQRS buses + idempotency
│   │       ├── database/                 #   Existing — Drizzle DB + UoW
│   │       ├── logging/                  #   Existing — Pino module
│   │       ├── health/                   #   Existing — Health check endpoints
│   │       ├── outbox/                   #   Existing — Transactional outbox
│   │       │
│   │       ├── resilience/               # NEW — Shared resilience infrastructure
│   │       │   ├── circuit-breaker.service.ts      # opossum wrapper per-endpoint
│   │       │   ├── backend-client.service.ts       # fetch + CB + JWT + timeout
│   │       │   ├── backend-client.interface.ts     # IBackendClient contract
│   │       │   ├── resilience.module.ts            # NestJS module
│   │       │   └── index.ts
│   │       │
│   │       ├── endpoint-config/           # NEW — Mock/Live config hot-reload
│   │       │   ├── endpoint-config.service.ts      # chokidar file watch + reload
│   │       │   ├── endpoint-config.interface.ts    # IEndpointConfig contract
│   │       │   ├── endpoint-config.module.ts
│   │       │   └── index.ts
│   │       │
│   │       ├── auth-propagation/          # NEW — JWT signing & propagation
│   │       │   ├── jwt-signer.service.ts            # jose JWT issue
│   │       │   ├── auth-propagation.middleware.ts   # Inject JWT on outbound
│   │       │   ├── auth-propagation.module.ts
│   │       │   └── index.ts
│   │       │
│   │       └── index.ts                  # Barrel export for all shared
│   │
│   └── modules/
│       ├── order/                         # EXISTING — Reference (unchanged)
│       ├── product/                       # EXISTING — Reference (unchanged)
│       │
│       ├── auth/                          # NEW — M1: Auth Layer (better-auth)
│       │   ├── domain/
│       │   │   ├── entities/
│       │   │   │   ├── user.entity.ts
│       │   │   │   └── index.ts
│       │   │   ├── value-objects/
│       │   │   │   ├── user-role.value-object.ts
│       │   │   │   └── index.ts
│       │   │   └── index.ts
│       │   ├── application/
│       │   │   ├── commands/
│       │   │   │   ├── login.command.ts
│       │   │   │   ├── register-user.command.ts
│       │   │   │   ├── link-provider.command.ts
│       │   │   │   ├── handlers/
│       │   │   │   │   ├── login.handler.ts
│       │   │   │   │   ├── register-user.handler.ts
│       │   │   │   │   └── link-provider.handler.ts
│       │   │   │   └── index.ts
│       │   │   ├── queries/
│       │   │   │   ├── get-user-by-phone.query.ts
│       │   │   │   ├── get-user-by-provider.query.ts
│       │   │   │   ├── handlers/
│       │   │   │   └── index.ts
│       │   │   ├── dtos/
│       │   │   │   ├── login.dto.ts
│       │   │   │   └── register-user.dto.ts
│       │   │   └── index.ts
│       │   ├── infrastructure/
│       │   │   ├── http/
│       │   │   │   └── auth.controller.ts
│       │   │   ├── persistence/
│       │   │   │   ├── drizzle/schema/
│       │   │   │   │   └── user.schema.ts
│       │   │   │   ├── write/
│       │   │   │   │   └── user.repository.ts
│       │   │   │   └── read/
│       │   │   │       └── user-read-dao.ts
│       │   │   └── better-auth/
│       │   │       └── better-auth.setup.ts         # better-auth config
│       │   ├── constants/
│       │   │   └── tokens.ts
│       │   └── auth.module.ts
│       │
│       ├── ticket/                        # NEW — M4: Ticket Lifecycle (FR19-FR22)
│       │   ├── domain/
│       │   │   ├── entities/
│       │   │   │   ├── ticket.entity.ts             # Aggregate Root
│       │   │   │   └── index.ts
│       │   │   ├── events/
│       │   │   │   ├── ticket-created.event.ts
│       │   │   │   ├── ticket-status-changed.event.ts
│       │   │   │   └── index.ts
│       │   │   ├── repositories/
│       │   │   │   ├── ticket.repository.interface.ts
│       │   │   │   └── index.ts
│       │   │   ├── value-objects/
│       │   │   │   ├── ticket-type.value-object.ts
│       │   │   │   ├── ticket-status.value-object.ts
│       │   │   │   └── index.ts
│       │   │   └── index.ts
│       │   ├── application/
│       │   │   ├── commands/
│       │   │   │   ├── create-ticket.command.ts
│       │   │   │   ├── update-ticket-status.command.ts
│       │   │   │   ├── handlers/
│       │   │   │   │   ├── create-ticket.handler.ts
│       │   │   │   │   └── update-ticket-status.handler.ts
│       │   │   │   └── index.ts
│       │   │   ├── queries/
│       │   │   │   ├── get-ticket.query.ts
│       │   │   │   ├── get-ticket-list.query.ts
│       │   │   │   ├── handlers/
│       │   │   │   ├── ports/
│       │   │   │   └── index.ts
│       │   │   ├── dtos/
│       │   │   │   ├── create-ticket.dto.ts
│       │   │   │   └── update-ticket-status.dto.ts
│       │   │   └── index.ts
│       │   ├── infrastructure/
│       │   │   ├── http/
│       │   │   │   ├── ticket.controller.ts
│       │   │   │   └── webhook.controller.ts        # Backend → CSKH webhook
│       │   │   ├── persistence/
│       │   │   │   ├── drizzle/schema/
│       │   │   │   │   └── ticket.schema.ts
│       │   │   │   ├── write/
│       │   │   │   │   └── ticket.repository.ts
│       │   │   │   └── read/
│       │   │   │       └── ticket-read-dao.ts
│       │   │   └── projections/
│       │   │       └── ticket-read-model.projection.ts
│       │   ├── constants/
│       │   │   └── tokens.ts
│       │   └── ticket.module.ts
│       │
│       ├── session/                       # NEW — M5: Context Preservation (FR23-FR26)
│       │   ├── domain/
│       │   │   ├── entities/
│       │   │   │   ├── session.entity.ts             # Aggregate Root
│       │   │   │   └── index.ts
│       │   │   ├── events/
│       │   │   │   ├── session-event.types.ts        # Event type definitions
│       │   │   │   └── index.ts
│       │   │   ├── repositories/
│       │   │   │   ├── session.repository.interface.ts
│       │   │   │   └── index.ts
│       │   │   └── index.ts
│       │   ├── application/
│       │   │   ├── commands/
│       │   │   │   ├── record-session-event.command.ts
│       │   │   │   ├── close-session.command.ts
│       │   │   │   ├── handlers/
│       │   │   │   │   ├── record-session-event.handler.ts
│       │   │   │   │   └── close-session.handler.ts
│       │   │   │   └── index.ts
│       │   │   ├── queries/
│       │   │   │   ├── get-session.query.ts
│       │   │   │   ├── get-session-events.query.ts
│       │   │   │   ├── handlers/
│       │   │   │   └── index.ts
│       │   │   └── index.ts
│       │   ├── infrastructure/
│       │   │   ├── redis/
│       │   │   │   ├── redis-session.repository.ts   # Hash + Sorted Set impl
│       │   │   │   └── redis-session.module.ts
│       │   │   └── index.ts
│       │   ├── constants/
│       │   │   └── tokens.ts
│       │   └── session.module.ts
│       │
│       └── adapters/                      # NEW — M2+M3: Hexagonal Input Adapters
│           ├── core/
│           │   ├── input-adapter.interface.ts         # IInputAdapter contract
│           │   ├── base-adapter.ts                    # Shared adapter logic
│           │   ├── normalized-request.interface.ts    # NormalizedRequest type
│           │   ├── idempotency.service.ts             # Inbound dedup (Redis 24h TTL)
│           │   └── adapters.module.ts                 # Shared adapter infrastructure
│           │
│           ├── zalo/                      # M3: Zalo OA Adapter (FR10)
│           │   ├── zalo-adapter.service.ts
│           │   ├── zalo-webhook.controller.ts
│           │   ├── zalo-signature.guard.ts            # HMAC SHA-256 verification
│           │   ├── zalo-intent.resolver.ts            # Intent recognition
│           │   ├── zalo-dto/
│           │   │   ├── zalo-message.dto.ts
│           │   │   └── zalo-response.dto.ts
│           │   ├── zalo.module.ts
│           │   └── zalo-adapter.spec.ts
│           │
│           └── hotline/                   # M2: Hotline Adapter (FR9)
│               ├── hotline-adapter.service.ts
│               ├── hotline-webhook.controller.ts
│               ├── hotline-dto/
│               │   └── hotline-call.dto.ts
│               ├── hotline.module.ts
│               └── hotline-adapter.spec.ts
│
│       ├── notification/                  # NEW — FR31-FR33, FR43: Notification funnel
│       │   ├── domain/
│       │   │   └── value-objects/
│       │   │       └── notification-channel.ts       # 'zalo' | 'sms' | 'email'
│       │   ├── application/
│       │   │   ├── commands/
│       │   │   │   └── dispatch-notification.command.ts
│       │   │   ├── handlers/
│       │   │   │   └── dispatch-notification.handler.ts
│       │   │   └── dtos/
│       │   │       └── dispatch-notification.dto.ts
│       │   ├── infrastructure/
│       │   │   ├── rate-limiter/
│       │   │   │   └── redis-rate-limiter.service.ts # 2 msg/KH/ticket/day (FR43)
│       │   │   └── dispatchers/
│       │   │       └── channel-dispatcher.interface.ts # Per-channel dispatch
│       │   ├── constants/
│       │   │   └── tokens.ts
│       │   └── notification.module.ts
│
├── package.json
├── tsconfig.json
├── nest-cli.json
├── drizzle.config.ts
├── .env.example                          # Template with all required env vars
└── README.md
```

### Architectural Boundaries

**API Boundaries:**

| Boundary | Direction | Protocol | Auth Required |
|----------|-----------|----------|---------------|
| Zalo → Zalo Webhook Controller | Inbound | HTTPS POST (Zalo OA API) | Zalo HMAC SHA-256 signature (`ZaloSignatureGuard`) |
| Hotline → Hotline Webhook Controller | Inbound | HTTPS POST / SIP | API key (`INTER_SERVICE_API_KEY` env var) |
| Backend → Webhook Controller | Inbound | HTTPS POST | Static inter-service API key (`INTER_SERVICE_API_KEY` env var) |
| Auth Controller → Public | Inbound | HTTPS | None (login/register) |
| Ticket Controller → Authenticated | Inbound | HTTPS | JWT (better-auth) |
| Orchestrator → Backend API (Thương) | Outbound | HTTPS + JWT | JWT signed by Orchestrator (jose) |
| Orchestrator → Zalo OA API | Outbound | HTTPS + OAuth | Zalo access token |

**Inbound Webhook Security Contracts:**

| Source | Guard | Implementation |
|--------|-------|---------------|
| **Zalo** | `ZaloSignatureGuard` | Compute HMAC SHA-256 of raw request body using `ZALOA_SECRET_KEY` env var. Compare with `X-ZECA-Signature` header. Reject 401 if mismatch. |
| **Backend (Thương)** | `InterServiceApiKeyGuard` | Validate `x-api-key` header matches `INTER_SERVICE_API_KEY` env var. Do NOT use JWT for inter-service webhooks — JWT is for end-user auth with short TTL. Use static shared secret instead. |
| **Hotline** | `InterServiceApiKeyGuard` | Same static API key pattern as Backend webhooks. |

**Rule:** Every inbound webhook endpoint MUST use the appropriate guard. No unauthenticated webhook endpoints allowed.

**Component Boundaries:**

```
┌─────────────────────────────────────────────────────────────────┐
│                        NESTJS APPLICATION                       │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Zalo Adapter  │  │Hotline Adptr │  │ Future: Counter/Web  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └────────┬────────┘                      │              │
│                  ▼                               │              │
│  ┌───────────────────────────────────────────────┴──────────┐  │
│  │              Auth Layer (better-auth + jose)              │  │
│  │         • User/Session DB (PostgreSQL — owned)           │  │
│  │         • RBAC Guards: customer/employee/manager/admin   │  │
│  └───────────────────────────┬──────────────────────────────┘  │
│                              │                                  │
│  ┌───────────────────────────▼──────────────────────────────┐  │
│  │                 CQRS Bus (Command + Query)                │  │
│  │    Existing SharedCqrsModule — unchanged                 │  │
│  └───┬──────────────────────────────────────┬───────────────┘  │
│      │                                      │                  │
│  ┌───▼──────────┐  ┌────────────────┐  ┌───▼──────────────┐  │
│  │ Ticket Module │  │Session Module  │  │ Future modules   │  │
│  │ (PostgreSQL)  │  │(Redis AOF)     │  │                  │  │
│  └───┬──────────┘  └────────────────┘  └──────────────────┘  │
│      │                                                       │
│  ┌───▼──────────────────────────────────────────────────────┐  │
│  │         BackendClient (Resilience Layer)                  │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │  │
│  │  │Endpoint Config│  │Circuit Breaker│  │JWT Propagation │  │  │
│  │  │(chokidar watch)│  │(opossum/ep)   │  │(jose signer)   │  │  │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                             │                                   │
└─────────────────────────────┼───────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │ Mock Files   │ │Backend API   │ │ Zalo OA API  │
     │ (JSON local) │ │ (Thương)     │ │ (External)   │
     └──────────────┘ └──────────────┘ └──────────────┘
```

**Data Boundaries:**

| Data Store | Owner | Data | Access Pattern |
|-----------|-------|------|---------------|
| PostgreSQL | CSKH (owned) | Users, Sessions, Tickets, RBAC | Drizzle ORM + Unit of Work |
| Redis (session namespace) | CSKH (owned) | Active session events, context cache | Hash + Sorted Set per user |
| Redis (cache namespace) | CSKH (owned) | Backend API response cache | Key-value with TTL tiers |
| Backend PostgreSQL | Backend (Thương) | Customer 360°, Billing, GIS, SCADA | HTTP via BackendClient ONLY |

### Requirements to Structure Mapping

**MVP Feature → Module Mapping:**

| MVP Feature | FRs | Module | Key Files |
|------------|-----|--------|-----------|
| M1: Auth Layer | FR1-FR8 | `modules/auth/` | `auth.module.ts`, `better-auth.setup.ts`, `user.entity.ts` |
| M2: Hotline Adapter | FR9, FR13 | `modules/adapters/hotline/` | `hotline-adapter.service.ts`, `hotline-webhook.controller.ts` |
| M3: Zalo Adapter | FR10-FR12 | `modules/adapters/zalo/` | `zalo-adapter.service.ts`, `zalo-webhook.controller.ts`, `zalo-intent.resolver.ts` |
| M4: Orchestrator Core | FR14-FR18 | `modules/ticket/` + `libs/shared/resilience/` | `ticket.module.ts`, `backend-client.service.ts`, `endpoint-config.service.ts` |
| M5: Context Preservation | FR23-FR26 | `modules/session/` | `session.module.ts`, `redis-session.repository.ts`, `session-event.types.ts` |
| M6: Mocking System | FR34-FR36 | `mocks/` + `libs/shared/endpoint-config/` | JSON files + `endpoint-config.service.ts` |
| M7: Circuit Breaker | FR27-FR30 | `libs/shared/resilience/` | `circuit-breaker.service.ts`, `backend-client.service.ts` |

**Cross-Cutting Concern → Location Mapping:**

| Concern | Location | Files |
|---------|----------|-------|
| Identity Propagation (K8) | `libs/shared/auth-propagation/` | `jwt-signer.service.ts`, `auth-propagation.middleware.ts` |
| Correlation ID | `libs/shared/context/` (existing) | `correlation-id.middleware.ts` |
| PII Masking | `libs/shared/logging/` (extend existing) | pino-redact with mandatory paths |
| Audit Logging | `libs/shared/logging/` (extend existing) | Structured log enrichment |
| Contract Validation Gate | `.github/workflows/ci.yml` + startup | Zod schema validation |
| Resilience Boundary | `libs/shared/resilience/` | `circuit-breaker.service.ts`, `backend-client.service.ts` |
| Notification Rate Limiting | `modules/notification/infrastructure/rate-limiter/` | `redis-rate-limiter.service.ts` |
| Inbound Idempotency | `modules/adapters/core/` | `idempotency.service.ts` |
| Webhook Security | `modules/adapters/zalo/` + `modules/ticket/infrastructure/http/` | `zalo-signature.guard.ts`, API key guard |

### Integration Points

**Internal Communication:**

```
Adapter → [NormalizedRequest] → CQRS CommandBus → Handler → Domain → Event
                                                            ↓
                                                     Session Store (Redis)
                                                            ↓
                                                     BackendClient → Backend API
```

**External Integrations:**

| Integration | Trigger | Response | Error Handling |
|------------|---------|----------|---------------|
| Backend Customer 360° | `GET /customers/{phone}` | Customer profile | CB → cache → 404 message |
| Backend Ticket CRUD | `POST /tickets`, `GET /tickets/{id}` | Ticket data | CB → cache → error message |
| Backend GIS/Incidents | `GET /gis/incidents?area={code}` | Incident list | CB → empty list → message |
| Backend Notifications | `POST /notifications` | Confirmation | CB → queue (Phase 2) |
| Zalo OA Incoming | Webhook POST from Zalo | 200 OK | Queue for processing |
| Zalo OA Outgoing | `POST` to Zalo API | Message sent | Retry + rate limit (FR43) |
| Backend → CSKH Webhook | `POST /webhooks/tickets/{id}/status` | 200 OK | Verify JWT + process |

**Data Flow (Cross-Channel Context Preservation):**

```
1. KH sends Zalo message "Nhà tôi mất nước"
   → Zalo Webhook Controller
   → Zalo Adapter normalizes → NormalizedRequest
   → Auth Layer resolves Zalo ID → UserID "USR-12345"
   → RecordSessionEventCommand → Redis: session:USR-12345:events
   → CreateTicketCommand → Ticket Module → BackendClient POST /tickets
   → Zalo Adapter sends response: "Đã ghi nhận sự cố #TK-002"

2. KH calls Hotline 2 hours later
   → Hotline Webhook Controller
   → Hotline Adapter normalizes → NormalizedRequest
   → Auth Layer resolves SĐT → same UserID "USR-12345"
   → GetSessionQuery → Redis: session:USR-12345 (full context)
   → Tổng đài viên sees: Zalo chat + Ticket #TK-002 + GIS result
   → No information repeated
```

### `.env.example` (Required Environment Variables)

```bash
# Database
DATABASE_URL=postgresql://cskh:password@localhost:5432/cskh_dev

# Redis
REDIS_URL=redis://localhost:6379

# Auth (better-auth)
BETTER_AUTH_SECRET=<random-secret>
BETTER_AUTH_URL=http://localhost:3000

# JWT Propagation (shared with Backend)
JWT_SECRET=<shared-secret-with-backend>
JWT_SECRET_OLD=                              # For key rotation

# Zalo OA
ZALOA_ACCESS_TOKEN=<token>
ZALOA_VERIFICATION_TOKEN=<verify-token>
ZALOA_SECRET_KEY=<hmac-secret>              # For ZaloSignatureGuard (webhook verification)

# Hotline Integration
HOTLINE_API_KEY=<api-key>

# Inter-service (Backend Thương → CSKH webhooks)
INTER_SERVICE_API_KEY=<shared-static-key>    # Static API key for inbound webhooks

# Backend API (Thương)
BACKEND_BASE_URL=https://api.ioc.local/v1
BACKEND_TIMEOUT_MS=3000

# Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**

| Check | Result | Notes |
|-------|--------|-------|
| NestJS 11 + Bun runtime | ✅ Compatible | Bun supports NestJS via `bun run start:dev` |
| better-auth + jose | ✅ Compatible | better-auth issues sessions; jose signs custom JWT for Backend propagation — separate concerns |
| opossum + native fetch | ✅ Compatible | opossum wraps any async function, including `fetch` |
| Drizzle ORM + PostgreSQL | ✅ Compatible | Already in production use |
| Redis (session) + Redis (cache) same instance | ✅ Compatible | Key namespace separation: `session:*` vs `cache:*` |
| chokidar + @nestjs/config | ✅ Compatible | chokidar watches file → triggers config reload → NestJS module receives update |
| Hexagonal adapters + CQRS | ✅ Compatible | Adapters normalize → dispatch Command/Query to existing bus — clean boundary |

**Pattern Consistency:**

- ✅ All naming conventions align with existing codebase (verified against `order` and `product` modules)
- ✅ Module structure follows established DDD/CQRS layers
- ✅ Error handling uses existing exception hierarchy
- ✅ Event naming follows `{Entity}{Action}Event` pattern

**Structure Alignment:**

- ✅ New modules (`auth`, `ticket`, `session`, `adapters`) fit existing `src/modules/` convention
- ✅ New shared infrastructure (`resilience`, `endpoint-config`, `auth-propagation`) fits `src/libs/shared/`
- ✅ Mock data external to source (`mocks/` at project root)
- ✅ Config external to source (`config/` at project root)

### Requirements Coverage Validation ✅

**Functional Requirements Coverage (43/43):**

| FR Category | FRs | Module(s) | Status |
|------------|-----|-----------|--------|
| Auth & Identity (FR1-FR8) | 8 FRs | `modules/auth/` + `libs/shared/auth-propagation/` | ✅ Full coverage |
| Multi-Channel Adapters (FR9-FR13) | 5 FRs | `modules/adapters/zalo/` + `modules/adapters/hotline/` + `modules/adapters/core/` | ✅ Full coverage |
| Orchestrator Core (FR14-FR18) | 5 FRs | `modules/ticket/` + `libs/shared/resilience/` + `libs/shared/endpoint-config/` | ✅ Full coverage |
| Ticket Lifecycle (FR19-FR22) | 4 FRs | `modules/ticket/` | ✅ Full coverage |
| Context Preservation (FR23-FR26) | 4 FRs | `modules/session/` | ✅ Full coverage |
| Resilience (FR27-FR30) | 4 FRs | `libs/shared/resilience/` (circuit-breaker + backend-client) | ✅ Full coverage |
| Notification & CSAT (FR31-FR33, FR43) | 4 FRs | `modules/notification/` (rate-limited dispatch funnel) | ✅ Full coverage |
| Mocking System (FR34-FR36) | 3 FRs | `mocks/` + `libs/shared/endpoint-config/` | ✅ Full coverage |
| Identity Propagation (FR37-FR39) | 3 FRs | `libs/shared/auth-propagation/` | ✅ Full coverage |
| Error Handling (FR40-FR42) | 3 FRs | `libs/shared/resilience/backend-client.service.ts` (error chain) | ✅ Full coverage |

**Non-Functional Requirements Coverage (27/27):**

| NFR Dimension | Count | Architectural Support | Status |
|--------------|-------|----------------------|--------|
| Performance (P1-P6) | 6 | BackendClient timeout 3s, chokidar < 100ms, Redis session O(1), Adapter < 200ms | ✅ |
| Security (S1-S9) | 9 | jose JWT, TLS 1.3, AES-256, PII masking, 15-min token TTL, audit logs, RBAC guards | ✅ |
| Reliability (R1-R5) | 5 | opossum CB < 10s, Redis AOF persistence, 0% outage via fallback chain, config rollback | ✅ |
| Scalability (SC1-SC3) | 3 | Horizontal (stateless routing), new adapter = 0 core change, mock→live < 5% delta | ✅ |
| Integration (I1-I4) | 4 | OpenAPI schema gate (CI/CD + startup), Zalo OA compliance, IVR webhook < 500ms | ✅ |

### Implementation Readiness Validation ✅

**Decision Completeness:**

- ✅ All 6 critical decisions documented with library names and rationale
- ✅ All technology versions verified via web search
- ✅ 13 pre-existing decisions documented (not re-decided)
- ✅ 5 decisions explicitly deferred to post-MVP with clear triggers

**Structure Completeness:**

- ✅ Complete directory tree with every file named
- ✅ Every new module follows established internal structure
- ✅ All integration points defined with protocol and auth requirements
- ✅ Component boundary diagram provided
- ✅ Data flow for K1 (Context Preservation) specified step-by-step

**Pattern Completeness:**

- ✅ 12 conflict points identified and resolved
- ✅ Naming conventions: DB, API, Code, Redis, Files — all specified with examples
- ✅ Error handling chain: full decision tree for BackendClient responses
- ✅ Anti-patterns: 7 explicit "never do this" rules
- ✅ NormalizedRequest interface: adapter contract defined

### Gap Analysis Results

**No Critical Gaps Found.**

~~**⚠️ Important Gap: Notification & CSAT Module (FR31-FR33, FR43)**~~ — **RESOLVED.** Added `modules/notification/` with `redis-rate-limiter.service.ts` (max 2 msg/KH/ticket/day per FR43). All notification dispatch now flows through `DispatchNotificationCommand`.

**Minor Gaps (address during implementation):**

| Gap | Impact | When to Address |
|-----|--------|-----------------|
| Zalo intent recognition strategy (FR15: ≥80% accuracy) | Medium | During Zalo Adapter implementation |
| Backend webhook authentication (how Thương signs webhooks) | Low | Before integration testing |
| Docker image for production build | Low | Before deployment |
| Pino PII serializer implementation details | Low | During logging module extension |

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** ✅ READY FOR IMPLEMENTATION

**Confidence Level:** HIGH

**Key Strengths:**
1. **Brownfield leverage** — 60-70% of infrastructure already built and proven (CQRS, Drizzle, Redis, Pino, OpenTelemetry)
2. **Clear boundaries** — Orchestrator owns no business logic; every module has a single responsibility
3. **Resilience-first** — Circuit Breaker + fallback baked into architecture from day one, not bolted on
4. **Contract-driven** — OpenAPI schema gate at CI/CD + startup prevents mock/live drift
5. **Consistent conventions** — All patterns extracted from existing codebase, not imposed from outside

**Areas for Future Enhancement:**
1. Notification Module — centralize when moving to Phase 2 multi-channel notifications
2. BullMQ retry queue — add for Phase 2 full Graceful Degradation
3. Redis pub/sub for config sync — migrate from file watch when scaling horizontally
4. Shadow Mode — add when Backend APIs handling financial data are ready
5. Zalo intent recognition — evaluate NLP library vs keyword-based approach during implementation

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions
- When in doubt, follow existing `order` and `product` module patterns as reference

**First Implementation Priority:**
1. Docker Compose setup (PostgreSQL + Redis)
2. Auth Module (better-auth + jose) — blocks all subsequent work
3. BackendClient + Resilience Layer — blocks all Backend communication
4. Endpoint Config Module (mock/live switching) — enables testing without Backend

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2026-06-03
**Document Location:** `_bmad-output/planning-artifacts/architecture.md`

### Final Architecture Deliverables

**📋 Complete Architecture Document**
- All architectural decisions documented with specific versions
- Implementation patterns ensuring AI agent consistency
- Complete project structure with all files and directories
- Requirements to architecture mapping (43 FRs + 27 NFRs → modules)
- Validation confirming coherence and completeness

**🏗️ Implementation Ready Foundation**
- 6 new architectural decisions made
- 13 pre-existing decisions documented
- 12 conflict points resolved with patterns
- 43 FRs + 27 NFRs fully covered
- 8-10 architectural components specified

**📚 AI Agent Implementation Guide**
- Technology stack with verified versions (NestJS 11, jose, opossum 8.1.3, better-auth ≥ 1.3.8)
- Consistency rules that prevent implementation conflicts
- Project structure with clear boundaries and naming conventions
- Integration patterns and communication standards
- Anti-pattern list: 7 explicit "never do this" rules

### Quality Assurance Checklist

**✅ Architecture Coherence**
- [x] All decisions work together without conflicts
- [x] Technology choices are compatible (verified)
- [x] Patterns support the architectural decisions
- [x] Structure aligns with all choices

**✅ Requirements Coverage**
- [x] All 43 functional requirements are supported
- [x] All 27 non-functional requirements are addressed
- [x] 5 cross-cutting concerns are handled
- [x] 9 integration points are defined

**✅ Implementation Readiness**
- [x] Decisions are specific and actionable
- [x] Patterns prevent agent conflicts
- [x] Structure is complete and unambiguous
- [x] Examples are provided for clarity

---

**Architecture Status:** READY FOR IMPLEMENTATION ✅

**Next Phase:** Begin implementation using the architectural decisions and patterns documented herein.

**Document Maintenance:** Update this architecture when major technical decisions are made during implementation.
