# Story 4.5: Debt Overview & History

Status: done

## Story

As a **customer (Anh Tuấn)**,
I want to see what I owe, how overdue it is, and my full debt history,
so that I can prioritize which bills to pay first.

## Acceptance Criteria

### AC1: Outstanding Debt with Aging Buckets (FR39)
**Given** an authenticated customer navigates to "My Debt"
**When** the BFF receives the request
**Then** it calls `IDebtPort.getOutstandingDebt(customerId)` via PortRegistry
**And** returns: total outstanding amount, broken down by aging bucket (0-30 days, 31-60 days, 61-90 days, >90 days)
**And** each debt entry includes: invoice reference, amount, due date, aging bucket.

### AC2: Debt History (FR40)
**Given** an authenticated customer navigates to "Debt History"
**When** the BFF receives the request
**Then** it calls `IDebtPort.getDebtHistory(customerId)` via PortRegistry
**And** returns a chronological list of all debt records with payment status.

### AC3: Dynamic Cache Tier
**Given** debt data is fetched successfully
**When** the response is cached
**Then** the cache key follows `cache:v2:port:debt:{hash}` with TTL 5-15 min (dynamic tier).

### AC4: Cache Invalidation on Payment (Cross-Story)
**Given** a payment webhook is received (Story 4.2)
**When** the BFF processes a successful payment
**Then** all debt cache keys for that customer are purged via pattern `cache:v2:port:debt:*`.

## Tasks / Subtasks

