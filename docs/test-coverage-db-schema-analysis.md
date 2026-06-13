# IOC Customer — Test Coverage & Database Schema Analysis

> **Ngày tạo:** 2026-06-12  
> **Loại phân tích:** Deep Analysis  
> **Tác giả:** Mary (Business Analyst) — BMAD

---

## Mục lục

1. [Test Coverage Tổng quan](#1-test-coverage-tổng-quan)
2. [Test Coverage Chi tiết từng Module](#2-test-coverage-chi-tiết-từng-module)
3. [Test Quality Assessment](#3-test-quality-assessment)
4. [Test Coverage Gaps (Thiếu sót)](#4-test-coverage-gaps-thiếu-sót)
5. [Database Schema Chi tiết](#5-database-schema-chi-tiết)
6. [Entity Relationship Diagram](#6-entity-relationship-diagram)
7. [PII Encryption Strategy](#7-pii-encryption-strategy)
8. [Khuyến nghị](#8-khuyến-nghị)

---

## 1. Test Coverage Tổng quan

### Thống kê

| Chỉ số | Giá trị |
|---|---|
| **Tổng source files (.ts)** | 466 |
| **Tổng spec files (.spec.ts)** | 91 |
| **Spec/Source ratio** | ~19.5% |
| **Test categories** | 6 loại (xem dưới) |

### Phân loại Test Files theo Layer

| Layer | # Spec Files | Mô tả |
|---|---|---|
| **Domain** | 6 | Entity + Value Object unit tests |
| **Application — Handlers** | 36 | CQRS handler unit tests |
| **Infrastructure — Controllers** | 12 | HTTP controller unit tests |
| **Infrastructure — Ports** | 11 | Port adapter unit tests |
| **Infrastructure — Guards/Security** | 2 | Auth guard + API key guard |
| **Shared Libraries** | 8 | Core infrastructure tests |
| **Communication — DTO/Rate Limiter** | 2 | DTO validation + rate limiter |
| **Auth — Persistence** | 1 | PII encryption |

### Coverage Heatmap theo Module

| Module | Domain | Handlers | Controllers | Ports | Guards | Total Spec |
|---|---|---|---|---|---|---|
| **Auth** | ✅ 5 files | — | — | ✅ 1 | ✅ 2 | **8** |
| **Customer** | — | ✅ 4 | ✅ 1 | ✅ 1 | — | **6** |
| **Contract** | — | ✅ 4 | ✅ 1 | ✅ 1 | — | **6** |
| **Meter** | — | ✅ 6 | ✅ 1 | ✅ 2 | — | **9** |
| **Billing** | — | ✅ 6 | ✅ 2 | ✅ 2 | — | **10** |
| **Payment** | — | ✅ 7 | ✅ 3 | ✅ 2 | — | **12** |
| **Ticket** | — | ✅ 8 | ✅ 3 | ✅ 3 | — | **14** |
| **Communication** | — | ✅ 7 | ✅ 2 | ✅ 2 | — | **12** |
| **Shared Libs** | — | — | — | — | ✅ 1 | **8** |
| **TOTAL** | **5** | **42** | **13** | **14** | **3** | **91** |

> **Ghi chú**: ✅ = có test, — = không áp dụng hoặc không cần (module không có layer đó)

---

## 2. Test Coverage Chi tiết từng Module

### Module Auth — 8 spec files

| File | Loại | Mô tả |
|---|---|---|
| `user.entity.spec.ts` | Domain | Test User aggregate: register, addProvider (duplicate guard), linkPhone, reconstitute, domain events |
| `provider-link.entity.spec.ts` | Domain | Test ProviderLink: create, reconstitute, markVerified |
| `provider-type.value-object.spec.ts` | Domain | Test ProviderType VO: valid values, invalid throws |
| `user-role.value-object.spec.ts` | Domain | Test UserRole VO: valid roles, invalid throws |
| `user-status.value-object.spec.ts` | Domain | Test UserStatus VO: valid statuses, invalid throws |
| `session-auth.guard.spec.ts` | Guard | Test global guard: valid session → attach user, invalid → 401, @Public bypass |
| `current-user.decorator.spec.ts` | Decorator | Test @CurrentUser() parameter extraction |
| `pii-encryption.service.spec.ts` | Persistence | Test AES-256-GCM encrypt/decrypt, HMAC blind index, search |

**Chất lượng**: CAO — Domain entity tests cover invariants (duplicate provider guard, VO validation), domain events verification

### Module Customer — 6 spec files

| File | Loại | Mô tả |
|---|---|---|
| `get-customer-profile.handler.spec.ts` | Handler | Test pass-through query via PortRegistry |
| `get-customer-timeline.handler.spec.ts` | Handler | Test timeline query |
| `get-related-accounts.handler.spec.ts` | Handler | Test KCN relationship query |
| `update-customer-profile.handler.spec.ts` | Handler | Test 3-step orchestration: update → invalidate → re-fetch |
| `customer.controller.spec.ts` | Controller | Test HTTP validation, Zod, CQRS dispatch |
| `customer-profile.port.spec.ts` | Port | Test mock/live adapter |

**Chất lượng**: CAO — Update handler test covers cache invalidation pattern + re-fetch verification

### Module Contract — 6 spec files

| File | Loại | Mô tả |
|---|---|---|
| `get-contracts.handler.spec.ts` | Handler | Test list query with filters |
| `get-contract-detail.handler.spec.ts` | Handler | Test detail query |
| `get-contract-versions.handler.spec.ts` | Handler | Test version history |
| `get-contract-pdf.handler.spec.ts` | Handler | Test PDF URL query |
| `contract.controller.spec.ts` | Controller | Test validation (contractId format) |
| `contract.port.spec.ts` | Port | Test adapter |

**Chất lượng**: TRUNG BÌNH — Pass-through handlers, tests mainly verify port call params

### Module Meter — 9 spec files

| File | Loại | Mô tả |
|---|---|---|
| `get-meter-by-customer.handler.spec.ts` | Handler | Test list query |
| `get-calibration-status.handler.spec.ts` | Handler | **Test BFF-computed isWarning** (valid/expiring_soon/expired) |
| `get-meter-history.handler.spec.ts` | Handler | Test history query |
| `get-readings.handler.spec.ts` | Handler | Test consumption history |
| `get-reading-comparison.handler.spec.ts` | Handler | **Test BFF percentageChange + direction** (including edge case: divide by zero) |
| `get-reading-detail.handler.spec.ts` | Handler | Test period detail |
| `meter.controller.spec.ts` | Controller | Test all 6 endpoints + validation |
| `meter.port.spec.ts` | Port | Test meter adapter |
| `meter-reading.port.spec.ts` | Port | Test meter-reading adapter |

**Chất lượng**: CAO — BFF-computed logic tests cover all branches (valid/expiring_soon/expired, up/down/neutral/null)

### Module Billing — 10 spec files

| File | Loại | Mô tả |
|---|---|---|
| `get-tariff-plan.handler.spec.ts` | Handler | Test tariff plan query |
| `get-tariff-breakdown.handler.spec.ts` | Handler | Test breakdown query |
| `get-applicable-fees.handler.spec.ts` | Handler | Test fees query |
| `get-invoice-list.handler.spec.ts` | Handler | Test paginated list |
| `get-invoice-detail.handler.spec.ts` | Handler | Test detail query |
| `get-invoice-pdf.handler.spec.ts` | Handler | Test PDF URL |
| `tariff.controller.spec.ts` | Controller | Test tariff endpoints + contractId validation |
| `invoice.controller.spec.ts` | Controller | Test invoice endpoints + query validation |
| `tariff.port.spec.ts` | Port | Test tariff adapter |
| `invoice.port.spec.ts` | Port | Test invoice adapter |

**Chất lượng**: TRUNG BÌNH — All pass-through, test coverage is structural

### Module Payment — 12 spec files (PHỨC TẠP NHẤT)

| File | Loại | Mô tả |
|---|---|---|
| `create-payment.handler.spec.ts` | Handler | **Test 2-step orchestration**: verify invoice (unpaid/paid/overdue/cancelled) → create payment, useCache:false |
| `create-batch-payment.handler.spec.ts` | Handler | **Test sequential verification**: verify ALL invoices → accumulate total → batch create |
| `handle-payment-webhook.handler.spec.ts` | Handler | **Test idempotency + cache invalidation + notification**: success/failed/duplicate flows, PII redaction |
| `setup-auto-debit.handler.spec.ts` | Handler | Test auto-debit registration |
| `get-payment-history.handler.spec.ts` | Handler | Test paginated history |
| `get-outstanding-debt.handler.spec.ts` | Handler | Test debt with aging |
| `get-debt-history.handler.spec.ts` | Handler | Test debt history |
| `payment.controller.spec.ts` | Controller | Test all 4 endpoints + Zod validation |
| `webhook.controller.spec.ts` | Controller | **Test webhook guard** (InterServiceApiKeyGuard) + payload validation |
| `debt.controller.spec.ts` | Controller | Test debt endpoints |
| `payment.port.spec.ts` | Port | Test payment adapter |
| `debt.port.spec.ts` | Port | Test debt adapter |

**Chất lượng**: RẤT CAO — Webhook handler test is exemplary:
- ✅ Success flow: cache invalidation (invoice + debt), notification dispatch, session event
- ✅ Failed flow: no cache invalidation, PII redacted log, notification dispatch
- ✅ Duplicate/idempotency: no reprocessing, no cache invalidation, no notification
- ✅ Error resilience: notification failure doesn't block webhook result
- ✅ Payment creation: invoice status guards (paid/overdue/cancelled/not-found)
- ✅ useCache:false verification for transaction safety

### Module Ticket — 14 spec files

| File | Loại | Mô tả |
|---|---|---|
| `create-ticket.handler.spec.ts` | Handler | Test ticket creation + default priority |
| `get-upload-url.handler.spec.ts` | Handler | Test presigned URL generation |
| `submit-feedback.handler.spec.ts` | Handler | **Test CSAT feedback + low score flagging** (< 3) |
| `handle-ticket-webhook.handler.spec.ts` | Handler | Test idempotency + cache invalidation + notification (giống payment webhook) |
| `get-ticket-status.handler.spec.ts` | Handler | Test status + timeline query |
| `get-ticket-history.handler.spec.ts` | Handler | Test paginated history |
| `get-kb-categories.handler.spec.ts` | Handler | Test FAQ categories |
| `search-articles.handler.spec.ts` | Handler | Test article search |
| `get-article.handler.spec.ts` | Handler | Test article detail |
| `rate-article.handler.spec.ts` | Handler | Test article rating |
| `ticket.controller.spec.ts` | Controller | Test all 5 endpoints |
| `ticket-webhook.controller.spec.ts` | Controller | **Test webhook guard + payload validation** |
| `knowledge-base.controller.spec.ts` | Controller | Test KB endpoints |
| `ticket.port.spec.ts` + `knowledge-base.port.spec.ts` + `document.port.spec.ts` | Port | Test 3 port adapters |

**Chất lượng**: CAO — CSAT feedback test covers low-score threshold, webhook test follows same pattern as payment

### Module Communication — 12 spec files

| File | Loại | Mô tả |
|---|---|---|
| `dispatch-notification.handler.spec.ts` | Handler | **Test fallback chain**: ZNS allowed → dispatch, ZNS rate limited → try Push → try In-App |
| `acknowledge-alert.handler.spec.ts` | Handler | Test acknowledgement |
| `update-notification-preferences.handler.spec.ts` | Handler | Test preference update |
| `get-notification-preferences.handler.spec.ts` | Handler | Test preference query |
| `get-notification-history.handler.spec.ts` | Handler | Test notification history |
| `get-active-alerts.handler.spec.ts` | Handler | Test active alerts |
| `get-alert-history.handler.spec.ts` | Handler | Test alert history |
| `proactive-notification.controller.spec.ts` | Controller | Test alert endpoints |
| `notification.controller.spec.ts` | Controller | Test notification preference/history endpoints |
| `notification.port.spec.ts` | Port | Test notification adapter |
| `proactive-notification.port.spec.ts` | Port | Test alert adapter |
| `redis-rate-limiter.service.spec.ts` | Rate Limiter | **Test channel limits**: ZNS(2), Push(50), SMS(10), in_app(∞), TTL management |
| `notification-preferences.dto.spec.ts` | DTO | Test Zod schema validation |

**Chất lượng**: RẤT CAO — Rate limiter tests cover all channels + TTL management + fallback chain

### Shared Libraries — 8 spec files

| File | Loại | Mô tả |
|---|---|---|
| `port-registry.service.spec.ts` | Core | **Test full port lifecycle**: register, mock/live adapter, cache hit/miss, CB open/fallback, idempotency, YAML priority |
| `port-http-client.service.spec.ts` | Core | Test JWT injection, 401 retry, timeout, correlation ID |
| `mock-adapter.base.spec.ts` | Core | Test mock adapter base class |
| `aggregation.service.spec.ts` | Core | Test fan-out aggregation |
| `inbound-idempotency.service.spec.ts` | Core | Test inbound idempotency |
| `endpoint-config.service.spec.ts` | Core | Test YAML config loading |
| `jwt-signer.service.spec.ts` | Auth | Test JWT signing via jose |
| `auth-propagation.middleware.spec.ts` | Auth | Test JWT caching per request |
| `inter-service-api-key.guard.spec.ts` | Security | Test API key validation |
| `structured-logger.service.spec.ts` | Observability | Test structured logging |

**Chất lượng**: RẤT CAO — PortRegistry test is comprehensive: 30+ test cases covering all ACs

---

## 3. Test Quality Assessment

### Test Patterns Used

| Pattern | Ví dụ | Đánh giá |
|---|---|---|
| **AAA (Arrange-Act-Assert)** | Tất cả handlers | ✅ Consistent |
| **Mock PortRegistry** | `jest.fn()` trên execute | ✅ Proper isolation |
| **BFF logic branches** | calibration: valid/expiring_soon/expired | ✅ Full branch coverage |
| **Guard testing** | invoice paid/overdue/cancelled/not-found | ✅ All rejection paths |
| **Idempotency testing** | duplicate webhook → no reprocessing | ✅ Critical for correctness |
| **Error resilience** | notification failure doesn't block webhook | ✅ Fault tolerance verified |
| **PII redaction** | log spy checks for `[REDACTED]` | ✅ Compliance verified |
| **Cache verification** | `useCache: false` cho transaction tier | ✅ Cache strategy tested |
| **Edge cases** | divide by zero (percentageChange), duplicate provider | ✅ Boundary testing |

### Test Quality Ratings

| Module | Rating | Lý do |
|---|---|---|
| Auth | ⭐⭐⭐⭐⭐ | Domain invariants + VO validation + guard + PII encryption |
| Customer | ⭐⭐⭐⭐ | Cache invalidation pattern well tested |
| Contract | ⭐⭐⭐ | Pass-through only, structural coverage |
| Meter | ⭐⭐⭐⭐⭐ | BFF-computed logic with full branch coverage |
| Billing | ⭐⭐⭐ | Pass-through only, structural coverage |
| Payment | ⭐⭐⭐⭐⭐ | Orchestration + guards + idempotency + error resilience |
| Ticket | ⭐⭐⭐⭐ | CSAT flagging + webhook pattern |
| Communication | ⭐⭐⭐⭐⭐ | Fallback chain + rate limiter per channel + TTL |
| Shared (PortRegistry) | ⭐⭐⭐⭐⭐ | 30+ tests covering all acceptance criteria |

---

## 4. Test Coverage Gaps (Thiếu sót)

### ❌ Không có Tests (Missing)

| Component | Module | Rủi ro |
|---|---|---|
| `better-auth.setup.ts` | Auth | Trung bình — better-auth config chưa test |
| `auth.module.ts` | Auth | Thấp — DI wiring |
| `ZaloOAuthProvider` | Auth | **CAO** — OAuth flow chưa test |
| `AuthPropagationMiddleware` | Shared | Thấp — đã có jwt-signer test |
| `CorrelationIdMiddleware` | Shared | Thấp — simple middleware |
| `LoggingModule` | Shared | Thấp — Pino setup |
| `ResponseInterceptor` | Shared | Thấp — response wrapper |
| `GlobalExceptionFilter` | Shared | **TRUNG BÌNH** — error format chưa test |
| `ValidationPipe` | Shared | Thấp — Zod wrapper |
| `OutboxProcessor` | Shared | **CAO** — async event processing chưa test |
| `OutboxRepository` | Shared | **TRUNG BÌNH** — DB operations chưa test |
| `DrizzleUnitOfWork` | Shared | **CAO** — transaction management chưa test |
| `BaseAggregateRepository` | Shared | **TRUNG BÌNH** — generic CRUD chưa test |
| `RedisCacheService` | Shared | **TRUNG BÌNH** — Redis operations chưa test |
| `MemoryCacheService` | Shared | Thấp — fallback cache |
| `CircuitBreakerState` | Shared | **TRUNG BÌNH** — state machine logic chưa test isolation |
| `RetryDecorator` | Shared | Thấp — simple retry |
| `FallbackProvider` | Shared | Thấp — tested via PortRegistry |
| `EndpointConfigService` YAML loading | Shared | Đã có test nhưng chỉ basic |
| `HealthModule` endpoints | Shared | Thấp — health check |

### ⚠️ Cần Test Thêm (Weak Coverage)

| Component | Vấn đề | Khuyến nghị |
|---|---|---|
| `CreateBatchPaymentHandler` spec | Cần test: empty invoiceIds, partial batch failure | Thêm edge case tests |
| `DispatchNotificationHandler` spec | Cần test: all channels exhausted for critical, port returns null | Thêm resilience tests |
| `GetReadingComparisonHandler` spec | Cần test: negative volumes, both zero | Thêm boundary tests |
| Controller specs (all) | Chủ yếu test validation, chưa test Auth guard integration | Thêm integration tests |
| `PortHttpClient` spec | Chưa test: actual HTTP call (fetch mock), JSON parse error | Cần deeper mocking |
| No E2E tests found | Chưa có file e2e nào trong src/modules/ | Cần setup E2E test suite |

### 📊 Coverage Gap Priority

| Priority | Component | Action |
|---|---|---|
| 🔴 P0 | `DrizzleUnitOfWork` test | Critical cho data consistency |
| 🔴 P0 | `RedisCacheService` test | Critical cho caching layer |
| 🔴 P0 | `OutboxProcessor` test | Critical cho event reliability |
| 🟡 P1 | `ZaloOAuthProvider` test | Quan trọng cho OAuth flow |
| 🟡 P1 | `CircuitBreakerState` isolated test | Quan trọng cho resilience |
| 🟡 P1 | E2E test suite setup | Cần cho regression testing |
| 🟢 P2 | `GlobalExceptionFilter` test | Nice to have |
| 🟢 P2 | `BaseAggregateRepository` test | Generic, tested via domain |
| 🟢 P2 | `better-auth.setup` test | External lib, low priority |

---

## 5. Database Schema Chi tiết

### Tổng quan

CSKH module sở hữu **5 bảng** trong PostgreSQL, quản lý qua Drizzle ORM:

```
┌─────────────────────────────────────────────────────────┐
│                    CSKH PostgreSQL Database               │
│                                                          │
│  ┌──────────┐     ┌──────────────────┐                  │
│  │  users    │────→│ provider_links    │                  │
│  │ (root)    │ 1:N │ (child entity)   │                  │
│  └────┬─────┘     └──────────────────┘                  │
│       │                                                  │
│       │ 1:N    ┌──────────────────┐                     │
│       ├───────→│ sessions         │                     │
│       │        │ (better-auth)    │                     │
│       │        └──────────────────┘                     │
│       │                                                  │
│  ┌────┴─────┐                                           │
│  │verification│  (OTP tokens, standalone)               │
│  └──────────┘                                           │
│                                                          │
│  ┌──────────┐                                           │
│  │  outbox  │  (Transactional Outbox Pattern)           │
│  └──────────┘                                           │
└─────────────────────────────────────────────────────────┘
```

### Table 1: `users` — Khách hàng Identity

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(512),           -- AES-256-GCM encrypted (NOT searchable)
  phone       VARCHAR(512),           -- AES-256-GCM encrypted (NOT searchable)
  email_hash  VARCHAR(64),            -- HMAC-SHA256 blind index (searchable)
  phone_hash  VARCHAR(64),            -- HMAC-SHA256 blind index (searchable)
  name        VARCHAR(255),
  role        user_role DEFAULT 'customer',  -- ENUM: customer, admin
  status      user_status DEFAULT 'active',  -- ENUM: active, suspended, deleted
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Unique blind indexes for lookup
CREATE UNIQUE INDEX idx_users_phone_hash ON users(phone_hash);
CREATE UNIQUE INDEX idx_users_email_hash ON users(email_hash);
```

**TypeScript Types:**
```typescript
type UserRecord = {
  id: string; email: string | null; phone: string | null;
  emailHash: string | null; phoneHash: string | null;
  name: string | null; role: 'customer' | 'admin';
  status: 'active' | 'suspended' | 'deleted';
  createdAt: Date | null; updatedAt: Date | null;
};
type NewUserRecord = { /* insert type, id auto-generated */ };
```

**Đặc điểm:**
- PII fields (email, phone) encrypted at-rest với AES-256-GCM + random IV
- Blind index (HMAC-SHA256) cho searchable queries: `WHERE phone_hash = hmac_sha256(input, secret)`
- Unique indexes trên hash columns → prevents duplicate registrations
- Role/Status enforced qua Drizzle pgEnum + Domain Value Objects

### Table 2: `provider_links` — Liên kết OAuth Provider

```sql
CREATE TABLE provider_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_type   provider_type NOT NULL,  -- ENUM: phone, zalo, google, facebook, apple
  provider_id     VARCHAR(255) NOT NULL,   -- phone number, Zalo ID, social sub
  provider_email  VARCHAR(255),            -- from social OAuth
  is_verified     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- One provider type+id can only be linked to one user
CREATE UNIQUE INDEX idx_provider_links_type_id ON provider_links(provider_type, provider_id);
```

**Đặc điểm:**
- `ON DELETE CASCADE`: xóa user → xóa tất cả provider links
- Composite unique index: (provider_type, provider_id) → prevents account hijacking
- Hỗ trợ cross-provider account linking (1 user : N providers)

### Table 3: `sessions` — Phiên đăng nhập (better-auth)

```sql
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(512) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  ip_address  VARCHAR(255),
  user_agent  VARCHAR(1024),
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Đặc điểm:**
- Managed entirely by better-auth
- Cookie-based sessions, configurable TTL (7-day refresh token)
- Tracks IP + User Agent cho audit/security
- `ON DELETE CASCADE`: xóa user → xóa tất cả sessions

### Table 4: `verification` — OTP & Email Verification (better-auth)

```sql
CREATE TABLE verification (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier  VARCHAR(255) NOT NULL,  -- phone number or email
  value       VARCHAR(255) NOT NULL,  -- OTP code or token
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_verification_identifier ON verification(identifier);
```

**Đặc điểm:**
- Used by better-auth `phoneNumber` plugin cho OTP-based auth
- `identifier` = SĐT hoặc email đang xác thực
- `value` = OTP code hoặc verification token
- Index trên identifier cho fast lookup khi verify OTP

### Table 5: `outbox` — Transactional Outbox Pattern

```sql
CREATE TABLE outbox (
  id              VARCHAR(36) PRIMARY KEY,       -- UUID
  aggregate_id    VARCHAR(36) NOT NULL,          -- Aggregate that produced event
  aggregate_type  VARCHAR(100) NOT NULL,         -- e.g., 'Product', 'Order'
  event_type      VARCHAR(100) NOT NULL,         -- e.g., 'ProductCreated'
  payload         TEXT NOT NULL,                  -- JSON string
  status          outbox_status DEFAULT 'PENDING', -- ENUM: PENDING, PROCESSING, PROCESSED, FAILED
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT
);

CREATE INDEX idx_outbox_status_created ON outbox(status, created_at);
CREATE INDEX idx_outbox_aggregate ON outbox(aggregate_id);
CREATE INDEX idx_outbox_event_type ON outbox(event_type);
```

**Đặc điểm:**
- Implements Transactional Outbox Pattern cho reliable event publishing
- Events saved in same transaction as aggregate → at-least-once delivery
- `OutboxProcessor` polls PENDING events asynchronously
- 3 indexes: status+created (polling), aggregate_id (query by entity), event_type (filter)
- Retry tracking: `retry_count` + `last_error` cho failed events
- Status flow: `PENDING → PROCESSING → PROCESSED` (hoặc `FAILED`)

---

## 6. Entity Relationship Diagram

```
                    ┌─────────────────────────┐
                    │         users           │
                    │─────────────────────────│
                    │ *id (UUID, PK)          │
                    │  email (AES-256 encrypted)│
                    │  phone (AES-256 encrypted)│
                    │  email_hash (HMAC blind) │
                    │  phone_hash (HMAC blind) │
                    │  name                   │
                    │  role (customer|admin)   │
                    │  status (active|suspended│
                    │         |deleted)        │
                    │  created_at             │
                    │  updated_at             │
                    └──────────┬──────────────┘
                               │
                    ┌──────────┼──────────────────┐
                    │ 1:N      │ 1:N               │
                    ▼          ▼                    │
     ┌──────────────────┐  ┌──────────────────┐   │
     │ provider_links   │  │   sessions       │   │
     │──────────────────│  │──────────────────│   │
     │ *id (UUID, PK)   │  │ *id (UUID, PK)   │   │
     │  user_id (FK)    │  │  user_id (FK)    │   │
     │  provider_type   │  │  token           │   │
     │    (phone|zalo|  │  │  expires_at      │   │
     │     google|fb|   │  │  ip_address      │   │
     │     apple)       │  │  user_agent      │   │
     │  provider_id     │  │  is_active       │   │
     │  provider_email  │  │  created_at      │   │
     │  is_verified     │  │  updated_at      │   │
     │  created_at      │  └──────────────────┘   │
     │                  │                          │
     │ UNIQUE:          │  ┌──────────────────┐   │
     │ (type, id)       │  │  verification    │   │
     └──────────────────┘  │──────────────────│   │
                           │ *id (UUID, PK)   │   │
                           │  identifier      │   │
                           │  value (OTP)     │   │
                           │  expires_at      │   │
                           │  created_at      │   │
                           │  updated_at      │   │
                           │                  │   │
                           │ IDX: identifier  │   │
                           └──────────────────┘   │
                                                   │
                    ┌─────────────────────────┐   │
                    │         outbox          │   │
                    │─────────────────────────│   │
                    │ *id (VARCHAR, PK)       │   │
                    │  aggregate_id           │   │
                    │  aggregate_type         │   │
                    │  event_type             │   │
                    │  payload (JSON)         │   │
                    │  status (PENDING|       │   │
                    │    PROCESSING|PROCESSED │   │
                    │    |FAILED)             │   │
                    │  created_at             │   │
                    │  processed_at           │   │
                    │  retry_count            │   │
                    │  last_error             │   │
                    │                         │   │
                    │ IDX: status+created_at  │   │
                    │ IDX: aggregate_id       │   │
                    │ IDX: event_type         │   │
                    └─────────────────────────┘   │
```

### Enums

```typescript
// Drizzle pgEnum definitions
userRoleEnum    = ['customer', 'admin']
userStatusEnum  = ['active', 'suspended', 'deleted']
providerTypeEnum = ['phone', 'zalo', 'google', 'facebook', 'apple']
outboxStatusEnum = ['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED']
```

---

## 7. PII Encryption Strategy

### Threat Model

Theo **Nghị định 13/2023/NĐ-CP** (Vietnam data protection), PII phải được bảo vệ at-rest.

### Implementation

```
┌────────────────────────────────────────────────────────┐
│                   PII Protection Flow                   │
│                                                         │
│  Write:                                                 │
│  plaintext phone ──→ AES-256-GCM(random_iv, key)       │
│                   ──→ store encrypted in 'phone' column │
│                   ──→ HMAC-SHA256(phone, secret)        │
│                   ──→ store hash in 'phone_hash' column │
│                                                         │
│  Lookup:                                                │
│  input phone ──→ HMAC-SHA256(input, secret)             │
│              ──→ WHERE phone_hash = computed_hash       │
│              ──→ decrypt 'phone' column → return plain  │
│                                                         │
│  Security Properties:                                   │
│  ✅ AES-256-GCM: authenticated encryption               │
│  ✅ Random IV: same plaintext → different ciphertext    │
│  ✅ HMAC blind index: searchable without decrypting     │
│  ✅ Separate keys: encryption key ≠ HMAC key            │
│  ❌ Direct query on email/phone: IMPOSSIBLE (encrypted) │
└────────────────────────────────────────────────────────┘
```

### PII Fields Protected

| Field | Table | Encryption | Blind Index |
|---|---|---|---|
| `email` | users | AES-256-GCM | `email_hash` (HMAC-SHA256) |
| `phone` | users | AES-256-GCM | `phone_hash` (HMAC-SHA256) |
| `token` | sessions | — (managed by better-auth) | — |
| `value` | verification | — (short-lived OTP) | — |

### PII Redaction in Logs (pino-redact)

```typescript
// Mandatory redact paths — EVERY Pino instance
redact: {
  paths: [
    '*.phone', '*.phoneNumber', '*.soDienThoai',
    '*.cccd', '*.cccdNumber',
    '*.address', '*.diaChi',
    '*.password', '*.token', '*.secret',
    '*.refreshToken', '*.accessToken',
  ],
  censor: '[REDACTED]',
}
```

---

## 8. Khuyến nghị

### Test Coverage — Priority Actions

| # | Action | Priority | Effort |
|---|---|---|---|
| 1 | Add `DrizzleUnitOfWork` tests (commit/rollback) | 🔴 P0 | Medium |
| 2 | Add `RedisCacheService` tests (get/set/delete/incr/TTL) | 🔴 P0 | Medium |
| 3 | Add `OutboxProcessor` tests (poll/process/retry) | 🔴 P0 | Medium |
| 4 | Add `ZaloOAuthProvider` tests | 🟡 P1 | Medium |
| 5 | Add E2E test setup (supertest + test DB) | 🟡 P1 | High |
| 6 | Add `CircuitBreakerState` isolated tests | 🟡 P1 | Low |
| 7 | Add `GlobalExceptionFilter` tests | 🟢 P2 | Low |
| 8 | Add edge case tests cho batch payment (empty list) | 🟢 P2 | Low |
| 9 | Run `bun run test:cov` để có số liệu coverage % | 🟢 P2 | Low |

### Database Schema — Recommendations

| # | Action | Priority | Rationale |
|---|---|---|---|
| 1 | Add `updated_at` trigger cho auto-update | 🟡 P1 | Drizzle không auto-update updatedAt |
| 2 | Consider migration cho Epic 7 session tables | 🔴 P0 | `session_events` table cần thiết |
| 3 | Add `provider_links.updated_at` column | 🟢 P2 | Hiện chỉ có `created_at` |
| 4 | Consider soft-delete cho users (status='deleted') | ✅ Done | Đã có trong enum |
| 5 | Add index on `sessions.user_id` | 🟡 P1 | Lookup sessions by user |

### Data không thuộc CSKH (Backend API owns)

> **Quan trọng**: Các bảng sau KHÔNG thuộc CSKH database. Chúng được gọi qua Port Registry từ Backend API:

| Data | Source | Cache |
|---|---|---|
| Customer profiles | Backend API | static (12h) |
| Contracts | Backend API | static (12h) |
| Meters | Backend API | dynamic (15m) |
| Meter readings | Backend API | dynamic (15m) |
| Tariff plans | Backend API | static (12h) |
| Invoices | Backend API | dynamic (15m) |
| Payments | Payment Service | **NO CACHE** (transaction) |
| Debts | Backend API | dynamic (15m) |
| Tickets | Ticketing Service | dynamic (15m) |
| Knowledge Base | KB Service | static (12h) |
| Notifications | Notification Service | **NO CACHE** (transaction) |
| Alerts | Backend API | dynamic (15m) |

---

*Tài liệu này được tạo bởi BMAD Document Project Workflow — Deep Analysis.*
*Last updated: 2026-06-12*
