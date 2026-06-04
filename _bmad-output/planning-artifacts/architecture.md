---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-06-04'
inputDocuments:
  - product-brief-IOC-Customer-2026-06-02.md
  - prd.md (v4.0 — 30 downstream services)
  - docs/Mota_Tinh_Nang_KinhDoanh_KhachHang (AutoRecovered).docx
workflowType: 'architecture'
project_name: 'nestjs-project-example'
user_name: 'Pc'
date: '2026-06-04'
projectClassification:
  type: 'BFF / API Gateway & Orchestrator Platform'
  domain: 'Utility'
  subDomain: 'Govtech'
  complexity: 'High'
  complexityFocus: 'Port Orchestration, Resilience & Aggregation (NOT business logic)'
---

# Architecture Decision Document

_Updated for PRD v4.0 — 30 downstream services, 30 Port Interfaces, 24 mock adapters._

## Project Positioning Summary

> **Core Insight:** This project is a **BFF (Backend For Frontend) / API Gateway** — a Coordination & Resilience Layer. The architectural complexity lives in orchestrating 30 downstream services via Hexagonal Ports, circuit breaking, context preservation, and mock→live migration — not in domain business rules.

| Criterion | Refined Value | Rationale |
|-----------|--------------|-----------|
| **Project Type** | BFF / API Gateway & Orchestrator Platform | Stateful sessions (Redis), smart routing, centralized Auth, multi-channel integration orchestration. Does NOT own business logic. |
| **Domain** | Utility (Sub: Govtech) | Direct interaction with physical infrastructure (SCADA, GIS, water meters) under strict government regulation for essential public services. |
| **Complexity** | **High** — Port Orchestration & Resilience focus | Key risks: (1) Chain failure from 30 downstream APIs, (2) Multi-channel context preservation, (3) Zero-downtime Mock→Live migration across 24 services |
| **Scale** | **30 Port Interfaces** → 14 MVP + 12 Phase 2 + 4 Phase 3 | Each port = interface + mock adapter + internal adapter + per-port circuit breaker + per-port cache tier |

### Risk Assessment

| Risk Area | Reason | Level |
|-----------|--------|-------|
| **Port Registry Complexity** | Managing 30 port adapters, each with mock/live switching, CB, cache | 🔴 High |
| Integration Testing | Dependencies on 30 Backend APIs without control | 🔴 High |
| Concurrent Channel Testing | Context Preservation requires simultaneous Zalo + Hotline testing | 🔴 High |
| Resilience Testing | Circuit Breaker × 30 ports, cache fallback, queue handling | 🔴 High |
| Migration Testing | Mock→Live config switching × 24 services, zero-downtime, schema accuracy | 🟡 Medium-High |
| Aggregation Performance | Fan-out calls across 5-6 ports for dashboard/home screen | 🟡 Medium |

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements (72 total across 16 categories):**

| Category | Count | Architectural Impact |
|----------|-------|---------------------|
| Customer Auth & Identity (S1) | 5 FRs | Auth module, better-auth, JWT lifecycle, multi-provider linking |
| Customer Profile 360° (S2) | 4 FRs | `ICustomerProfilePort`, timeline aggregation |
| Hexagonal Adapter Layer | 6 FRs | Port Registry, 30 Port Interfaces, mock/live switching |
| Contract Management (S4) | 4 FRs | `IContractPort`, eContract integration |
| Meter & Consumption (S5, S6) | 6 FRs | `IMeterPort`, `IMeterReadingPort`, chart data aggregation |
| Tariff Display (S9) | 3 FRs | `ITariffPort`, bậc thang price breakdown |
| Invoice & E-Invoice (S10) | 4 FRs | `IInvoicePort`, PDF download, HĐĐT compliance |
| Payment (S12) | 6 FRs | `IPaymentPort`, webhook, QR generation, **NO CACHE** |
| Debt Management (S13) | 2 FRs | `IDebtPort`, aging display |
| Ticketing & SLA (S16) | 6 FRs | `ITicketPort`, webhook, tracking timeline |
| Knowledge Base (S18) | 3 FRs | `IKnowledgeBasePort`, Vietnamese search |
| Proactive Communication (S22) | 4 FRs | `IProactiveNotificationPort`, GIS area-based alerts |
| Notification (S32) | 4 FRs | `INotificationPort`, multi-channel dispatch, rate limiting |
| Document Upload (S34) | 3 FRs | `IDocumentPort`, presigned URL, S3-compatible |
| Context Preservation | 4 FRs | Redis session store + Event Sourcing |
| Resilience & Degradation | 4 FRs | Per-port Circuit Breaker, tiered cache |
| Idempotency | 2 FRs | Inbound + Outbound idempotency |
| Webhook Security | 2 FRs | HMAC (Zalo) + API key (internal) |

**Non-Functional Requirements (28 total across 6 dimensions):**

| Dimension | Count | Key Driver |
|-----------|-------|-----------|
| Performance (NFR-P1 to P6) | 6 | Adapter < 200ms, Auth < 500ms, Backend timeout 3s, 500 concurrent sessions, Aggregation < 500ms |
| Security (NFR-S1 to S8) | 8 | AES-256 at rest, TLS 1.3, 15-min access token, PII masking, 12-month audit log |
| Reliability (NFR-R1 to R4) | 4 | 99.5% uptime, **0% total outage**, Circuit Breaker < 10s, Session survive restart |
| Scalability (NFR-SC1 to SC3) | 3 | Horizontal scaling, new adapter = 0 core change, mock→live < 5% perf delta |
| Integration (NFR-I1 to I5) | 5 | OpenAPI schema gate (fail-to-start), Zalo OA compliance, webhook verification, **100% MockAdapter coverage** |

**Scale & Complexity:**

