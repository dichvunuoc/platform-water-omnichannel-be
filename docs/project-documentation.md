# IOC Customer — Module CSKH: Tài liệu Tổng hợp Dự án

> **Ngày tạo:** 2026-06-12  
> **Loại scan:** Deep Scan  
> **Tác giả:** Mary (Business Analyst) — BMAD Document Project Workflow  
> **Phiên bản:** 1.0.0

---

## Mục lục

1. [Tổng quan Dự án](#1-tổng-quan-dự-án)
2. [Kiến trúc Hệ thống](#2-kiến-trúc-hệ-thống)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema](#4-database-schema)
5. [Module 1: Auth — Xác thực](#5-module-1-auth--xác-thực)
6. [Module 2: Customer — Hồ sơ Khách hàng](#6-module-2-customer--hồ-sơ-khách-hàng)
7. [Module 3: Contract — Hợp đồng](#7-module-3-contract--hợp-đồng)
8. [Module 4: Meter — Đồng hồ nước](#8-module-4-meter--đồng-hồ-nước)
9. [Module 5: Billing — Hóa đơn & Biểu giá](#9-module-5-billing--hóa-đơn--biểu-giá)
10. [Module 6: Payment — Thanh toán](#10-module-6-payment--thanh-toán)
11. [Module 7: Ticket — Phản ánh & Hỗ trợ](#11-module-7-ticket--phản-ánh--hỗ-trợ)
12. [Module 8: Communication — Thông báo](#12-module-8-communication--thông-báo)
13. [Shared Infrastructure](#13-shared-infrastructure)
14. [Hexagonal Port System](#14-hexagonal-port-system)
15. [Cross-Module Interactions](#15-cross-module-interactions)
16. [Thống kê Tổng hợp](#16-thống-kê-tổng-hợp)
17. [Danh sách Port đã đăng ký](#17-danh-sách-port-đã-đăng-ký)
18. [Danh sách TODO & Stub (Epic 7+)](#18-danh-sách-todo--stub-epic-7)

---

## 1. Tổng quan Dự án

| Thuộc tính | Giá trị |
|---|---|
| **Tên dự án** | IOC Customer — Module CSKH (Trạm Điều phối Trung tâm) |
| **Loại** | Backend — API Gateway & Orchestrator (BFF) |
| **Domain** | Utility (cấp nước) / Govtech |
| **Rule #1** | CSKH module KHÔNG BAO GIỜ sở hữu business logic. Chỉ coordinate, route, transform. |
| **Repository** | Monolith (đơn khối) |
| **Kiến trúc** | DDD/CQRS + Hexagonal Ports |
| **File nguồn** | 466 TypeScript files |
| **Modules nghiệp vụ** | 8 modules |
| **API Endpoints** | 38 endpoints |
| **Test Files** | ~30+ spec files |

### Nguồn tham chiếu chính

| Tài liệu | Vị trí |
|---|---|
| Project Context (bible) | `_bmad-output/project-context.md` |
| Architecture | `_bmad-output/planning-artifacts/architecture.md` |
| PRD | `_bmad-output/planning-artifacts/prd.md` |
| Epics | `_bmad-output/planning-artifacts/epics.md` |
| Product Brief | `_bmad-output/planning-artifacts/product-brief-IOC-Customer-2026-06-02.md` |

---

## 2. Kiến trúc Hệ thống

### Request Lifecycle

```
Client Request
  → CorrelationIdMiddleware (tạo/gắn correlation ID, thiết lập RequestContext)
  → AuthPropagationMiddleware (ký JWT cho downstream identity propagation)
  → SessionAuthGuard (xác thực session qua better-auth, gắn request.user)
  → Controller (validate input via Zod → dispatch CQRS Command/Query)
  → CommandHandler/QueryHandler (thực thi logic)
  → PortRegistry (chọn adapter mock/live + cache + circuit breaker)
    → Cache check (Redis, theo tier: static/dynamic/transaction)
    → Circuit Breaker state check (CLOSED/HALF_OPEN/OPEN)
    → PortHttpClient (HTTP call với JWT + correlation ID + idempotency key)
    → Fallback (nếu CB OPEN → trả cached data + degraded metadata)
  → Response về Client
```

### 3 Pattern xử lý chính

| Pattern | Mô tả | Module sử dụng |
|---|---|---|
| **Pass-through** | Handler chỉ gọi PortRegistry, không có logic bổ sung | Contract, Billing, Customer Profile query, Debt queries |
| **BFF-Computed** | Lấy data downstream + tính toán UI flags tại BFF | Meter (`isWarning`, `percentageChange`, `direction`) |
| **Orchestration** | Nhiều bước tuần tự với guard logic + side effects | Payment (verify → pay), Webhooks (idempotency → cache invalidation → notification) |

### Module Internal Structure (DDD/CQRS)

```
src/modules/{module}/
├── domain/
│   ├── entities/          # Aggregate roots
│   ├── events/            # {Entity}{Action}Event
│   ├── repositories/      # Interfaces only
│   ├── services/          # Domain services
│   └── value-objects/
├── application/
│   ├── commands/          # + handlers/ subdirectory
│   ├── queries/           # + handlers/ + ports/ subdirectories
│   └── dtos/
├── infrastructure/
│   ├── http/              # Controllers
│   ├── persistence/       # drizzle/schema/, read/, write/
│   └── ports/             # Hexagonal port adapters
├── constants/
│   └── tokens.ts
└── {module}.module.ts
```

---

## 3. Technology Stack

| Technology | Version | Purpose |
|---|---|---|
| NestJS | ^11.0.1 | Framework + Fastify adapter |
| TypeScript | ^5.7.3 | Language (strict mode) |
| Bun | 1.1 | Runtime + package manager |
| Drizzle ORM | ^0.45.1 | PostgreSQL ORM |
| PostgreSQL | 16 | Primary DB (CSKH-owned: Users, Tickets) |
| Redis | 7 (AOF) | Session store + API cache |
| better-auth | ≥ 1.3.8 | Centralized auth + RBAC |
| jose | ^6.2.3 | JWT signing for Backend propagation |
| Pino | ^10.1 | Structured logging |
| pino-redact | latest | PII masking in logs (Nghị định 13) |
| Zod | ^4.2.1 | Schema validation |
| OpenTelemetry | ^0.208 | Distributed tracing |
| Jest | ^30.0 | Testing |
| Swagger | ^11.2.3 | API documentation |

---

## 4. Database Schema

### CSKH-owned Tables (Drizzle ORM)

| Table | Module | Columns chính | Mô tả |
|---|---|---|---|
| `users` | Auth | id, email, phone, name, role (enum), status (enum), createdAt, updatedAt | Thông tin user |
| `provider_links` | Auth | id, userId, providerType (enum), providerId, providerEmail, isVerified | Liên kết OAuth provider |
| `sessions` | Auth | (better-auth managed) | Phiên đăng nhập |
| `verifications` | Auth | (better-auth managed) | OTP verification records |
| `outbox` | Shared | id, eventType, payload, status (enum), createdAt, processedAt | Transactional outbox pattern |

### Enums

- `userRoleEnum`: customer, admin, agent
- `userStatusEnum`: active, suspended, deactivated
- `providerTypeEnum`: phone, zalo, google, facebook, apple
- `outboxStatusEnum`: pending, published, failed

### Redis Keys

| Pattern | TTL | Purpose |
|---|---|---|
| `session:{userId}` | Session TTL | Session data |
| `session:{userId}:events` | Session TTL | Session event timeline |
| `cache:v2:port:{portName}:{hash}` | 0-43200s | API response cache |
| `cb:{endpoint}` | — | Circuit breaker state |
| `idempotency:{hash}` | 24h | Idempotency check |
| `ratelimit:notification:{userId}:{channel}:{date}` | 24h | Rate limiting |

---

## 5. Module 1: Auth — Xác thực

### Domain Model

- **User** (Aggregate Root): email, phone, name, role (UserRole VO), status (UserStatus VO), providers[]
- **ProviderLink** (Child Entity): providerType (ProviderType VO), providerId, providerEmail, isVerified
- **Domain Events**: `UserRegisteredEvent`, `ProviderLinkedEvent`

### API Endpoints

| Method | Route | Auth | Mô tả |
|---|---|---|---|
| POST | `/auth/register-phone` | Public | Đăng ký/đăng nhập bằng SĐT — gửi OTP |
| POST | `/auth/verify-otp` | Public | Xác thực OTP |
| POST | `/auth/provider/callback` | Public | OAuth callback (Zalo, Google, Facebook, Apple) |
| POST | `/auth/link-provider` | JWT | Liên kết thêm provider cho user đã xác thực |
| GET | `/auth/me` | JWT | Lấy profile user hiện tại |
| * | `/api/auth/*` | better-auth | Internal better-auth routes |

### SessionAuthGuard (Global Guard)

```
Mọi request → SessionAuthGuard.canActivate()
  1. Kiểm tra @Public() decorator → nếu có, bỏ qua guard
  2. Gọi better-auth.api.getSession({ headers }) 
  3. Nếu session hợp lệ → gắn request.user = { id, sessionId }
  4. Nếu không → throw UnauthorizedException
```

### Đặc điểm

- better-auth quản lý local auth tables (users, sessions, provider_links, verifications)
- PII encryption at-rest qua `PiiEncryptionService`
- SessionAuthGuard đăng ký as `APP_GUARD` (global)
- `@Public()` decorator cho phép bypass guard (dùng cho webhook endpoints)
- `@CurrentUser('id')` decorator trích userId từ request.user

---

## 6. Module 2: Customer — Hồ sơ Khách hàng

### API Endpoints

| Method | Route | Auth | Mô tả | AC |
|---|---|---|---|---|
| GET | `/customers/profile` | JWT | Hồ sơ 360° khách hàng | AC#1 |
| GET | `/customers/timeline` | JWT | Timeline tương tác khách hàng | AC#2 |
| GET | `/customers/related-accounts` | JWT | Cây quan hệ KCN | AC#4 |
| PUT | `/customers/profile` | JWT | Cập nhật thông tin liên hệ | AC#3 |

### Handler Detail

**GetCustomerProfileHandler** — Pass-through:
```
PortRegistry.execute('customer-profile', 'get-profile', { customerId })
→ Cache tier: static (12h)
```

**UpdateCustomerProfileHandler** — 3 bước Orchestration:
```
1. Update downstream: PortRegistry.execute('customer-profile', 'update-profile', data)
2. Invalidate cache: cacheService.delete(cache:v2:port:customer-profile:{hash})
3. Re-fetch: PortRegistry.execute('customer-profile', 'get-profile')
→ Trả fresh profile về frontend
```

### CQRS Operations

| Type | Name | Purpose |
|---|---|---|
| Query | `GetCustomerProfileQuery` | Lấy hồ sơ 360° |
| Query | `GetCustomerTimelineQuery` | Lấy timeline tương tác |
| Query | `GetRelatedAccountsQuery` | Lấy cây quan hệ KCN |
| Command | `UpdateCustomerProfileCommand` | Cập nhật thông tin + cache invalidation |

---

## 7. Module 3: Contract — Hợp đồng

### API Endpoints

| Method | Route | Auth | Mô tả | AC |
|---|---|---|---|---|
| GET | `/contracts` | JWT | Danh sách hợp đồng (có filter) | AC#1 |
| GET | `/contracts/:contractId` | JWT | Chi tiết hợp đồng | AC#2 |
| GET | `/contracts/:contractId/versions` | JWT | Lịch sử phiên bản | AC#3 |
| GET | `/contracts/:contractId/pdf` | JWT | Tải PDF hợp đồng | AC#4 |

### Handler Detail — Tất cả Pass-through, Read-only

| Handler | Port | Method | Cache |
|---|---|---|---|
| `GetContractsHandler` | `'contract'` | `'get-list'` | static (12h) |
| `GetContractDetailHandler` | `'contract'` | `'get-by-id'` | static (12h) |
| `GetContractVersionsHandler` | `'contract'` | `'get-versions'` | static (12h) |
| `GetContractPdfHandler` | `'contract'` | `'get-pdf'` | static (12h) |

### Validation

- `contractId`: alphanumeric, dashes, underscores (Zod schema `ContractIdParamSchema`)
- Query params: filter via `ContractQuerySchema`

---

## 8. Module 4: Meter — Đồng hồ nước

### API Endpoints

| Method | Route | Auth | Mô tả | AC |
|---|---|---|---|---|
| GET | `/meters` | JWT | Danh sách đồng hồ (1 KH : N đồng hồ) | AC#1 |
| GET | `/meters/consumption` | JWT | Lịch sử tiêu thụ 12 tháng | Story 3.1 AC#1 |
| GET | `/meters/consumption/comparison` | JWT | So sánh tiêu thụ 2 kỳ | Story 3.1 AC#2 |
| GET | `/meters/consumption/:period` | JWT | Chi tiết chỉ số + ảnh bằng chứng | Story 3.1 AC#3 |
| GET | `/meters/:meterId/calibration` | JWT | Trạng thái kiểm định + isWarning | AC#2 |
| GET | `/meters/:meterId/history` | JWT | Lịch sử thay thế/sửa chữa | AC#3 |

### Handler Detail

**GetCalibrationStatusHandler** — BFF-Computed Pattern:
```typescript
// 1. Lấy raw calibration từ downstream
const raw = await portRegistry.execute('meter', 'get-calibration-status', params);
// 2. BFF tính toán UI flag (presentation logic, KHÔNG phải business rule)
const isWarning = raw.status === 'expiring_soon' || raw.status === 'expired';
// 3. Return enriched response
return { ...raw, isWarning };
```

**GetReadingComparisonHandler** — BFF-Computed Pattern:
```typescript
// 1. Lấy raw volumes từ downstream
const { currentVolume, previousVolume } = await portRegistry.execute('meter-reading', 'get-comparison', params);
// 2. BFF tính percentageChange + direction
const percentageChange = previousVolume === 0
  ? null  // edge case: chia cho 0
  : Math.round(((currentVolume - previousVolume) / previousVolume * 100) * 100) / 100;
const direction = percentageChange === null ? 'neutral'
  : percentageChange > 0 ? 'up' : percentageChange < 0 ? 'down' : 'neutral';
// 3. Return enriched response
return { ...raw, percentageChange, direction };
```

**4 Handlers còn lại** — Pass-through:
| Handler | Port | Method |
|---|---|---|
| `GetMeterByCustomerHandler` | `'meter'` | `'get-by-customer'` |
| `GetMeterHistoryHandler` | `'meter'` | `'get-history'` |
| `GetReadingsHandler` | `'meter-reading'` | `'get-readings'` |
| `GetReadingDetailHandler` | `'meter-reading'` | `'get-reading-detail'` |

### Validation

- `meterId`: alphanumeric, dashes, underscores (IoT/device IDs)
- `period`: YYYY-MM format
- Comparison: cả `current` và `previous` phải là YYYY-MM

---

## 9. Module 5: Billing — Hóa đơn & Biểu giá

### API Endpoints

**Tariff Controller** (`/billing/tariff`):

| Method | Route | Auth | Mô tả | AC |
|---|---|---|---|---|
| GET | `/billing/tariff/:contractId` | JWT | Biểu giá bậc thang | AC#1 |
| GET | `/billing/tariff/:contractId/breakdown?invoiceId=X` | JWT | Chi tiết bậc thang theo hóa đơn | AC#2 |
| GET | `/billing/tariff/:contractId/fees` | JWT | Phí áp dụng (BVMT, VAT, phụ phí) | AC#3 |

**Invoice Controller** (`/billing/invoices`):

| Method | Route | Auth | Mô tả | AC |
|---|---|---|---|---|
| GET | `/billing/invoices?month&status&page&limit` | JWT | Danh sách hóa đơn (phân trang) | AC#1 |
| GET | `/billing/invoices/:invoiceId` | JWT | Chi tiết hóa đơn + line items + mã CQT | AC#2 |
| GET | `/billing/invoices/:invoiceId/pdf` | JWT | Tải PDF hóa đơn điện tử | AC#3 |

### Handler Detail — Tất cả Pass-through, Read-only

**Tariff Handlers** (Port: `'tariff'`):

| Handler | Method | Cache |
|---|---|---|
| `GetTariffPlanHandler` | `'get-plan'` | static (12h) |
| `GetTariffBreakdownHandler` | `'get-breakdown'` | static (12h) |
| `GetApplicableFeesHandler` | `'get-fees'` | static (12h) |

**Invoice Handlers** (Port: `'invoice'`):

| Handler | Method | Cache |
|---|---|---|
| `GetInvoiceListHandler` | `'get-list'` | dynamic (15m) |
| `GetInvoiceDetailHandler` | `'get-by-id'` | dynamic (15m) |
| `GetInvoicePdfHandler` | `'get-pdf'` | dynamic (15m) |

---

## 10. Module 6: Payment — Thanh toán

### API Endpoints

**Payment Controller** (`/payments`):

| Method | Route | Auth | Mô tả | AC |
|---|---|---|---|---|
| POST | `/payments` | JWT | Tạo thanh toán → QR/link | AC#1 |
| POST | `/payments/batch` | JWT | Thanh toán nhiều hóa đơn 1 lần | AC#2 |
| POST | `/payments/auto-debit` | JWT | Đăng ký trừ tự động | AC#1 |
| GET | `/payments/history?page&limit&status` | JWT | Lịch sử thanh toán | AC#1 |

**Debt Controller** (`/payments/debt`):

| Method | Route | Auth | Mô tả | AC |
|---|---|---|---|---|
| GET | `/payments/debt` | JWT | Công nợ tồn đọng + aging buckets | AC#1 |
| GET | `/payments/debt/history` | JWT | Lịch sử công nợ | AC#2 |

**Webhook Controller** (`/webhooks/payment`):

| Method | Route | Auth | Mô tả | AC |
|---|---|---|---|---|
| POST | `/webhooks/payment/ipn` | API Key (`x-api-key`) | IPN từ Payment Service | AC#1 |

### Handler Detail

**CreatePaymentHandler** — 2 bước Orchestration:
```
1. Verify invoice: portRegistry.execute('invoice', 'get-by-id', { useCache: false })
   → Guard: invoice tồn tại?
   → Guard: paymentStatus === 'unpaid'?
   → Nếu không → throw NotFoundException / ForbiddenException
2. Create payment: portRegistry.execute('payment', 'create-payment', { amount })
   → Transaction tier: KHÔNG cache (FR35 — must call live 100%)
→ Trả QR code / payment link
```

**CreateBatchPaymentHandler** — Sequential Verification + Accumulation:
```
1. For EACH invoiceId:
   - Verify: portRegistry.execute('invoice', 'get-by-id', { useCache: false })
   - Guard: tồn tại + paymentStatus === 'unpaid'
   - Accumulate: totalAmount += invoice.totalAmount
   → Nếu BẤT KỲ invoice nào lỗi → reject cả batch (atomic)
2. Create batch: portRegistry.execute('payment', 'create-batch-payment', { totalAmount })
→ Trả single QR code cho nhiều hóa đơn
```

**HandlePaymentWebhookHandler** — Idempotency + Cache + Notification:
```
1. Idempotency: idempotencyService.getExisting(paymentId)
   → Duplicate → return { processed: false, status: 'duplicate' }
2. Nếu success:
   a. Pattern cache invalidation:
      - cacheService.deleteByPattern('cache:v2:port:invoice:*')
      - cacheService.deleteByPattern('cache:v2:port:debt:*')
   b. Session event stub (Epic 7)
   c. Dispatch notification: commandBus.execute(new DispatchNotificationCommand(...))
3. Nếu failed:
   a. Log PII-redacted
   b. Dispatch notification: payment_failed
4. Store idempotency: idempotencyService.store(paymentId, result)
```

**SetupAutoDebitHandler** — Pass-through:
```
PortRegistry.execute('payment', 'setup-auto-debit', { customerId, bankAccount })
→ bankAccount auto-redacted bởi pino-redact
→ Transaction tier: KHÔNG cache
```

**Debt Queries** — Pass-through:
- `GetOutstandingDebtHandler`: Port `'debt'`, method `'get-outstanding'`
- `GetDebtHistoryHandler`: Port `'debt'`, method `'get-history'`

### CQRS Summary

| Type | Name | Purpose | Cache Tier |
|---|---|---|---|
| Command | `CreatePaymentCommand` | Verify invoice + tạo thanh toán | Transaction |
| Command | `CreateBatchPaymentCommand` | Verify nhiều invoice + batch payment | Transaction |
| Command | `SetupAutoDebitCommand` | Đăng ký trừ tự động | Transaction |
| Command | `HandlePaymentWebhookCommand` | Xử lý IPN webhook | N/A |
| Query | `GetPaymentHistoryQuery` | Lịch sử thanh toán | Dynamic |
| Query | `GetOutstandingDebtQuery` | Công nợ + aging | Dynamic |
| Query | `GetDebtHistoryQuery` | Lịch sử công nợ | Dynamic |

---

## 11. Module 7: Ticket — Phản ánh & Hỗ trợ

### API Endpoints

**Ticket Controller** (`/tickets`):

| Method | Route | Auth | Mô tả | AC |
|---|---|---|---|---|
| POST | `/tickets` | JWT | Tạo phản ánh/sự cố | AC#1,#3,#4 |
| POST | `/tickets/upload-url` | JWT | Lấy presigned URL upload ảnh | AC#2 |
| GET | `/tickets` | JWT | Lịch sử ticket (phân trang) | AC#2 |
| GET | `/tickets/:trackingId` | JWT | Tra cứu trạng thái + timeline | AC#1 |
| POST | `/tickets/:trackingId/feedback` | JWT | Gửi CSAT feedback (1-5) | AC#1,#2 |

**Knowledge Base Controller** (`/knowledge-base`):

| Method | Route | Auth | Mô tả | AC |
|---|---|---|---|---|
| GET | `/knowledge-base/categories` | JWT | Danh mục FAQ | AC#1 |
| GET | `/knowledge-base/search?q&category&page&pageSize` | JWT | Tìm kiếm bài viết (pass-through) | AC#2 |
| GET | `/knowledge-base/articles/:articleId` | JWT | Chi tiết bài viết | AC#3 |
| POST | `/knowledge-base/articles/:articleId/rate` | JWT | Đánh giá helpful/not helpful | AC#4 |

**Ticket Webhook** (`/webhooks/ticket`):

| Method | Route | Auth | Mô tả | AC |
|---|---|---|---|---|
| POST | `/webhooks/ticket/status` | API Key (`x-api-key`) | Thông báo thay đổi trạng thái | AC#3 |

### Handler Detail

**CreateTicketHandler** — Pass-through:
```
PortRegistry.execute('ticket', 'create-ticket', {
  customerId, type, description, imageUrls,
  priority: 'normal',  // default priority
  useCache: false
})
→ TODO: Record session event (Epic 7)
```

**SubmitFeedbackHandler** — Pass-through + Low CSAT Flagging:
```
1. PortRegistry.execute('ticket', 'submit-feedback', { score, comment })
2. Nếu score < 3 (CSAT_LOW_SCORE_THRESHOLD):
   → Log warning: "Low CSAT alert — flagged for follow-up"
   → TODO: Record session event (Epic 7)
```

**HandleTicketWebhookHandler** — Giống pattern Payment Webhook:
```
1. Idempotency check → getExisting(ticketId)
2. Cache invalidation: deleteByPattern('cache:v2:port:ticket:*')
3. Session event stub (Epic 7)
4. Dispatch notification: ticket_status_changed
5. Store idempotency result
```

**Knowledge Base Handlers** — Tất cả Pass-through:
- `GetKbCategoriesHandler`: Port `'knowledge-base'`, method `'get-categories'`
- `SearchArticlesHandler`: Port `'knowledge-base'`, method `'search'`
- `GetArticleHandler`: Port `'knowledge-base'`, method `'get-article'`
- `RateArticleHandler`: Port `'knowledge-base'`, method `'rate'`

> **CRITICAL**: BFF KHÔNG xử lý tiếng Việt. Mọi Vietnamese text processing là downstream KB Service responsibility.

### CQRS Summary

| Type | Name | Purpose |
|---|---|---|
| Command | `CreateTicketCommand` | Tạo ticket + default priority |
| Command | `GetUploadUrlCommand` | Presigned URL cho photo upload |
| Command | `SubmitFeedbackCommand` | CSAT feedback + low score flagging |
| Command | `HandleTicketWebhookCommand` | Xử lý status change webhook |
| Command | `RateArticleCommand` | Đánh giá bài viết KB |
| Query | `GetTicketHistoryQuery` | Lịch sử ticket (phân trang) |
| Query | `GetTicketStatusQuery` | Trạng thái + timeline |
| Query | `GetKbCategoriesQuery` | Danh mục FAQ |
| Query | `SearchArticlesQuery` | Tìm kiếm bài viết |
| Query | `GetArticleQuery` | Chi tiết bài viết |

---

## 12. Module 8: Communication — Thông báo

### API Endpoints

**Proactive Notification Controller** (`/proactive-notifications`):

| Method | Route | Auth | Mô tả | AC |
|---|---|---|---|---|
| GET | `/proactive-notifications/active` | JWT | Cảnh báo đang hoạt động trong khu vực | AC#1 |
| GET | `/proactive-notifications/history` | JWT | Lịch sử cảnh báo (có filter) | AC#2 |
| POST | `/proactive-notifications/:alertId/acknowledge` | JWT | Xác nhận đã đọc cảnh báo | AC#3 |

**Notification Controller** (`/notifications`):

| Method | Route | Auth | Mô tả | AC |
|---|---|---|---|---|
| GET | `/notifications/preferences` | JWT | Cài đặt thông báo | AC#1 |
| PATCH | `/notifications/preferences` | JWT | Cập nhật cài đặt thông báo | AC#2 |
| GET | `/notifications/history` | JWT | Lịch sử thông báo (phân trang) | AC#3 |

### Handler Detail

**DispatchNotificationHandler** — Central Funnel với Fallback Chain:
```
1. Xác định target channel (default: 'zns') + fallback chain
2. For each channel trong fallback chain (ZNS → Push → In-App):
   a. Rate check: RedisRateLimiterService.check(userId, channel)
   b. Nếu allowed → PortRegistry.execute('notification', 'dispatch-notification')
      → Return { dispatched: true, channel }
   c. Nếu rate limited → thử channel tiếp theo
3. Tất cả channels exhausted:
   → Critical: Log ERROR (không nên xảy ra vì in_app = ∞)
   → Non-critical: DROP + audit log
```

**RedisRateLimiterService** — Channel Limits:

| Channel | Giới hạn | Key Pattern |
|---|---|---|
| ZNS | 2 msg/KH/day | `ratelimit:notification:{userId}:zns:{date}` |
| Push | 50/day | `ratelimit:notification:{userId}:push:{date}` |
| SMS | 10/day | `ratelimit:notification:{userId}:sms:{date}` |
| Email | 20/day | `ratelimit:notification:{userId}:email:{date}` |
| In-App | ∞ (no limit) | N/A |

- Fallback chain: `ZNS → Push → In-App`
- Atomic Redis INCR cho concurrent safety
- TTL 24h, set on first increment

### CQRS Summary

| Type | Name | Purpose |
|---|---|---|
| Command | `DispatchNotificationCommand` | Central notification dispatch (rate limit + fallback) |
| Command | `AcknowledgeAlertCommand` | Xác nhận đã đọc cảnh báo |
| Command | `UpdateNotificationPreferencesCommand` | Cập nhật cài đặt thông báo |
| Query | `GetActiveAlertsQuery` | Cảnh báo đang hoạt động |
| Query | `GetAlertHistoryQuery` | Lịch sử cảnh báo |
| Query | `GetNotificationPreferencesQuery` | Cài đặt thông báo |
| Query | `GetNotificationHistoryQuery` | Lịch sử thông báo |

---

## 13. Shared Infrastructure

### Core Library (`src/libs/core/`)

| Thành phần | File | Mô tả |
|---|---|---|
| `AggregateRoot` | `domain/entities/aggregate-root.ts` | Base entity + domain events + OCC (Optimistic Concurrency Control) |
| `BaseEntity` | `domain/entities/base.entity.ts` | Entity cơ sở: id, createdAt, updatedAt |
| `BaseValueObject` | `domain/value-objects/base.value-object.ts` | Value Object: immutable, equality by value |
| `ICommandBus` | `application/commands/interfaces/` | CQRS command bus interface |
| `IQueryBus` | `application/queries/interfaces/` | CQRS query bus interface |
| `ICommand`, `IQuery` | `application/` | CQRS command/query interfaces |
| `ICommandHandler`, `IQueryHandler` | `application/` | Handler interfaces |
| `IProjection` | `application/projections/` | Event → read model projection |
| `IUnitOfWork` | `infrastructure/persistence/` | Transaction boundary interface |
| `Exceptions` | `common/exceptions/` | NotFoundException, ForbiddenException, BusinessRuleException, ValidationException, DomainException, ConflictException, ConcurrencyException, UnauthorizedException |
| `DOMAIN_EVENTS` | `constants/tokens.ts` | DI tokens: COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN, DATABASE_WRITE_TOKEN, etc. |

### Shared Library (`src/libs/shared/`)

| Thành phần | Mô tả |
|---|---|
| **CQRS Buses** | `NestCommandBus`, `NestQueryBus` — wrap NestJS CQRS |
| **Database** | Drizzle ORM + PostgreSQL + Unit of Work (DrizzleUnitOfWork) + Outbox Pattern |
| **Resilience** | Circuit Breaker (per-port, state machine: CLOSED/HALF_OPEN/OPEN), Retry decorator, Fallback provider |
| **Security** | `InterServiceApiKeyGuard` (static API key), `SessionAuthGuard` (better-auth), `RateLimiterGuard`, Audit Logger |
| **Auth Propagation** | `AuthPropagationMiddleware` + `JwtSignerService` (jose) — ký JWT 1 lần/request, cached cho fan-out |
| **Observability** | OpenTelemetry (Jaeger + Prometheus) + Pino structured logging + PII redaction (pino-redact) |
| **Context** | `CorrelationIdMiddleware` + `RequestContextProvider` — correlation ID trong mọi log + downstream call |
| **Endpoint Config** | `EndpointConfigService` — YAML-based config (mock/live switching, cache tiers, timeouts, CB settings) |
| **Caching** | `RedisCacheService` (primary) + `MemoryCacheService` (fallback) — get/set/delete/deleteByPattern/incr |
| **Idempotency** | `IdempotencyService` — inbound + outbound (Redis-backed, 24h TTL) |
| **Health** | `/health` endpoint — DB + Redis + Port health indicators |
| **Port System** | `PortRegistry` + `PortHttpClient` + `InternalAdapterBase` + `MockAdapterBase` |

---

## 14. Hexagonal Port System

### Port Registry Execution Flow

```
PortRegistry.execute<T>(portName, method, params, idempotencyKey?)
  │
  ├─ Step 1: Chọn adapter (3-level priority)
  │   ├─ MOCK_MODE=true → mockAdapter
  │   ├─ YAML adapter field = 'mock' → mockAdapter  
  │   └─ Default → liveAdapter
  │
  ├─ Step 2: Check inbound idempotency (nếu có key)
  │   → idempotencyService.check(key) → hit → return cached result
  │
  ├─ Step 3: Check cache (bỏ qua nếu transaction tier)
  │   → Key: cache:v2:port:{portName}:{sha256(method+params)}
  │   → Hit → return { data, fromCache: true, metadata: { cachedAt } }
  │
  ├─ Step 4: Check Circuit Breaker state
  │   ├─ OPEN + shouldAttemptReset() → HALF_OPEN probe (cho phép 1 request)
  │   ├─ OPEN → return fallback (cached data + degraded metadata)
  │   └─ CLOSED / HALF_OPEN → tiếp tục execute
  │
  ├─ Step 5: Execute via adapter
  │   └─ PortHttpClient.request():
  │       ├─ JWT injection (cached từ AuthPropagationMiddleware — tránh re-sign khi fan-out)
  │       ├─ x-correlation-id header
  │       ├─ x-idempotency-key cho POST/PUT
  │       ├─ AbortController timeout (default 3000ms)
  │       ├─ 401 → regenerate JWT → retry once
  │       ├─ 401 retry also fail → throw PortDownstreamException(401)
  │       ├─ Timeout → throw PortTimeoutException
  │       └─ Other error → throw PortDownstreamException(statusCode)
  │
  ├─ Step 6: Post-processing (fire-and-forget — KHÔNG ảnh hưởng CB)
  │   ├─ Cache result: cacheService.set(cacheKey, { data, cachedAt }, ttl)
  │   ├─ Store fallback cache: fallbackProvider.setCached(portName, data)
  │   └─ Store idempotency: idempotencyService.store(key, data)
  │
  └─ Return: PortResult<T> {
       data: T,
       adapterUsed: 'mock' | 'live',
       fromCache: boolean,
       duration: number,
       metadata?: { cachedAt?, degraded?, message?, fromIdempotency? }
     }
```

### Circuit Breaker Details

- Per-port instances (KHÔNG dùng single CB cho tất cả)
- State machine: `CLOSED → OPEN → HALF_OPEN → CLOSED`
- Error filter: chỉ đếm 5xx/timeout (4xx KHÔNG trip CB)
- Fallback: cache-based (data cached từ lần successful call cuối)
- Config per port: errorThreshold, resetTimeout, minRequests

### Port HttpClient Error Handling

```
2xx → return data
401 (first) → regenerate JWT → retry once
401 (retry) → throw PortDownstreamException(401, "Session expired")
403 → throw PortDownstreamException(403) — NO retry
404 → throw PortDownstreamException(404)
4xx → throw PortDownstreamException(statusCode)
5xx → Circuit Breaker counts failure → fallback to cache
Timeout → throw PortTimeoutException → Circuit Breaker counts failure
```

---

## 15. Cross-Module Interactions

```
┌─────────────────────────────────────────────────────────────────┐
│                     Payment Module                               │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │ CreatePaymentHandler │───→│ Invoice Port (Billing Module) │   │
│  │ (verify invoice)     │    │ portRegistry.execute('invoice')│  │
│  └──────────┬───────────┘    └──────────────────────────────┘   │
│             │                                                    │
│  ┌──────────▼───────────┐    ┌──────────────────────────────┐   │
│  │ HandlePaymentWebhook │───→│ Communication Module          │   │
│  │ (cache invalidation  │    │ DispatchNotificationCommand   │   │
│  │  + notification)     │    │ → rate limit → fallback chain │   │
│  └──────────────────────┘    └──────────────────────────────┘   │
│                                                                  │
│  Cache invalidation targets:                                     │
│  • cache:v2:port:invoice:*  (Billing)                           │
│  • cache:v2:port:debt:*     (Payment)                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     Ticket Module                                │
│  ┌──────────────────────────┐   ┌───────────────────────────┐  │
│  │ HandleTicketWebhook      │──→│ Communication Module       │  │
│  │ (cache invalidation      │   │ DispatchNotificationCommand│  │
│  │  + notification)         │   │ type: ticket_status_changed│  │
│  └──────────────────────────┘   └───────────────────────────┘  │
│                                                                  │
│  Cache invalidation targets:                                     │
│  • cache:v2:port:ticket:*                                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     Global Middleware                            │
│  CorrelationIdMiddleware → AuthPropagationMiddleware             │
│  SessionAuthGuard → @CurrentUser() decorator                     │
│  → Mọi authenticated request đi qua Auth Module                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 16. Thống kê Tổng hợp

| Chỉ số | Giá trị |
|---|---|
| **Tổng API Endpoints** | 38 |
| **Public Endpoints** | 4 (auth register/verify/callback + better-auth) |
| **Webhook Endpoints** | 2 (Payment IPN, Ticket Status) |
| **Commands (Write)** | 13 |
| **Queries (Read)** | 25 |
| **Domain Entities** | 2 (User, ProviderLink) |
| **Domain Events** | 2 (UserRegistered, ProviderLinked) |
| **Guards** | 3 (SessionAuthGuard, InterServiceApiKeyGuard, RateLimiterGuard) |
| **DB Tables (CSKH-owned)** | 5 |
| **Redis Key Patterns** | 6 |
| **Hexagonal Ports** | 12 |
| **Test Files (*.spec.ts)** | ~30+ |
| **Source Files (.ts)** | 466 |

### Pattern Distribution

| Pattern | # Handlers | Modules |
|---|---|---|
| Pass-through | ~20 | Contract, Billing, Customer query, Meter (4/6), Debt, KB |
| BFF-Computed | 2 | Meter (calibration, comparison) |
| Orchestration | 5 | Customer update, Payment (create/batch/webhook), Ticket webhook |
| Fallback Chain | 1 | Communication (dispatch notification) |

---

## 17. Danh sách Port đã đăng ký

| Port Name | Module | Cache Tier | TTL (s) | Timeout | CB Threshold |
|---|---|---|---|---|---|
| `customer-profile` | Customer | static | 43200 | 3000ms | 50% |
| `contract` | Contract | static | 43200 | 3000ms | 50% |
| `meter` | Meter | dynamic | 900 | 3000ms | 50% |
| `meter-reading` | Meter | dynamic | 900 | 3000ms | 50% |
| `tariff` | Billing | static | 43200 | 3000ms | 50% |
| `invoice` | Billing | dynamic | 900 | 3000ms | 50% |
| `payment` | Payment | **transaction** | **0** | 3000ms | 50% |
| `debt` | Payment | dynamic | 900 | 3000ms | 50% |
| `ticket` | Ticket | dynamic | 900 | 3000ms | 50% |
| `knowledge-base` | Ticket | static | 43200 | 3000ms | 50% |
| `notification` | Communication | **transaction** | **0** | 3000ms | 50% |
| `proactive-notification` | Communication | dynamic | 900 | 3000ms | 50% |

### Cache TTL Strategy

| Tier | TTL | Use Case | Examples |
|---|---|---|---|
| **Static** | 12-24h | Data ít thay đổi | Customer profile, contracts, tariff plans, KB articles |
| **Dynamic** | 5-15 min | Data thay đổi thường xuyên | Invoices, tickets, meters, alerts |
| **Transaction** | **NO CACHE** | Must call live 100% | Payments, notifications |

---

## 18. Danh sách TODO & Stub (Epic 7+)

### Session Event Stubs (chờ Epic 7)

| Location | Stub |
|---|---|
| `HandlePaymentWebhookHandler` | `[SESSION EVENT STUB] payment_completed` |
| `HandleTicketWebhookHandler` | `[SESSION EVENT STUB] ticket_status_changed` |
| `CreateTicketHandler` | `TODO: Record session event — ticket_created` |
| `SubmitFeedbackHandler` | `TODO: Record session event — ticket_flagged_low_csat` |
| `DispatchNotificationHandler` | `[SESSION EVENT STUB] notification_sent` |

### Backend API Integration TODOs

| Location | TODO |
|---|---|
| `AuthController.verifyOtp` | `TODO: Wire to better-auth's verify-phone endpoint` |
| `AuthController.providerCallback` | `TODO: Sync customer to Backend API` |
| `AuthController.linkProvider` | `TODO: Sync provider link to Backend API` |
| `AuthController.getMe` | `TODO: Fetch full profile from Backend API` |

### Upcoming Epics

| Epic | Nội dung | Status |
|---|---|---|
| Epic 7 | Session Store + Event Recording (Lua atomic script) | Prep done (schema + spike docs) |
| Epic 8+ | Zalo Adapter, Hotline Integration | Planned |

---

*Tài liệu này được tạo tự động bởi BMAD Document Project Workflow — Deep Scan.*
*Last updated: 2026-06-12*