- [x] Task 1: Create Debt Port Interface & Mock Adapter (AC: #1, #2)
  - [x] Create `src/modules/payment/infrastructure/ports/debt.port.ts`
  - [x] Define `IDebtPort` interface extending `IPortAdapter`
  - [x] Create `MockDebtAdapter extends MockAdapterBase implements IDebtPort`
  - [x] Register schemas: `get-outstanding-debt`, `get-debt-history`
  - [x] Add `DEBT_PORT_TOKEN` to `src/modules/payment/constants/tokens.ts`

- [x] Task 2: Create Debt DTOs (AC: #1, #2)
  - [x] Create `src/modules/payment/application/dtos/debt.dto.ts`
  - [x] Zod schemas: `AgingBucketSchema` (enum), `DebtEntrySchema` (invoiceRef, amount, dueDate, agingBucket, daysOverdue)
  - [x] Zod schemas: `OutstandingDebtResponseSchema` (totalAmount, agingBreakdown, debts array)
  - [x] Zod schemas: `DebtHistoryEntrySchema`, `DebtHistoryResponseSchema` (chronological list)

- [x] Task 3: Create Mock Data Files (AC: #1, #2)
  - [x] Create `mocks/debt/get-outstanding-debt.json` — realistic debt with multiple aging buckets
  - [x] Create `mocks/debt/get-debt-history.json` — chronological debt records

- [x] Task 4: Create CQRS Queries & Handlers (AC: #1, #2)
  - [x] Create `get-outstanding-debt.query.ts` + handler — returns `OutstandingDebtResponse` with aging
  - [x] Create `get-debt-history.query.ts` + handler — returns `DebtHistoryResponse`
  - [x] Each handler: inject `PortRegistry`, call `execute('debt', method, params)`

- [x] Task 5: Add Controller Endpoints (AC: all)
  - [x] Create `src/modules/payment/infrastructure/http/debt.controller.ts`
  - [x] `GET /payments/debt` → dispatch `GetOutstandingDebtQuery`
  - [x] `GET /payments/debt/history` → dispatch `GetDebtHistoryQuery`

- [x] Task 6: Update Payment Module (AC: all)
  - [x] Update `src/modules/payment/payment.module.ts` — add `MockDebtAdapter`, `DebtController`, query handlers
  - [x] Register `debt` port with PortRegistry in `onModuleInit`
  - [x] Note: `debt` is a SEPARATE port in api-endpoints.yaml from `payment`

- [x] Task 7: Update Webhook Handler for Debt Cache Invalidation (AC: #4)
  - [x] Update `handle-payment-webhook.handler.ts` (Story 4.2) — add `deleteByPattern('cache:v2:port:debt:*')` alongside invoice purge
  - [x] Both invoice AND debt cache are invalidated on successful payment

- [x] Task 8: Write comprehensive tests (AC: all)
  - [x] `debt.port.spec.ts` — Mock adapter reads JSON + Zod validates both methods
  - [x] `get-outstanding-debt.handler.spec.ts` — Verify PortRegistry call + aging breakdown
  - [x] `get-debt-history.handler.spec.ts` — Verify chronological response
  - [x] `debt.controller.spec.ts` — Both endpoints, auth guard, query class types
  - [x] Updated `handle-payment-webhook.handler.spec.ts` — debt cache purge test (AC#4)

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story **extends the existing `payment` module** with a **SECOND port** (`debt`). Same "two ports, one module" pattern as Stories 3.2+3.3 (billing module) and 2.3+3.1 (meter module).

#### ⚡ New Port, Same Module — Two Ports Pattern

```
modules/payment/
  └── infrastructure/ports/
      ├── payment.port.ts    ← Stories 4.1-4.4 (transaction tier — NO CACHE)
      └── debt.port.ts       ← Story 4.5 (dynamic tier — 5-15 min cache)
```

Both ports register separately with PortRegistry:

```typescript
onModuleInit() {
  this.portRegistry.register('payment', this.mockPaymentAdapter, this.mockPaymentAdapter);
  this.portRegistry.register('debt', this.mockDebtAdapter, this.mockDebtAdapter);  // NEW
}
```

#### ⚡ Debt Port — Different Cache Tier from Payment

The `debt` port has **different cache behavior** from the `payment` port:

```yaml
debt:
  adapter: mock
  timeout: 3000
  cacheTier: dynamic      # ← CACHED (5-15 min) — unlike payment which is transaction
  cacheTtl: 900
  circuitBreaker: { errorThreshold: 50, resetTimeout: 10000, minRequests: 5 }
```

**Why cached?** Debt overview is a READ-only aggregation — it's fine to cache for 5-15 min. Payment operations are WRITES — never cached.

#### ⚡ Cache Invalidation — Cross-Story Update

Story 4.2's `HandlePaymentWebhookHandler` must be updated to also purge debt cache on successful payment:

```typescript
// In HandlePaymentWebhookHandler, after existing invoice cache purge:
await this.cacheService.deleteByPattern('cache:v2:port:debt:*');
```

This ensures debt data refreshes immediately after a payment succeeds.

#### BFF-Computed Aging Buckets

The downstream API likely returns raw debt entries with due dates. The BFF handler computes **aging buckets** for the frontend:

```
daysOverdue = now - dueDate (in days)
→ 0-30 days   → "current"
→ 31-60 days  → "31-60"
→ 61-90 days  → "61-90"
→ >90 days    → ">90"
```

This follows the same BFF-computed presentation pattern as `isWarning` (Story 2.3) and `percentageChange` (Story 3.1).

**However:** If the downstream already returns aging buckets, the handler is a pure pass-through. The Zod schema should accept either approach — check the mock data structure.

#### What ALREADY EXISTS — DO NOT REINVENT

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **PaymentModule** | `src/modules/payment/payment.module.ts` | **EXTEND** — add debt port + controller + handlers |
| **HandlePaymentWebhookHandler** | Story 4.2 | **UPDATE** — add debt cache purge on payment success |
| **deleteByPattern** | Story 4.2 (added to ICacheService) | **REUSE** — same pattern-based purge for debt cache |
| **BillingModule** | Story 3.3 | **TEMPLATE** — two ports, one module pattern |
| **MeterModule** | Story 3.1 | **TEMPLATE** — added second port to existing module |
| **PortRegistry** | `src/libs/shared/port/port-registry.service.ts` | `register()` + `execute<T>()` |
| **MockAdapterBase** | `src/libs/shared/port/mock-adapter.base.ts` | Extend this |

### 📁 File Structure — Complete Map

```
src/modules/payment/
├── application/
│   ├── commands/ (existing, unchanged)
│   ├── queries/
│   │   ├── get-outstanding-debt.query.ts               ← NEW (AC#1)
│   │   ├── get-debt-history.query.ts                   ← NEW (AC#2)
│   │   ├── handlers/
│   │   │   ├── get-outstanding-debt.handler.ts         ← NEW (AC#1)
│   │   │   └── get-debt-history.handler.ts             ← NEW (AC#2)
│   │   └── index.ts                                    ← NEW (barrel)
│   ├── dtos/
│   │   ├── payment.dto.ts                              ← EXISTS
│   │   └── debt.dto.ts                                 ← NEW
│   └── index.ts                                        ← UPDATE
├── infrastructure/
│   ├── http/
│   │   ├── payment.controller.ts                       ← EXISTS (unchanged)
│   │   ├── webhook.controller.ts                       ← EXISTS (unchanged)
│   │   └── debt.controller.ts                          ← NEW
│   └── ports/
│       ├── payment.port.ts                             ← EXISTS (unchanged)
│       ├── debt.port.ts                                ← NEW
│       └── debt.port.spec.ts                           ← NEW
├── constants/
│   └── tokens.ts                                       ← UPDATE (add DEBT_PORT_TOKEN)
└── payment.module.ts                                   ← UPDATE (add debt port + controller + handlers)

mocks/debt/                                              ← NEW directory
├── get-outstanding-debt.json                            ← NEW
└── get-debt-history.json                                ← NEW

test/integration/
└── debt.spec.ts                                         ← NEW
```

**Modified Files (cross-story):**
- `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.ts` — Add debt cache purge (AC#4)

### 🔧 Implementation Details

#### Debt DTOs

```typescript
// src/modules/payment/application/dtos/debt.dto.ts
import { z } from 'zod';

// =============================================================================
// AC#1: Outstanding Debt with Aging
// =============================================================================

export const AgingBucketSchema = z.enum(['current', '31-60', '61-90', '>90']);

export const DebtEntrySchema = z.object({
  invoiceRef: z.string(),
  amount: z.number().positive(),
  dueDate: z.string(),
  daysOverdue: z.number().int().nonnegative(),
  agingBucket: AgingBucketSchema,
});

export const AgingBreakdownSchema = z.object({
  current: z.number().nonnegative(),   // 0-30 days
  '31-60': z.number().nonnegative(),
  '61-90': z.number().nonnegative(),
  '>90': z.number().nonnegative(),
});

export const OutstandingDebtResponseSchema = z.object({
  totalAmount: z.number().nonnegative(),
  agingBreakdown: AgingBreakdownSchema,
  debts: z.array(DebtEntrySchema),
  totalCount: z.number(),
});

// =============================================================================
// AC#2: Debt History
// =============================================================================

export const DebtHistoryEntrySchema = z.object({
  invoiceRef: z.string(),
  amount: z.number().nonnegative(),
  dueDate: z.string(),
  paidDate: z.string().nullable(),
  status: z.enum(['outstanding', 'paid', 'written_off']),
  agingAtPayment: z.string().nullable(),
});

export const DebtHistoryResponseSchema = z.object({
  entries: z.array(DebtHistoryEntrySchema),
  totalCount: z.number(),
});

// =============================================================================
// TypeScript Types
// =============================================================================

export type AgingBucket = z.infer<typeof AgingBucketSchema>;
export type DebtEntry = z.infer<typeof DebtEntrySchema>;
export type AgingBreakdown = z.infer<typeof AgingBreakdownSchema>;
export type OutstandingDebtResponse = z.infer<typeof OutstandingDebtResponseSchema>;
export type DebtHistoryEntry = z.infer<typeof DebtHistoryEntrySchema>;
export type DebtHistoryResponse = z.infer<typeof DebtHistoryResponseSchema>;
```

#### Debt Port

```typescript
// src/modules/payment/infrastructure/ports/debt.port.ts
import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { OutstandingDebtResponseSchema, DebtHistoryResponseSchema } from '../../application/dtos/debt.dto';

export interface IDebtPort extends IPortAdapter {}

@Injectable()
export class MockDebtAdapter extends MockAdapterBase implements IDebtPort {
  constructor() {
    super(
      'debt',
      {
        'get-outstanding-debt': OutstandingDebtResponseSchema,
        'get-debt-history': DebtHistoryResponseSchema,
      },
      new Logger('debt-mock-adapter'),
    );
  }
}
```

#### Debt Controller

```typescript
// src/modules/payment/infrastructure/http/debt.controller.ts
@ApiTags('Payment — Debt')
@ApiBearerAuth('JWT-auth')
@Controller('payments/debt')
export class DebtController {
  constructor(@Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus) {}

  @Get()
  async getOutstandingDebt(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetOutstandingDebtQuery(userId));
  }

  @Get('history')
  async getDebtHistory(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetDebtHistoryQuery(userId));
  }
}
```

#### Module Update

```typescript
// payment.module.ts — add to constructor:
private readonly mockDebtAdapter: MockDebtAdapter,

// Add to @Module providers:
MockDebtAdapter,
{ provide: DEBT_PORT_TOKEN, useExisting: MockDebtAdapter },
GetOutstandingDebtHandler,
GetDebtHistoryHandler,

// Add to controllers: DebtController

// Add to onModuleInit:
this.portRegistry.register('debt', this.mockDebtAdapter, this.mockDebtAdapter);
```

#### Webhook Handler Update (AC#4)

```typescript
// In HandlePaymentWebhookHandler — add after invoice cache purge:
// AC#4: Also invalidate debt cache (debt data changes after payment)
const debtDeleted = await this.cacheService.deleteByPattern('cache:v2:port:debt:*');
this.logger.log(`Invalidated ${debtDeleted} debt cache keys`);
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Create a new `debt` module | Add `debt` port to existing `payment` module — two ports, one module (per architecture) |
| Cache at transaction tier | Debt uses `cacheTier: dynamic` (5-15 min) — different from payment's transaction tier |
| Forget debt cache invalidation on payment | Update Story 4.2's webhook handler to also purge debt cache |
| Compute aging in frontend | BFF returns aging buckets computed from raw data (if downstream doesn't provide them) |
| Use same `payment` port for debt | `debt` is a SEPARATE port in api-endpoints.yaml with different cache config |
| Put debt under `GET /debt` | Use `GET /payments/debt` — module-scoped route convention, owned by PaymentModule |

### 🧪 Testing Requirements

1. **Mock adapter — get-outstanding-debt** — Read JSON, validate `OutstandingDebtResponseSchema` (aging breakdown + debts array)
2. **Mock adapter — get-debt-history** — Read JSON, validate `DebtHistoryResponseSchema` (chronological entries)
3. **Handler — get-outstanding-debt** — Verify `portRegistry.execute('debt', 'get-outstanding-debt', { customerId })`
4. **Handler — get-debt-history** — Verify `portRegistry.execute('debt', 'get-debt-history', { customerId })`
5. **Controller — GET /payments/debt** — Returns outstanding debt with aging buckets
6. **Controller — GET /payments/debt/history** — Returns debt history
7. **Controller — unauthenticated** — Returns 401
8. **Controller — verify query class types** — `toBeInstanceOf()` assertions
9. **Webhook handler update — debt cache purge** — Verify `deleteByPattern('cache:v2:port:debt:*')` called on payment success
10. **Integration — QueryBus → Handler → PortRegistry → MockAdapter → JSON** for both methods

### Previous Story Learnings (Stories 2.1–4.4 — MUST Apply)

- **Two ports, one module:** Follow BillingModule pattern (tariff + invoice) and MeterModule pattern (meter + meter-reading)
- **Module pattern:** `useExisting` for DI token provider — single shared adapter instance
- **Query pattern:** `implements IQuery`, `@QueryHandler` — same as Stories 2.1–3.3
- **Port registration:** `PortRegistry.register()` in `onModuleInit()` — separate call for each port
- **Cache invalidation:** Use `deleteByPattern()` from Story 4.2 — same pattern, different key prefix
- **Controller scoping:** `@Controller('payments/debt')` — debt lives under payment namespace
- **411+ tests passing** — ensure ZERO regressions

### 📋 Cross-Story Context

**This story completes Epic 4 (Payments & Financial Management).**

**Depends on (all complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Story 4.2 (Payment Webhook — `deleteByPattern`, `HandlePaymentWebhookHandler` to update)

**After this story:**
- Epic 4 is complete (except optional retrospective)
- Next: Epic 5 (Issue Reporting & Self-Service)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.5: Debt Overview & History]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port Interface Catalog — debt port (row 9)]
- [Source: _bmad-output/planning-artifacts/architecture.md#api-endpoints.yaml — debt config (dynamic cache)]
- [Source: _bmad-output/project-context.md#Cache TTL Strategy — dynamic tier 5-15 min]
- [Source: _bmad-output/implementation-artifacts/4-2-payment-webhook-confirmation.md — deleteByPattern + HandlePaymentWebhookHandler]
- [Source: src/modules/billing/billing.module.ts — Two ports, one module TEMPLATE]
- [Source: src/modules/meter/meter.module.ts — Two ports, one module TEMPLATE]
- [Source: src/modules/payment/payment.module.ts — Current module to extend]
- [Source: config/api-endpoints.yaml — debt config (dynamic cache, 900s TTL)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (glm-5[1m])

### Debug Log References

- 72 test suites, 574 tests — zero regressions
- 23 new tests added across 5 test files

### Completion Notes List

- ✅ Task 1: Created `MockDebtAdapter` with `get-outstanding-debt` + `get-debt-history` schemas, added `DEBT_PORT_TOKEN`
- ✅ Task 2: Created `debt.dto.ts` — AgingBucketSchema (4 buckets), DebtEntrySchema, OutstandingDebtResponseSchema, DebtHistoryEntrySchema, DebtHistoryResponseSchema + types
- ✅ Task 3: Created `mocks/debt/get-outstanding-debt.json` (4 debts across all aging buckets) + `mocks/debt/get-debt-history.json` (6 entries: outstanding + paid)
- ✅ Task 4: Created GetOutstandingDebtQuery + handler, GetDebtHistoryQuery + handler — each calls `portRegistry.execute('debt', method, { customerId })`
- ✅ Task 5: Created `DebtController` — `GET /payments/debt` (outstanding) + `GET /payments/debt/history` (history), QUERY_BUS_TOKEN only
- ✅ Task 6: Updated PaymentModule — two ports pattern (payment + debt), MockDebtAdapter, DebtController, query handlers, `onModuleInit` registers both ports
- ✅ Task 7: Updated HandlePaymentWebhookHandler — added `deleteByPattern('cache:v2:port:debt:*')` alongside invoice purge on payment success
- ✅ Task 8: 23 new tests — debt port spec (11), outstanding debt handler spec (3), debt history handler spec (2), debt controller spec (5), webhook debt cache purge (1), updated queries barrel

### File List

**NEW files:**
- `src/modules/payment/application/dtos/debt.dto.ts`
- `src/modules/payment/infrastructure/ports/debt.port.ts`
- `src/modules/payment/infrastructure/ports/debt.port.spec.ts`
- `src/modules/payment/infrastructure/http/debt.controller.ts`
- `src/modules/payment/infrastructure/http/debt.controller.spec.ts`
- `src/modules/payment/application/queries/get-outstanding-debt.query.ts`
- `src/modules/payment/application/queries/get-debt-history.query.ts`
- `src/modules/payment/application/queries/handlers/get-outstanding-debt.handler.ts`
- `src/modules/payment/application/queries/handlers/get-outstanding-debt.handler.spec.ts`
- `src/modules/payment/application/queries/handlers/get-debt-history.handler.ts`
- `src/modules/payment/application/queries/handlers/get-debt-history.handler.spec.ts`
- `mocks/debt/get-outstanding-debt.json`
- `mocks/debt/get-debt-history.json`

**MODIFIED files:**
- `src/modules/payment/payment.module.ts` — added MockDebtAdapter, DebtController, debt query handlers, two ports registration
- `src/modules/payment/constants/tokens.ts` — added DEBT_PORT_TOKEN
- `src/modules/payment/application/queries/index.ts` — added debt query exports
- `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.ts` — added debt cache purge (AC#4)
- `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.spec.ts` — added debt cache purge test

## Change Log

- 2026-06-09: Story 4.5 implementation complete — Debt Overview & History. 8 tasks, 574 tests passing. Epic 4 complete.
- 2026-06-10: Code review fixes applied (H1+H2+M1+M2+M3+L1):
  - H1: Swapped `NotFoundException` → `PortFallbackException` in both handlers (matches ticket module canonical pattern)
  - H2: Added optional chaining `result?.data` for null/undefined guard in both handlers
  - M1: Updated test assertions from `NotFoundException` → `PortFallbackException`
  - M2: Added `result is undefined` test case to both handler specs
  - M3: Added `.min(1)` to `invoiceRef` in `DebtEntrySchema` and `DebtHistoryEntrySchema`
  - L1: Added `.regex(/^\d{4}-\d{2}-\d{2}/)` to `dueDate` and `paidDate` fields