- Primary domain: BFF / API Gateway & Orchestrator Platform (Utility/Govtech)
- Complexity level: **High** — Port Orchestration & Resilience focused
- Estimated architectural components: **20+** (Port Registry, Auth Service, Session Store, 15 Domain Modules, Input Adapters, Notification Dispatcher, Resilience Layer, Config Manager, Document Service)
- Downstream services: **30** (14 MVP + 12 Phase 2 + 4 Phase 3)
- Mock adapters: **24** (6 internal-only services don't need mocks)

### Technical Constraints & Dependencies

| Constraint | Source | Architectural Implication |
|-----------|--------|--------------------------|
| better-auth for centralized auth | Product Brief | Auth service owns User/Session DB. Must support multi-provider linking. |
| Redis for session store | PRD (K1) | AOF persistence mandatory. TTL 24-48h. Event sourcing pattern. |
| PostgreSQL for User/Session DB | PRD | Owned by CSKH module. RBAC data lives here. |
| opossum for Circuit Breaker | Product Brief | Per-port circuit breaker instances. 30 CB instances total. |
| OpenAPI/Swagger from Backend | PRD (DR-8) | Contract-first. Mock data generated from spec. CI/CD gate. |
| Zalo OA REST API | PRD | Inbound/Outbound. Rate limiting: max 2 msg ZNS/KH/ticket/day |
| BullMQ on Redis for Retry Queue | Product Brief | Exponential backoff. Dead Letter Queue. Phase 2. |
| Nghị định 13/2023/NĐ-CP compliance | PRD (DR-1) | PII encryption, audit logging, data retention policies |
| 30 downstream services via Ports | PRD v4.0 | Port Registry pattern. Per-port config, CB, cache, mock/live adapter |

### Cross-Cutting Concerns Identified

1. **Port Registry** — Centralized management of 30 port adapters. Every module resolves ports through registry. Affects every downstream call.

2. **Identity Propagation** — Every outbound request carries JWT. Token lifecycle spans Auth Layer + Port Adapters. Affects every adapter and every downstream call.

3. **Resilience Boundary** — Every outbound HTTP call wrapped in per-port Circuit Breaker + Cache fallback + Timeout. Not optional — NFR-R2 mandates 0% total outage.

4. **Audit & Correlation** — Every request carries correlation ID (PT-12). Structured logging spans all layers. PII masking (NFR-S8) applied before any log write. 12-month retention (NFR-S7).

5. **Config Hot-Reload** — Per-service endpoint configs (mock/live URLs, timeouts, thresholds) reloadable without restart. Affects Port Registry and circuit breaker instances.

6. **Contract Validation Gate** — CI/CD validates mock JSON against latest OpenAPI spec (NFR-I1). Fail-to-start if mismatch. Applied per-port.

---

## Starter Template Evaluation

### Primary Technology Domain

**BFF / API Backend / Orchestrator Platform** — Brownfield NestJS 11 project with established DDD/CQRS foundation.

### Existing Foundation (Already Established)

The project runs on a mature NestJS 11 + Fastify + TypeScript stack with:

| Component | Location | Status |
|-----------|----------|--------|
| DDD Core Library | `libs/core/` | ✅ Existing — AggregateRoot, VOs, Specs, Repos |
| CQRS Infrastructure | `libs/shared/cqrs/` | ✅ Existing — Command/Query buses, event bus, idempotency |
| Redis Cache Service | `libs/shared/caching/` | ✅ Existing — Full get/set/mget/mset/delete/expire |
| Drizzle ORM + PostgreSQL | `libs/shared/database/` | ✅ Existing — Schema, UnitOfWork, Transactional Outbox |
| Circuit Breaker State | `libs/shared/resilience/` | ✅ Existing — CircuitBreakerState + FallbackProvider |
| Pino Structured Logging | `libs/shared/logging/` | ✅ Existing |
| Correlation ID Middleware | `libs/shared/context/` | ✅ Existing |
| Health Check Endpoints | `libs/shared/health/` | ✅ Existing |
| OpenTelemetry | `libs/shared/observability/` | ✅ Existing |
| HTTP Utilities | `libs/shared/http/` | ✅ Existing — Filters, interceptors, pipes |
| Reference Modules | `modules/order/`, `modules/product/` | ✅ Existing — Full DDD/CQRS reference |

### What Must Be Added for BFF (30 Services)

| # | Layer | Description | Priority |
|---|-------|-------------|----------|
| 1 | **Port Infrastructure** | `libs/shared/port/` — Port Registry, base adapter classes, per-port CB/cache wrapper | P0 |
| 2 | **Auth Module** | `modules/auth/` — better-auth integration, JWT via jose | P0 |
| 3 | **Endpoint Config** | `libs/shared/endpoint-config/` — Per-service mock/live config with hot-reload | P0 |
| 4 | **Session Module** | `modules/session/` — Redis Hash + Sorted Set event sourcing | P0 |
| 5 | **14 MVP Domain Modules** | customer, contract, meter, billing, payment, ticket, knowledge-base, communication, document + cross-cutting | P0-P1 |
| 6 | **Input Adapters** | `modules/adapters/` — Zalo OA, Web/API adapters | P0 |
| 7 | **Notification Dispatcher** | Rate-limited dispatch funnel | P0 |
| 8 | **Mock Data** | `mocks/` — 24 JSON datasets for mock adapters | P0-P1 |
| 9 | **12 Phase 2 Modules** | smart-meter, onboarding, feedback, reporting, chatbot, GIS, field-team, eContract, water-cutoff, call-center, segmentation, dashboard | P2 |
| 10 | **4 Phase 3 Modules** | meter-anomaly, campaign, leakage-alert, water-quality | P3 |

---

## Core Architectural Decisions

### Already Decided (by existing codebase + PRD)

| Decision | Choice | Locked By |
|----------|--------|-----------|
| Framework | NestJS 11 + Fastify | Existing codebase |
| Language | TypeScript 5.7 | Existing codebase |
| ORM / Database | Drizzle ORM + PostgreSQL | Existing codebase |
| Cache Layer | Redis | Existing codebase |
| Logging | Pino + nestjs-pino | Existing codebase |
| Auth Library | better-auth | PRD + Product Brief |
| Circuit Breaker | opossum | Product Brief |
| Architecture | Hexagonal Ports + DDD/CQRS | Existing codebase + PRD |
| API Style | REST + OpenAPI/Swagger | PRD (PT-1) |
| Tracing | OpenTelemetry + Correlation ID | Existing codebase |
| Package Manager / Runtime | Bun 1.1 | Existing codebase |
| Testing | Jest 30 + Supertest | Existing codebase |
| Validation | Zod + class-validator | Existing codebase |
| Resilience (state) | CircuitBreakerState + FallbackProvider | Existing codebase (`libs/shared/resilience/`) |

### Critical Decisions Made (This Step)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | **Port Registry Pattern** | **`PortRegistry` service** | Centralized management of 30 ports. Each port: interface + adapter (mock/live) + CB + cache config. Single point of control for routing, health monitoring, and switching. |
| D2 | **JWT Signing Library** | **`jose`** | Modern Web Crypto API, native JWK rotation, Bun-compatible, no native deps |
| D3 | **Mock Strategy** | **Static JSON per-port + Zod schema validation** | 24 JSON mock datasets, one per service. Zod schemas derived from OpenAPI spec. Contract gate at startup and CI/CD. |
| D4 | **Session Event Storage** | **Redis Hash + Sorted Set** | O(1) full session read, O(log N) time-range queries, TTL per session key, compatible with existing `RedisCacheService` |
| D5 | **Per-Service Config** | **YAML config file + chokidar hot-reload** | One `api-endpoints.yaml` with per-service settings (adapter, baseUrl, timeout, cacheTier). File watch → < 100ms reload. |
| D6 | **Per-Port HTTP Client** | **`PortHttpClient` (native `fetch` + opossum + cache)** | Each port gets its own fetch wrapper with CB, timeout, JWT injection, and cache tier. Builds on existing `CircuitBreakerState`. |
| D7 | **Aggregation Pattern** | **`AggregationService` with Promise.all fan-out** | Dashboard/home screen calls 5-6 ports in parallel. AggregationService handles partial failures gracefully. |
| D8 | **Module Grouping** | **Domain modules group related ports** | Each domain module (billing, payment, ticket, etc.) owns its port interfaces + adapters. Module exposes port tokens for DI. |
| D9 | **Dev Environment** | **Docker Compose (PostgreSQL + Redis) + native Bun** | Consistent stateful services, fastest hot-reload |

### Deferred Decisions (Post-MVP)

| Decision | Deferred To | Reason |
|----------|------------|--------|
| Redis pub/sub for config sync | Phase 2 (horizontal scaling) | Single-instance for MVP |
| OpenAPI code generation for Backend client | Phase 2 | Schema may change frequently during MVP |
| Kubernetes / container orchestration | Phase 3 | Docker Compose sufficient for MVP |
| BullMQ retry queue | Phase 2 | DLQ + exponential backoff not needed until full Graceful Degradation |
| Shadow Mode | When Backend ready | Only needed for billing-related API migration |
| WebSocket for real-time (smart meter, field team) | Phase 2 | REST polling sufficient for MVP |

---

## Data Architecture

### Databases

| Store | Technology | Purpose | Owner |
|-------|-----------|---------|-------|
| Primary DB | PostgreSQL (via Drizzle ORM) | User, Session, Auth data, Ticket cache | BFF (owned) |
| Session Store | Redis (AOF persistence) | Active session events, context cache | BFF (owned) |
| Port Response Cache | Redis (same instance, `cache:port:*` namespace) | Tiered cache per port: static 12-24h, dynamic 5-15min, transaction: NO CACHE | BFF (owned) |
| Mock Data | JSON files on disk (`mocks/`) | 24 mock datasets for mock adapters | BFF (owned) |

### Port Response Cache Strategy

```
Key pattern: cache:port:{portName}:{hashOfParams}
Examples:
  cache:port:customer-profile:USR-12345        → TTL: 43200s (12h, static)
  cache:port:invoice:USR-12345:2026-06          → TTL: 900s (15min, dynamic)
  cache:port:payment:PAY-001                    → NO CACHE (transaction)
  cache:port:ticket:TK-2026-002                 → TTL: 300s (5min, dynamic)
  cache:port:contract:CTR-001                   → TTL: 43200s (12h, static)
```

| Cache Tier | TTL | Ports | Examples |
|-----------|-----|-------|---------|
| **static** | 12-24h | customer-profile, contract, meter, tariff, knowledge-base | Customer 360°, contract details, tariff plan |
| **dynamic** | 5-15 min | invoice, meter-reading, ticket, debt, proactive-notification, field-team, reporting, segmentation, feedback, smart-meter | Invoice list, ticket status, consumption data |
| **transaction** | NO CACHE | payment, auth, document, onboarding, econtract, campaign, chatbot | Payment transactions, file uploads, e-signing |

### Session Event Schema (Redis)

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

**Session Write Atomicity (Redis Lua script):**

```typescript
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
```

---

## Authentication & Security

### Auth Architecture

| Layer | Technology | Responsibility |
|-------|-----------|---------------|
| Auth Service | better-auth (via `nestjs-better-auth`) | User registration, login, token management, multi-provider linking |
| Token Signing | `jose` library | JWT issue with HS256/RS256, key rotation support |
| Token Propagation | JWT in `Authorization: Bearer` header | Every BFF → downstream request carries signed identity |
| RBAC Enforcement | NestJS Guards | Primary role: `customer` (BFF only serves end-users) |

### JWT Token Strategy

| Token | TTL | Purpose |
|-------|-----|---------|
| Access Token | 15 minutes | API authorization, carries identity + channel |
| Refresh Token | 7 days | Silent token renewal, better-auth refresh flow |

### Security Measures

**PII Masking (MANDATORY — Nghị định 13/2023/NĐ-CP):**

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

- Audit log: structured JSON, correlation ID on every entry, 12-month retention
- Secret management: `JWT_SECRET` env var, rotation via `JWT_SECRET_OLD` + `JWT_SECRET_NEW`
- TLS 1.3 for all transit, AES-256 at rest for PII fields

---

## API & Communication Patterns

### Internal Communication (within BFF)

```
Controller → CommandBus/QueryBus → Handler → PortRegistry.resolve('invoice') → Adapter → Downstream
                                      ↓
                              Session Store (Redis)
                                      ↓
                              Port Response Cache (Redis)
```

### Port Call Patterns

**Pattern 1: Single Port Call (simple lookup)**

```typescript
// Handler: GetInvoiceListHandler
async execute(query: GetInvoiceListQuery): Promise<InvoiceListReadModel> {
  return this.portRegistry.execute('invoice', 'getList', {
    customerId: query.customerId,
    filters: query.filters,
  });
}
```

**Pattern 2: Fan-out Aggregation (dashboard/home screen)**

```typescript
// Handler: GetHomeScreenHandler — calls 5 ports in parallel
async execute(query: GetHomeScreenQuery): Promise<HomeScreenModel> {
  const [profile, invoices, debt, activeTickets, activeAlerts] =
    await Promise.allSettled([
      this.portRegistry.execute('customer-profile', 'getProfile', { customerId }),
      this.portRegistry.execute('invoice', 'getList', { customerId, limit: 3 }),
      this.portRegistry.execute('debt', 'getOutstandingDebt', { customerId }),
      this.portRegistry.execute('ticket', 'getTicketHistory', { customerId, status: 'open' }),
      this.portRegistry.execute('proactive-notification', 'getActiveAlerts', { customerId }),
    ]);

  return {
    profile: this.resolve(profile),
    recentInvoices: this.resolve(invoices),
    outstandingDebt: this.resolve(debt),
    activeTickets: this.resolve(activeTickets),
    activeAlerts: this.resolve(activeAlerts),
  };
}
```

**Pattern 3: Sequential Orchestration (payment flow)**

```typescript
// Handler: CreatePaymentHandler — sequential calls with no-cache
async execute(command: CreatePaymentCommand): Promise<PaymentResult> {
  // 1. Verify invoice exists (no cache for transaction flow)
  const invoice = await this.portRegistry.execute('invoice', 'getById', {
    invoiceId: command.invoiceId,
    useCache: false,
  });

  // 2. Create payment (NO CACHE)
  const payment = await this.portRegistry.execute('payment', 'createPayment', {
    invoiceId: command.invoiceId,
    method: command.method,
  });

  // 3. Dispatch notification
  await this.dispatchNotification(command.customerId, 'payment_created', payment);

  return payment;
}
```

### External Communication (BFF ↔ Downstream)

| Direction | Pattern | Details |
|-----------|---------|---------|
| Outbound (→ any downstream) | `PortRegistry.execute()` | Resolves adapter (mock/live) → fetch + CB + JWT + timeout + cache |
| Inbound (← Payment Service) | Webhook `POST /webhooks/payment/*` | Payment status updates (IPN) |
| Inbound (← Ticketing Service) | Webhook `POST /webhooks/ticket/*` | Ticket status updates |
| Inbound (← Zalo) | Webhook `POST /webhooks/zalo` | Zalo OA message callbacks |
| Inbound (← Notification Service) | Webhook `POST /webhooks/notification/*` | Delivery status callbacks |

### Mock → Live Switching Flow

```
1. Admin edits config/api-endpoints.yaml:
     invoice:
       adapter: mock  →  adapter: live
2. chokidar file watcher detects change
3. PortRegistry reloads config for 'invoice' port in < 100ms
4. Circuit Breaker instance reset for 'invoice'
5. Next invoice request uses live adapter — zero downtime
```

### Webhook Routing

```
POST /webhooks/payment/ipn        → Payment Module → Invoice cache invalidation
POST /webhooks/ticket/status      → Ticket Module → Session event + Notification dispatch
POST /webhooks/zalo/callback      → Zalo Adapter → Intent resolution → Command dispatch
POST /webhooks/notification/delivery → Communication Module → Delivery status update
```

---

## Port Registry Architecture

### Port Interface Base

```typescript
// Every port implements this interface
export interface IPort<TConfig, TResult> {
  readonly name: string;
  readonly cacheTier: 'static' | 'dynamic' | 'transaction';
  execute(method: string, params: Record<string, any>): Promise<TResult>;
}

// Adapter interface — mock and live implementations
export interface IPortAdapter {
  execute(method: string, params: Record<string, any>): Promise<any>;
}

// Port configuration from api-endpoints.yaml
export interface PortConfig {
  adapter: 'mock' | 'live';
  baseUrl?: string;
  timeout: number;
  cacheTier: 'static' | 'dynamic' | 'transaction';
  circuitBreaker: {
    errorThreshold: number;  // percentage
    resetTimeout: number;    // ms
    minRequests: number;
  };
}
```

### Port Registry Service

```typescript
@Injectable()
export class PortRegistry {
  private ports = new Map<string, PortEntry>();

  constructor(
    private readonly configService: EndpointConfigService,
    private readonly cacheService: RedisCacheService,
    private readonly logger: StructuredLogger,
  ) {}

  register(name: string, mockAdapter: IPortAdapter, liveAdapter: IPortAdapter, config: PortConfig): void { ... }

  async execute<T>(portName: string, method: string, params: Record<string, any>): Promise<T> {
    const entry = this.ports.get(portName);
    const config = this.configService.getEndpointConfig(portName);
    const adapter = config.adapter === 'mock' ? entry.mockAdapter : entry.liveAdapter;

    // Check cache (unless transaction tier or useCache: false)
    if (config.cacheTier !== 'transaction' && params.useCache !== false) {
      const cached = await this.getFromCache(portName, method, params);
      if (cached) return cached as T;
    }

    // Execute via circuit breaker
    const result = await this.executeWithCircuitBreaker(portName, adapter, method, params);

    // Cache result
    if (config.cacheTier !== 'transaction') {
      await this.setToCache(portName, method, params, result, config.cacheTier);
    }

    return result as T;
  }
}
```

### 30 Port Interface Catalog

| # | Port Name | Interface | Module Owner | Methods | Cache Tier | Phase |
|---|-----------|-----------|-------------|---------|-----------|-------|
| 1 | `auth` | `IAuthPort` | auth | login, register, linkProvider, refreshToken, verifyToken | none | MVP |
| 2 | `customer-profile` | `ICustomerProfilePort` | customer | getProfile, getProfileByPhone, getTimeline, getRelatedAccounts, updateProfile, getTags | static | MVP |
| 3 | `contract` | `IContractPort` | contract | getContracts, getContractDetail, getContractVersions, getContractPDF, signContract, checkRenewalAlerts | static | MVP |
| 4 | `meter` | `IMeterPort` | meter | getMeterByCustomer, getMeterDetail, getMeterHistory, getCalibrationStatus | static | MVP |
| 5 | `meter-reading` | `IMeterReadingPort` | meter | getReadings, getReadingDetail, getConsumptionChart, getComparison | dynamic | MVP |
| 6 | `tariff` | `ITariffPort` | billing | getTariffPlan, getTariffBreakdown, previewBill, getApplicableFees | static | MVP |
| 7 | `invoice` | `IInvoicePort` | billing | getList, getById, getPDF, getInvoiceDeliveryStatus, getBatchInvoices | dynamic | MVP |
| 8 | `payment` | `IPaymentPort` | payment | createPayment, createBatchPayment, getPaymentStatus, getPaymentHistory, setupAutoDebit, handleWebhook, getReceipt | **none** | MVP |
| 9 | `debt` | `IDebtPort` | payment | getOutstandingDebt, getDebtHistory, getDebtSchedule | dynamic | MVP |
| 10 | `ticket` | `ITicketPort` | ticket | createTicket, getTicketStatus, getTicketHistory, addComment, submitFeedback, handleWebhook, getServiceTypes | dynamic | MVP |
| 11 | `knowledge-base` | `IKnowledgeBasePort` | ticket | searchArticles, getArticle, getArticlesByCategory, rateArticle, getCategories | static | MVP |
| 12 | `proactive-notification` | `IProactiveNotificationPort` | communication | getActiveAlerts, getAlertHistory, getMaintenanceSchedule, acknowledgeAlert | dynamic | MVP |
| 13 | `notification` | `INotificationPort` | communication | dispatchNotification, getNotificationHistory, getNotificationPreferences, updateNotificationPreferences, getDeliveryStatus | dynamic | MVP |
| 14 | `document` | `IDocumentPort` | document | getUploadUrl, getDownloadUrl, deleteFile, getFileInfo | **none** | MVP |
| 15 | `segmentation` | `ISegmentationPort` | customer | getSegments, getSegmentHistory, checkEligibility | static | Phase 2 |
| 16 | `smart-meter` | `ISmartMeterPort` | meter | getRealtimeData, getHourlyData, getDailyData, getConnectionStatus, getBatteryStatus | dynamic | Phase 2 |
| 17 | `water-cutoff` | `IWaterCutoffPort` | payment | getCutoffStatus, getCutoffHistory, getCutoffSchedule | dynamic | Phase 2 |
| 18 | `call-center` | `ICallCenterPort` | communication | requestCallback, getCallbackStatus | dynamic | Phase 2 |
| 19 | `feedback` | `IFeedbackPort` | ticket | getSurvey, submitSurvey, getSurveyHistory | dynamic | Phase 2 |
| 20 | `onboarding` | `IOnboardingPort` | onboarding | submitApplication, uploadDocument, getApplicationStatus, getQuote, scheduleSurvey, payInstallationFee | **none** | Phase 2 |
| 21 | `site-survey` | `ISiteSurveyPort` | onboarding | getSurveyResult, getSurveyPhotos, signAcceptance | dynamic | Phase 2 |
| 22 | `reporting` | `IReportingPort` | reporting | getConsumptionReport, getComparisonReport, getSavingsTips, downloadReport | dynamic | Phase 2 |
| 23 | `chatbot` | `IChatbotPort` | ai | sendMessage, createSession, getSessionHistory, submitFeedback, handoffToAgent | dynamic | Phase 2 |
| 24 | `gis` | `IGISPort` | shared | checkCoverage, getNearbyIncidents, getCustomerLocation | static | Phase 2 |
| 25 | `field-team` | `IFieldTeamPort` | shared | getTeamETA, getTeamLocation, getWorkOrderStatus | dynamic | Phase 2 |
| 26 | `econtract` | `IeContractPort` | contract | initiateSigning, verifySignature, getSigningStatus | **none** | Phase 2 |
| 27 | `meter-anomaly` | `IMeterAnomalyPort` | meter | getAnomalyAlerts, getAnomalyDetail, reportAnomalyStatus | dynamic | Phase 3 |
| 28 | `campaign` | `ICampaignPort` | communication | getActiveCampaigns, getCampaignDetail, updateMarketingPreference, getMarketingMessages | static | Phase 3 |
| 29 | `leakage-alert` | `ILeakageAlertPort` | ai | getLeakageAlerts, getLeakageDetail, scheduleInspection, getInspectionResult | dynamic | Phase 3 |
| 30 | `water-quality` | `IWaterQualityPort` | shared | getQualityAtLocation, getQualityAlerts | dynamic | Phase 3 |

---

## Infrastructure & Deployment

### Development Environment

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

### Per-Service Endpoint Config

```yaml
# config/api-endpoints.yaml
services:
  # MVP Services (14)
  auth:
    adapter: mock
    baseUrl: ${AUTH_SERVICE_URL:http://localhost:3010}
    timeout: 3000
    cacheTier: none
    circuitBreaker:
      errorThreshold: 50
      resetTimeout: 10000
      minRequests: 5

  customer-profile:
    adapter: mock
    baseUrl: ${CUSTOMER_PROFILE_SERVICE_URL:http://localhost:3011}
    timeout: 3000
    cacheTier: static
    circuitBreaker:
      errorThreshold: 50
      resetTimeout: 10000
      minRequests: 5

  contract:
    adapter: mock
    baseUrl: ${CONTRACT_SERVICE_URL:http://localhost:3012}
    timeout: 3000
    cacheTier: static
    circuitBreaker:
      errorThreshold: 50
      resetTimeout: 10000
      minRequests: 5

  meter:
    adapter: mock
    timeout: 3000
    cacheTier: static
    circuitBreaker: { errorThreshold: 50, resetTimeout: 10000, minRequests: 5 }

  meter-reading:
    adapter: mock
    timeout: 3000
    cacheTier: dynamic
    circuitBreaker: { errorThreshold: 50, resetTimeout: 10000, minRequests: 5 }

  tariff:
    adapter: mock
    timeout: 3000
    cacheTier: static
    circuitBreaker: { errorThreshold: 50, resetTimeout: 10000, minRequests: 5 }

  invoice:
    adapter: mock
    timeout: 3000
    cacheTier: dynamic
    circuitBreaker: { errorThreshold: 50, resetTimeout: 10000, minRequests: 5 }

  payment:
    adapter: mock
    timeout: 3000
    cacheTier: none   # NO CACHE for transactions
    circuitBreaker: { errorThreshold: 50, resetTimeout: 10000, minRequests: 5 }

  debt:
    adapter: mock
    timeout: 3000
    cacheTier: dynamic
    circuitBreaker: { errorThreshold: 50, resetTimeout: 10000, minRequests: 5 }

  ticket:
    adapter: mock
    timeout: 3000
    cacheTier: dynamic
    circuitBreaker: { errorThreshold: 50, resetTimeout: 10000, minRequests: 5 }

  knowledge-base:
    adapter: mock
    timeout: 3000
    cacheTier: static
    circuitBreaker: { errorThreshold: 50, resetTimeout: 10000, minRequests: 5 }

  proactive-notification:
    adapter: mock
    timeout: 3000
    cacheTier: dynamic
    circuitBreaker: { errorThreshold: 50, resetTimeout: 10000, minRequests: 5 }

  notification:
    adapter: mock
    timeout: 3000
    cacheTier: dynamic
    circuitBreaker: { errorThreshold: 50, resetTimeout: 10000, minRequests: 5 }

  document:
    adapter: mock
    timeout: 5000
    cacheTier: none
    circuitBreaker: { errorThreshold: 50, resetTimeout: 10000, minRequests: 5 }

  # Phase 2 services (12) — adapter: mock by default
  segmentation: { adapter: mock, timeout: 3000, cacheTier: static }
  smart-meter: { adapter: mock, timeout: 3000, cacheTier: dynamic }
  water-cutoff: { adapter: mock, timeout: 3000, cacheTier: dynamic }
  call-center: { adapter: mock, timeout: 3000, cacheTier: dynamic }
  feedback: { adapter: mock, timeout: 3000, cacheTier: dynamic }
  onboarding: { adapter: mock, timeout: 3000, cacheTier: none }
  site-survey: { adapter: mock, timeout: 3000, cacheTier: dynamic }
  reporting: { adapter: mock, timeout: 5000, cacheTier: dynamic }
  chatbot: { adapter: mock, timeout: 5000, cacheTier: dynamic }
  gis: { adapter: mock, timeout: 3000, cacheTier: static }
  field-team: { adapter: mock, timeout: 3000, cacheTier: dynamic }
  econtract: { adapter: mock, timeout: 3000, cacheTier: none }

  # Phase 3 services (4)
  meter-anomaly: { adapter: mock, timeout: 3000, cacheTier: dynamic }
  campaign: { adapter: mock, timeout: 3000, cacheTier: static }
  leakage-alert: { adapter: mock, timeout: 3000, cacheTier: dynamic }
  water-quality: { adapter: mock, timeout: 3000, cacheTier: dynamic }
```

---

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database Naming (Drizzle ORM) — UNCHANGED:**

| Element | Convention | Example |
|---------|-----------|---------|
| Table name | snake_case, **plural** | `users`, `sessions`, `tickets` |
| Column name | snake_case | `customer_id`, `created_at` |
| Table variable | camelCase + `Table` suffix | `usersTable`, `sessionsTable` |
| Type name | PascalCase + `Record` suffix | `UserRecord`, `SessionRecord` |

**Redis Key Naming — EXPANDED:**

| Pattern | Convention | Example |
|---------|-----------|---------|
| Session data | `session:{userId}` | `session:USR-12345` |
| Session events | `session:{userId}:events` | `session:USR-12345:events` |
| Port response cache | `cache:port:{portName}:{hash}` | `cache:port:invoice:a1b2c3` |
| Circuit Breaker state | `cb:{portName}` | `cb:payment` |
| Idempotency | `idempotency:{hash}` | `idempotency:f4e3d2` |
| Config hash | `config:endpoints` | `config:endpoints` |

**Port & Adapter Naming — NEW:**

| Element | Convention | Example |
|---------|-----------|---------|
| Port interface file | `{port-name}.port.ts` | `invoice.port.ts` |
| Port interface class | `I{PortName}Port` | `IInvoicePort` |
| Mock adapter file | `mock-{port-name}.adapter.ts` | `mock-invoice.adapter.ts` |
| Mock adapter class | `Mock{PortName}Adapter` | `MockInvoiceAdapter` |
| Live adapter file | `internal-{port-name}.adapter.ts` | `internal-invoice.adapter.ts` |
| Live adapter class | `Internal{PortName}Adapter` | `InternalInvoiceAdapter` |
| Mock data file | `mocks/{port-name}/{method}.json` | `mocks/invoice/get-list.json` |
| DI token | `{PORT_NAME}_PORT_TOKEN` | `INVOICE_PORT_TOKEN` |

**API Naming — UNCHANGED:**

| Element | Convention | Example |
|---------|-----------|---------|
| Controller route | plural, kebab-case | `@Controller('invoices')` |
| Path params | camelCase | `@Param('invoiceId')` |
| Headers | kebab-case | `x-correlation-id` |

### Structure Patterns

**Domain Module Pattern (follows existing order/product pattern):**

```
{module}/
├── domain/
│   ├── entities/          # Aggregate roots, child entities
│   ├── events/            # Domain events
│   ├── repositories/      # Repository interfaces
│   ├── services/          # Domain services
│   ├── value-objects/     # Value objects
│   └── index.ts
├── application/
│   ├── commands/
│   │   ├── handlers/      # Command handlers — orchestrate port calls
│   │   ├── {action}-{entity}.command.ts
│   │   └── index.ts
│   ├── queries/
│   │   ├── handlers/      # Query handlers — aggregate from ports
│   │   ├── ports/         # Read DAO interfaces (local cache)
│   │   └── index.ts
│   ├── dtos/
│   └── index.ts
├── infrastructure/
│   ├── http/              # Controllers + webhook handlers
│   ├── ports/             # Port interfaces + adapters for this domain
│   │   ├── {port-name}.port.ts           # Interface
│   │   ├── mock-{port-name}.adapter.ts   # Mock
│   │   └── internal-{port-name}.adapter.ts # Live
│   ├── persistence/       # Drizzle schema, read DAO, write repo (if owned)
│   └── projections/       # Event handlers → read model updates
├── constants/
│   └── tokens.ts
└── {module}.module.ts
```

### Communication Patterns

**CQRS Command/Query Naming — UNCHANGED:**

| Type | Pattern | Example |
|------|---------|---------|
| Command | `{Action}{Entity}Command` | `CreateTicketCommand`, `DispatchNotificationCommand` |
| Query | `Get{Entity}Query` | `GetInvoiceListQuery`, `GetHomeScreenQuery` |
| Handler | `{CommandName}Handler` | `CreateTicketHandler` |
| DI Token | `{MODULE}_{TYPE}_TOKEN` | `TICKET_REPOSITORY_TOKEN` |

**Session Event Types — EXPANDED:**

| Event Type | When | Payload |
|-----------|------|---------|
| `zalo_message_received` | KH sends Zalo message | `{ messageId, content, timestamp }` |
| `ticket_created` | Ticket created | `{ ticketId, type, channel }` |
| `ticket_status_changed` | Ticket status update | `{ ticketId, oldStatus, newStatus, actor }` |
| `payment_completed` | Payment successful | `{ paymentId, invoiceId, amount }` |
| `notification_sent` | Notification dispatched | `{ channel, type, timestamp }` |
| `invoice_viewed` | KH opens invoice | `{ invoiceId, channel }` |
| `alert_acknowledged` | KH acknowledges alert | `{ alertId }` |

### Process Patterns

**Error Handling Chain (Port call):**

```
PortRegistry.execute(portName, method, params)
  ├── Check cache → HIT → return cached (skip downstream)
  ├── Resolve adapter (mock/live from config)
  ├── Adapter.execute(method, params)
  │   ├── Live: fetch + JWT + timeout
  │   │   ├── Success (2xx) → cache result → return
  │   │   ├── 401 → auto-refresh token → retry once
  │   │   ├── 403 → throw ForbiddenException (no retry)
  │   │   ├── 404 → throw NotFoundException
  │   │   ├── 5xx / Timeout → CB counts failure → fallback
  │   │   └── CB OPEN → return cached + log warning
  │   └── Mock: read JSON file → Zod validate → return
  └── Fallback: cached data or graceful message
```

**Idempotency — Two Boundaries:**

_Inbound (Adapter → BFF):_ Every `NormalizedRequest` carries `idempotencyKey` (hash of messageId/callId). Check Redis before processing. Trùng key → return cached result.

_Outbound (BFF → Downstream):_ Every `PortHttpClient` POST/PUT includes `x-idempotency-key` header.

**Aggregation with Partial Failure:**

```typescript
// Use Promise.allSettled for fan-out — never let one port failure block others
const results = await Promise.allSettled([
  this.portRegistry.execute('customer-profile', 'getProfile', { customerId }),
  this.portRegistry.execute('invoice', 'getList', { customerId }),
  this.portRegistry.execute('ticket', 'getTicketHistory', { customerId }),
]);

// Resolve each individually
const profile = results[0].status === 'fulfilled' ? results[0].value : null;
const invoices = results[1].status === 'fulfilled' ? results[1].value : [];
const tickets = results[2].status === 'fulfilled' ? results[2].value : [];
```

### Enforcement Guidelines

**All AI Agents MUST:**

1. **Follow existing naming conventions** — kebab-case files, PascalCase classes, snake_case DB columns, camelCase API fields
2. **Use the DDD/CQRS module structure** — domain/application/infrastructure layers
3. **Use existing exception classes** — `NotFoundException`, `ForbiddenException`, `BusinessRuleException`
4. **Inject via DI tokens** — `{MODULE}_{TYPE}_TOKEN` pattern
5. **Resolve all port calls via PortRegistry** — never `fetch()` directly to downstream
6. **Include correlation ID** in every log entry and outbound call
7. **Wrap every downstream call** in Circuit Breaker via PortRegistry
8. **Write session events** for every KH interaction
9. **Co-locate tests** as `*.spec.ts` next to the file under test
10. **Never cache transaction-tier ports** — payment, document, onboarding, econtract

**Anti-Patterns:**

| Anti-Pattern | Why | Do This Instead |
|-------------|-----|-----------------|
| `fetch()` directly to downstream | Bypasses CB, JWT, cache, logging | Use `PortRegistry.execute()` |
| Business logic in Controllers | Violates CQRS | Controller → CommandBus → Handler → Port |
| Hardcoded endpoint URLs | Breaks mock/live switching | Read from Endpoint Config |
| `any` type for API responses | Loses type safety | Define Zod schemas + TypeScript types |
| Storing PII in logs | Violates Nghị định 13 | Mask via Pino serializer |
| Singleton CB for all ports | One port's failure blocks others | Per-port CB instances via PortRegistry |
| Caching payment transactions | Violates NFR-R2, data integrity | Cache tier: `none` for payment ports |

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```
IOC_Customer/
│
├── .github/
│   └── workflows/
│       └── ci.yml                          # Contract validation gate (NFR-I1)
│
├── config/
│   ├── api-endpoints.yaml                  # Per-service mock/live config (D5)
│   └── api-endpoints.schema.ts             # Zod schema for config validation
│
├── mocks/                                   # Mock data for 24 services
│   ├── auth/
│   │   ├── login.json
│   │   └── register.json
│   ├── customer-profile/
│   │   ├── get-profile.json
│   │   └── get-timeline.json
│   ├── contract/
│   │   ├── get-contracts.json
│   │   └── get-contract-detail.json
│   ├── meter/
│   │   ├── get-meter-by-customer.json
│   │   └── get-calibration-status.json
│   ├── meter-reading/
│   │   ├── get-readings.json
│   │   ├── get-consumption-chart.json
│   │   └── get-comparison.json
│   ├── tariff/
│   │   ├── get-tariff-plan.json
│   │   └── get-tariff-breakdown.json
│   ├── invoice/
│   │   ├── get-list.json
│   │   ├── get-by-id.json
│   │   └── get-pdf.json
│   ├── payment/
│   │   ├── create-payment.json
│   │   └── get-payment-status.json
│   ├── debt/
│   │   └── get-outstanding-debt.json
│   ├── ticket/
│   │   ├── create-ticket.json
│   │   ├── get-ticket-status.json
│   │   └── get-ticket-history.json
│   ├── knowledge-base/
│   │   ├── search-articles.json
│   │   └── get-article.json
│   ├── proactive-notification/
│   │   └── get-active-alerts.json
│   ├── notification/
│   │   ├── dispatch-notification.json
│   │   └── get-notification-history.json
│   └── document/
│       └── get-upload-url.json
│
├── drizzle/                                 # Drizzle Kit migrations
│   └── migrations/
│
├── test/
│   ├── jest-e2e.json
│   ├── mocks/
│   │   ├── mock-backend-server.ts          # HTTP server simulating downstream
│   │   └── mock-zalo-webhook.ts            # Zalo webhook simulator
│   └── integration/
│       ├── context-preservation.spec.ts
│       ├── circuit-breaker.spec.ts
│       ├── mock-live-switch.spec.ts
│       └── port-registry.spec.ts
│
├── docker-compose.yml                       # PostgreSQL 16 + Redis 7 (AOF)
├── docker-compose.test.yml
│
├── src/
│   ├── main.ts
│   ├── app.module.ts                        # Updated — import all BFF modules
│   │
│   ├── libs/
│   │   ├── core/                            # EXISTING — DDD primitives (unchanged)
│   │   │
│   │   └── shared/                          # EXISTING + EXTENDED
│   │       ├── caching/                     #   Existing — Redis cache
│   │       ├── context/                     #   Existing — Correlation ID
│   │       ├── cqrs/                        #   Existing — CQRS buses + idempotency
│   │       ├── database/                    #   Existing — Drizzle + UoW + Outbox
│   │       ├── health/                      #   Existing — Health check
│   │       ├── http/                        #   Existing — Filters, interceptors
│   │       ├── logging/                     #   Existing — Pino
│   │       ├── observability/               #   Existing — OpenTelemetry
│   │       ├── resilience/                  #   Existing — CB state + Fallback
│   │       │
│   │       ├── port/                        # NEW — Port Infrastructure
│   │       │   ├── port.interface.ts                  # IPort, IPortAdapter, PortConfig
│   │       │   ├── port-registry.service.ts           # Central registry for 30 ports
│   │       │   ├── port-http-client.service.ts        # fetch + CB + JWT + timeout + cache
│   │       │   ├── mock-adapter.base.ts               # Base class: reads JSON + Zod validate
│   │       │   ├── internal-adapter.base.ts           # Base class: HTTP call via PortHttpClient
│   │       │   ├── aggregation.service.ts             # Fan-out + Promise.allSettled wrapper
│   │       │   ├── port.module.ts                     # NestJS global module
│   │       │   └── index.ts
│   │       │
│   │       ├── endpoint-config/             # NEW — Per-service config
│   │       │   ├── endpoint-config.service.ts         # chokidar + reload
│   │       │   ├── endpoint-config.interface.ts
│   │       │   ├── endpoint-config.module.ts
│   │       │   └── index.ts
│   │       │
│   │       └── auth-propagation/            # NEW — JWT signing
│   │           ├── jwt-signer.service.ts              # jose JWT issue
│   │           ├── auth-propagation.middleware.ts
│   │           ├── auth-propagation.module.ts
│   │           └── index.ts
│   │
│   └── modules/
│       ├── order/                           # EXISTING — Reference (unchanged)
│       ├── product/                         # EXISTING — Reference (unchanged)
│       │
│       ├── auth/                            # NEW — S1: Customer Auth
│       │   ├── domain/
│       │   │   ├── entities/user.entity.ts
│       │   │   └── value-objects/user-role.value-object.ts
│       │   ├── application/
│       │   │   ├── commands/                          # login, register, link-provider
│       │   │   ├── queries/                           # get-user-by-phone, get-user-by-provider
│       │   │   └── dtos/
│       │   ├── infrastructure/
│       │   │   ├── http/auth.controller.ts
│       │   │   ├── persistence/drizzle/schema/user.schema.ts
│       │   │   ├── persistence/write/user.repository.ts
│       │   │   ├── persistence/read/user-read-dao.ts
│       │   │   ├── better-auth/better-auth.setup.ts
│       │   │   └── ports/auth.port.ts                 # IAuthPort + MockAuthAdapter
│       │   ├── constants/tokens.ts
│       │   └── auth.module.ts
│       │
│       ├── customer/                        # NEW — S2, S3: Customer Profile & Segmentation
│       │   ├── domain/
│       │   ├── application/
│       │   │   ├── commands/                          # update-profile
│       │   │   └── queries/                           # get-profile, get-timeline, get-related
│       │   ├── infrastructure/
│       │   │   ├── http/customer.controller.ts
│       │   │   └── ports/
│       │   │       ├── customer-profile.port.ts       # ICustomerProfilePort
│       │   │       └── segmentation.port.ts           # ISegmentationPort (Phase 2)
│       │   └── customer.module.ts
│       │
│       ├── contract/                        # NEW — S4, S33: Contract & eContract
│       │   ├── domain/
│       │   ├── application/
│       │   │   ├── commands/                          # sign-contract
│       │   │   └── queries/                           # get-contracts, get-contract-detail, get-versions
│       │   ├── infrastructure/
│       │   │   ├── http/contract.controller.ts
│       │   │   └── ports/
│       │   │       ├── contract.port.ts               # IContractPort
│       │   │       └── econtract.port.ts              # IeContractPort (Phase 2)
│       │   └── contract.module.ts
│       │
│       ├── meter/                           # NEW — S5, S6, S7, S8: Meter & Consumption
│       │   ├── domain/
│       │   ├── application/
│       │   │   ├── queries/                           # get-meter, get-readings, get-chart, get-comparison
│       │   ├── infrastructure/
│       │   │   ├── http/meter.controller.ts
│       │   │   └── ports/
│       │   │       ├── meter.port.ts                  # IMeterPort
│       │   │       ├── meter-reading.port.ts          # IMeterReadingPort
│       │   │       ├── smart-meter.port.ts            # ISmartMeterPort (Phase 2)
│       │   │       └── meter-anomaly.port.ts          # IMeterAnomalyPort (Phase 3)
│       │   └── meter.module.ts
│       │
│       ├── billing/                         # NEW — S9, S10: Tariff & Invoice
│       │   ├── domain/
│       │   ├── application/
│       │   │   ├── commands/                          # (payment triggers invoice cache invalidation)
│       │   │   └── queries/                           # get-tariff, get-invoices, get-invoice-detail, get-pdf
│       │   ├── infrastructure/
│       │   │   ├── http/
│       │   │   │   ├── invoice.controller.ts
│       │   │   │   └── tariff.controller.ts
│       │   │   └── ports/
│       │   │       ├── tariff.port.ts                 # ITariffPort
│       │   │       └── invoice.port.ts                # IInvoicePort
│       │   └── billing.module.ts
│       │
│       ├── payment/                         # NEW — S12, S13, S14: Payment, Debt, Water Cutoff
│       │   ├── domain/
│       │   │   ├── entities/payment.entity.ts
│       │   │   └── value-objects/
│       │   ├── application/
│       │   │   ├── commands/                          # create-payment, setup-auto-debit
│       │   │   └── queries/                           # get-payment-history, get-debt, get-cutoff-status
│       │   ├── infrastructure/
│       │   │   ├── http/
│       │   │   │   ├── payment.controller.ts
│       │   │   │   └── webhook.controller.ts          # Payment IPN webhook
│       │   │   ├── persistence/                       # Payment record cache (PostgreSQL)
│       │   │   └── ports/
│       │   │       ├── payment.port.ts                # IPaymentPort
│       │   │       ├── debt.port.ts                   # IDebtPort
│       │   │       └── water-cutoff.port.ts           # IWaterCutoffPort (Phase 2)
│       │   └── payment.module.ts
│       │
│       ├── ticket/                          # NEW — S16, S17, S18: Ticketing, Feedback, KB
│       │   ├── domain/
│       │   │   ├── entities/ticket.entity.ts
│       │   │   ├── events/
│       │   │   └── value-objects/                     # ticket-type, ticket-status, priority
│       │   ├── application/
│       │   │   ├── commands/                          # create-ticket, update-ticket, submit-feedback
│       │   │   └── queries/                           # get-ticket, get-ticket-list, search-articles
│       │   ├── infrastructure/
│       │   │   ├── http/
│       │   │   │   ├── ticket.controller.ts
│       │   │   │   ├── knowledge-base.controller.ts
│       │   │   │   └── webhook.controller.ts          # Ticket status webhook
│       │   │   ├── persistence/                       # Ticket cache (PostgreSQL)
│       │   │   └── ports/
│       │   │       ├── ticket.port.ts                 # ITicketPort
│       │   │       ├── feedback.port.ts               # IFeedbackPort (Phase 2)
│       │   │       └── knowledge-base.port.ts         # IKnowledgeBasePort
│       │   └── ticket.module.ts
│       │
│       ├── onboarding/                     # NEW — S19, S20: Customer Onboarding (Phase 2)
│       │   ├── domain/
│       │   ├── application/
│       │   │   ├── commands/                          # submit-application, upload-doc, schedule-survey
│       │   │   └── queries/                           # get-application-status, get-quote
│       │   ├── infrastructure/
│       │   │   ├── http/onboarding.controller.ts
│       │   │   └── ports/
│       │   │       ├── onboarding.port.ts             # IOnboardingPort
│       │   │       └── site-survey.port.ts            # ISiteSurveyPort
│       │   └── onboarding.module.ts
│       │
│       ├── communication/                  # NEW — S21, S22, S32: Notification, Alerts, Campaign
│       │   ├── domain/
│       │   │   └── value-objects/
│       │   │       └── notification-channel.ts
│       │   ├── application/
│       │   │   ├── commands/                          # dispatch-notification
│       │   │   └── queries/                           # get-notification-history, get-active-alerts
│       │   ├── infrastructure/
│       │   │   ├── http/
│       │   │   │   ├── notification.controller.ts
│       │   │   │   └── proactive-notification.controller.ts
│       │   │   ├── rate-limiter/
│       │   │   │   └── redis-rate-limiter.service.ts  # 2 msg ZNS/KH/ticket/day
│       │   │   ├── dispatchers/                       # Per-channel dispatch
│       │   │   │   ├── zalo.dispatcher.ts
│       │   │   │   ├── push.dispatcher.ts
│       │   │   │   └── sms.dispatcher.ts
│       │   │   └── ports/
│       │   │       ├── notification.port.ts           # INotificationPort
│       │   │       ├── proactive-notification.port.ts # IProactiveNotificationPort
│       │   │       └── campaign.port.ts               # ICampaignPort (Phase 3)
│       │   └── communication.module.ts
│       │
│       ├── ai/                              # NEW — S24, S25: Chatbot, Leakage Alert
│       │   ├── domain/
│       │   ├── application/
│       │   │   ├── commands/                          # send-chat-message, schedule-inspection
│       │   │   └── queries/                           # get-chat-session, get-leakage-alerts
│       │   ├── infrastructure/
│       │   │   ├── http/
│       │   │   │   └── chatbot.controller.ts
│       │   │   └── ports/
│       │   │       ├── chatbot.port.ts                # IChatbotPort (Phase 2)
│       │   │       └── leakage-alert.port.ts          # ILeakageAlertPort (Phase 3)
│       │   └── ai.module.ts
│       │
│       ├── reporting/                       # NEW — S23: Customer Reports (Phase 2)
│       │   ├── application/
│       │   │   └── queries/                           # get-consumption-report, get-comparison
│       │   ├── infrastructure/
│       │   │   ├── http/reporting.controller.ts
│       │   │   └── ports/reporting.port.ts            # IReportingPort
│       │   └── reporting.module.ts
│       │
│       ├── session/                         # NEW — Context Preservation
│       │   ├── domain/
│       │   │   ├── entities/session.entity.ts
│       │   │   └── events/session-event.types.ts
│       │   ├── application/
│       │   │   ├── commands/                          # record-session-event, close-session
│       │   │   └── queries/                           # get-session, get-session-events
│       │   ├── infrastructure/
│       │   │   └── redis/redis-session.repository.ts  # Hash + Sorted Set + Lua script
│       │   └── session.module.ts
│       │
│       ├── document/                        # NEW — S34: File Upload/Storage
│       │   ├── application/
│       │   │   ├── commands/                          # upload-file, delete-file
│       │   │   └── queries/                           # get-download-url
│       │   ├── infrastructure/
│       │   │   ├── http/document.controller.ts
│       │   │   └── ports/document.port.ts             # IDocumentPort
│       │   └── document.module.ts
│       │
│       ├── adapters/                        # NEW — Hexagonal Input Adapters
│       │   ├── core/
│       │   │   ├── input-adapter.interface.ts         # IInputAdapter
│       │   │   ├── base-adapter.ts
│       │   │   ├── normalized-request.interface.ts    # NormalizedRequest type
│       │   │   └── idempotency.service.ts             # Inbound dedup
│       │   ├── zalo/
│       │   │   ├── zalo-adapter.service.ts
│       │   │   ├── zalo-webhook.controller.ts
│       │   │   ├── zalo-signature.guard.ts
│       │   │   └── zalo-intent.resolver.ts
│       │   └── api/                         # Web/Mobile API input adapter
│       │       └── api-adapter.service.ts
│       │
│       └── shared/                          # NEW — Cross-cutting domain modules
│           ├── gis/                         # S30: GIS (Phase 2)
│           │   └── ports/gis.port.ts
│           ├── field-team/                  # S31: Field Team Tracking (Phase 2)
│           │   └── ports/field-team.port.ts
│           └── water-quality/               # S35: Water Quality (Phase 3)
│               └── ports/water-quality.port.ts
│
├── package.json
├── tsconfig.json
├── nest-cli.json
├── drizzle.config.ts
├── .env.example
└── README.md
```

### Architectural Boundaries

**Component Boundary Diagram:**

```
┌──────────────────────────────────────────────────────────────────────┐
│                        NESTJS APPLICATION (BFF)                      │
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐    │
│  │ Zalo Adapter   │  │  API Adapter  │  │ Future: App Push, SMS │    │
│  └───────┬───────┘  └───────┬───────┘  └───────────┬───────────┘    │
│          └────────┬─────────┘                       │                 │
│                  ▼                                  │                 │
│  ┌──────────────────────────────────────────────────┴──────────────┐ │
│  │              Auth Layer (better-auth + jose)                     │ │
│  │         • User/Session DB (PostgreSQL — owned)                  │ │
│  │         • RBAC Guard: customer role                              │ │
│  └───────────────────────────┬─────────────────────────────────────┘ │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                 CQRS Bus (Command + Query)                     │   │
│  │    Existing SharedCqrsModule — unchanged                       │   │
│  └───┬───────────┬───────────┬───────────┬────────────┬──────────┘   │
│      ▼           ▼           ▼           ▼            ▼              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐       │
│  │Billing │ │Payment │ │Ticket │ │Communi-│ │Other Modules │       │
│  │Module  │ │Module  │ │Module │ │cation  │ │(meter,customer│      │
│  │        │ │        │ │       │ │Module  │ │,onboarding…) │       │
│  └───┬────┘ └───┬────┘ └───┬───┘ └───┬────┘ └──────┬───────┘       │
│      │          │          │          │              │                │
│  ┌───▼──────────▼──────────▼──────────▼──────────────▼────────────┐ │
│  │                    SESSION MODULE (Redis AOF)                   │ │
│  │    Context Preservation — every interaction recorded           │ │
│  └───────────────────────────┬────────────────────────────────────┘ │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                   PORT REGISTRY (30 Ports)                     │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐   │   │
│  │  │Endpoint Config│  │Per-Port CB   │  │Per-Port Cache      │   │   │
│  │  │(chokidar)     │  │(opossum ×30) │  │(static/dynamic/    │   │   │
│  │  │              │  │              │  │ transaction)        │   │   │
│  │  └─────────────┘  └──────────────┘  └────────────────────┘   │   │
│  │                                                                │   │
│  │  14 MVP Ports    │ 12 Phase 2 Ports    │ 4 Phase 3 Ports      │   │
│  │  auth, customer, │ smart-meter, onb-   │ meter-anomaly,       │   │
│  │  contract, meter,│ oarding, feedback,  │ campaign, leakage,   │   │
│  │  meter-reading,  │ reporting, chatbot,  │ water-quality        │   │
│  │  tariff, invoice,│ gis, field-team,    │                      │   │
│  │  payment, debt,  │ econtract, water-   │                      │   │
│  │  ticket, kb,    │ cutoff, call-center, │                      │   │
│  │  proactive,     │ segmentation         │                      │   │
│  │  notification,  │                      │                      │   │
│  │  document       │                      │                      │   │
│  └───────────────────────────┬───────────────────────────────────┘   │
│                              │                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐  ┌─────────────────────┐  ┌──────────────┐
│ Mock Files    │  │ Internal Services   │  │ External APIs │
│ (24 JSON      │  │ (Live when ready)   │  │ (Zalo OA,    │
│  datasets)    │  │                     │  │  NAPAS, etc.) │
└───────────────┘  └─────────────────────┘  └──────────────┘
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

# JWT Propagation (shared with downstream services)
JWT_SECRET=<shared-secret>
JWT_SECRET_OLD=

# Zalo OA
ZALOA_ACCESS_TOKEN=<token>
ZALOA_VERIFICATION_TOKEN=<verify-token>
ZALOA_SECRET_KEY=<hmac-secret>

# Inter-service webhooks
INTER_SERVICE_API_KEY=<shared-static-key>

# Mock mode toggle (true = all ports use mock adapters)
MOCK_MODE=true

# Individual service URLs (used when adapter=live)
AUTH_SERVICE_URL=http://localhost:3010
CUSTOMER_PROFILE_SERVICE_URL=http://localhost:3011
CONTRACT_SERVICE_URL=http://localhost:3012
METER_SERVICE_URL=http://localhost:3013
METER_READING_SERVICE_URL=http://localhost:3014
TARIFF_SERVICE_URL=http://localhost:3015
INVOICE_SERVICE_URL=http://localhost:3016
PAYMENT_SERVICE_URL=http://localhost:3017
DEBT_SERVICE_URL=http://localhost:3018
TICKET_SERVICE_URL=http://localhost:3019
KB_SERVICE_URL=http://localhost:3020
PROACTIVE_NOTIFICATION_SERVICE_URL=http://localhost:3021
NOTIFICATION_SERVICE_URL=http://localhost:3022
DOCUMENT_SERVICE_URL=http://localhost:3023
# ... Phase 2/3 service URLs

# Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

---

## Implementation Sequence

### Phase 1: Infrastructure Foundation (Week 1-2)

```
1. Docker Compose (PostgreSQL + Redis)                    ← Foundation
2. Port Infrastructure (libs/shared/port/)                ← Blocks all downstream calls
   ├── port.interface.ts (IPort, IPortAdapter, PortConfig)
   ├── port-registry.service.ts (central registry)
   ├── mock-adapter.base.ts (JSON file reader + Zod)
   ├── internal-adapter.base.ts (fetch + CB + JWT)
   └── aggregation.service.ts (Promise.allSettled wrapper)
3. Endpoint Config Module (libs/shared/endpoint-config/)  ← Enables mock/live switching
4. Auth Propagation Module (libs/shared/auth-propagation/)← JWT signing
5. Mock Data Files (mocks/) — 14 MVP services            ← Enables testing without Backend
```

### Phase 2: MVP Domain Modules (Week 3-6)

```
6.  Auth Module (modules/auth/)                           ← Blocks everything
    ├── better-auth setup, user entity, JWT lifecycle
    └── IAuthPort + MockAuthAdapter
7.  Session Module (modules/session/)                     ← Context Preservation
    ├── Redis Hash + Sorted Set + Lua script
    └── Session events recording
8.  Input Adapters (modules/adapters/)                    ← Multi-channel
    ├── core/ (IInputAdapter, NormalizedRequest)
    ├── zalo/ (webhook controller, HMAC guard, intent resolver)
    └── api/ (standard REST input adapter)
9.  Customer Module (modules/customer/)                   ← Profile 360°
    └── ICustomerProfilePort + MockCustomerProfileAdapter
10. Contract Module (modules/contract/)                   ← Contract management
    └── IContractPort + MockContractAdapter
11. Meter Module (modules/meter/)                         ← Meter & consumption
    └── IMeterPort + IMeterReadingPort + mock adapters
12. Billing Module (modules/billing/)                     ← Tariff & invoice
    └── ITariffPort + IInvoicePort + mock adapters
13. Payment Module (modules/payment/)                     ← Payment & debt
    ├── IPaymentPort + IDebtPort + mock adapters
    └── Webhook controller for payment IPN
14. Ticket Module (modules/ticket/)                       ← Ticketing & KB
    ├── ITicketPort + IKnowledgeBasePort + mock adapters
    └── Webhook controller for ticket status
15. Communication Module (modules/communication/)         ← Notification
    ├── INotificationPort + IProactiveNotificationPort
    ├── Rate limiter (2 msg ZNS/KH/ticket/day)
    └── Channel dispatchers (Zalo, Push)
16. Document Module (modules/document/)                   ← File upload
    └── IDocumentPort + MockDocumentAdapter
```

### Phase 3: Integration & Testing (Week 7-8)

```
17. Webhook Integration — connect real webhook handlers
18. Context Preservation E2E test — cross-channel flow
19. Port Registry E2E test — mock→live switching
20. Circuit Breaker E2E test — kill downstream → verify fallback
21. Aggregation E2E test — home screen loads with partial failures
22. API Contract Validation Gate — CI/CD pipeline
```

### Phase 4: Growth (Phase 2 Services — Month 3-6)

```
23. Smart Meter Module (ISmartMeterPort)
24. Onboarding Module (IOnboardingPort + ISiteSurveyPort)
25. Feedback Module (IFeedbackPort)
26. Reporting Module (IReportingPort)
27. AI Chatbot Module (IChatbotPort)
28. GIS Module (IGISPort)
29. Field Team Module (IFieldTeamPort)
30. eContract Module (IeContractPort)
31. Water Cutoff Module (IWaterCutoffPort)
32. Call Center Module (ICallCenterPort)
33. Segmentation Module (ISegmentationPort)
```

### Phase 5: Vision (Phase 3 Services — Month 7+)

```
34. Meter Anomaly Module (IMeterAnomalyPort)
35. Campaign Module (ICampaignPort)
36. AI Leakage Alert Module (ILeakageAlertPort)
37. Water Quality Module (IWaterQualityPort)
```

---

## Architecture Validation Results

### Requirements Coverage

**72 Functional Requirements Coverage:**

| FR Category | FRs | Module(s) | Port(s) | Status |
|------------|-----|-----------|---------|--------|
| Auth & Identity (FR1-FR5) | 5 | `modules/auth/` | `auth` | ✅ |
| Customer Profile (FR6-FR9) | 4 | `modules/customer/` | `customer-profile` | ✅ |
| Hexagonal Ports (FR10-FR15) | 6 | `libs/shared/port/` | all 30 | ✅ |
| Contract (FR16-FR19) | 4 | `modules/contract/` | `contract` | ✅ |
| Meter Info (FR20-FR22) | 3 | `modules/meter/` | `meter` | ✅ |
| Consumption (FR23-FR25) | 3 | `modules/meter/` | `meter-reading` | ✅ |
| Tariff (FR26-FR28) | 3 | `modules/billing/` | `tariff` | ✅ |
| Invoice (FR29-FR32) | 4 | `modules/billing/` | `invoice` | ✅ |
| Payment (FR33-FR38) | 6 | `modules/payment/` | `payment` | ✅ |
| Debt (FR39-FR40) | 2 | `modules/payment/` | `debt` | ✅ |
| Ticketing (FR41-FR46) | 6 | `modules/ticket/` | `ticket` | ✅ |
| Knowledge Base (FR47-FR49) | 3 | `modules/ticket/` | `knowledge-base` | ✅ |
| Proactive Comms (FR50-FR53) | 4 | `modules/communication/` | `proactive-notification` | ✅ |
| Notification (FR54-FR57) | 4 | `modules/communication/` | `notification` | ✅ |
| Document (FR58-FR60) | 3 | `modules/document/` | `document` | ✅ |
| Context Preservation (FR61-FR64) | 4 | `modules/session/` | internal (Redis) | ✅ |
| Resilience (FR65-FR68) | 4 | `libs/shared/port/` | all 30 (per-port CB) | ✅ |
| Idempotency (FR69-FR70) | 2 | `modules/adapters/core/` | all 30 | ✅ |
| Webhook Security (FR71-FR72) | 2 | webhook controllers | `notification`, `ticket` | ✅ |

**28 Non-Functional Requirements Coverage:**

| NFR Dimension | Count | Architectural Support | Status |
|--------------|-------|----------------------|--------|
| Performance (P1-P6) | 6 | PortRegistry < 200ms, Auth < 500ms, Aggregation < 500ms, 500 sessions | ✅ |
| Security (S1-S8) | 8 | jose JWT, TLS 1.3, AES-256, PII masking, 15-min TTL, audit logs | ✅ |
| Reliability (R1-R4) | 4 | Per-port CB < 10s, Redis AOF, 0% outage via cache fallback | ✅ |
| Scalability (SC1-SC3) | 3 | Horizontal, new port = 0 core change, mock→live < 5% delta | ✅ |
| Integration (I1-I5) | 5 | OpenAPI gate, Zalo OA, webhook HMAC, 100% MockAdapter coverage | ✅ |

### Architecture Readiness Assessment

**Overall Status:** ✅ READY FOR IMPLEMENTATION

**Key Strengths:**
1. **Brownfield leverage** — 60-70% infrastructure already built (CQRS, Drizzle, Redis, CB, Fallback)
2. **Port Registry pattern** — scales to 30+ services without modifying core
3. **Resilience-first** — Per-port Circuit Breaker + cache fallback from day one
4. **Contract-driven** — OpenAPI schema gate per port, Zod validation on every mock response
5. **Aggregation-ready** — Promise.allSettled pattern handles partial failures gracefully
6. **Phase-aware** — 14 MVP → +12 Phase 2 → +4 Phase 3, each phase adds ports without breaking existing

---

**Architecture Status:** READY FOR IMPLEMENTATION ✅

**Next Phase:** Begin implementation — Docker Compose → Port Infrastructure → Auth Module.
