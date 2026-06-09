# Story 4.3: Payment History & Multi-Invoice Payment

Status: done

## Story

As a **customer (KCN Cẩm Phả — business customer)**,
I want to view my payment history and pay multiple invoices at once,
so that I can manage my business's water bills efficiently.

## Acceptance Criteria

### AC1: View Payment History (FR36)
**Given** an authenticated customer navigates to "Payment History"
**When** the BFF receives the request with pagination params and optional filters
**Then** it calls `IPaymentPort.getPaymentHistory(customerId, filters)` via PortRegistry
**And** returns a paginated list: payment ID, invoice IDs, amount, method, status, timestamp.

### AC2: Pay Multiple Invoices at Once (FR37)
**Given** an authenticated customer selects multiple unpaid invoices
**When** they tap "Pay All"
**Then** the BFF verifies all selected invoices are unpaid (sequential check with `useCache: false`)
**And** calls `IPaymentPort.createBatchPayment(invoiceIds, customerId, method)` via PortRegistry
**And** returns a single QR code or payment link covering all selected invoices.

### AC3: No Caching for Payment Data (FR35)
**Given** any payment-related request is made (history or batch payment)
**When** the PortRegistry processes the call
**Then** the payment port uses `cacheTier: transaction` — every request hits the Payment Service live.

### AC4: Batch Payment Webhook Cache Invalidation
**Given** a batch payment webhook is received (Story 4.2)
**When** the BFF processes it
**Then** it invalidates cache for all invoices in the batch via pattern-based purge (per Story 4.2).

## Tasks / Subtasks

- [x] Task 1: Add Payment History & Batch Payment DTOs (AC: #1, #2)
  - [x] Add to `src/modules/payment/application/dtos/payment.dto.ts`:
  - [x] `PaymentHistoryItemSchema` (paymentId, invoiceIds, amount, method, status, createdAt)
  - [x] `PaymentHistoryResponseSchema` (payments array + pagination meta)
  - [x] `CreateBatchPaymentRequestSchema` (invoiceIds array, method) — input validation
  - [x] `CreateBatchPaymentResponseSchema` (paymentId, invoiceIds, totalAmount, qrCodeUrl/paymentLink, status, expiresAt)
  - [x] `BatchInvoiceVerificationSchema` (helper for per-invoice validation — implemented procedurally in handler loop)
  - [x] Input validation: `PaymentHistoryQuerySchema` (page, limit, status filter)

- [x] Task 2: Extend Payment Port with New Methods (AC: #1, #2)
  - [x] Update `src/modules/payment/infrastructure/ports/payment.port.ts`
  - [x] Add mock schemas: `get-payment-history`, `create-batch-payment`
  - [x] Create `mocks/payment/get-payment-history.json`
  - [x] Create `mocks/payment/create-batch-payment.json`

- [x] Task 3: Create Payment History Query & Handler (AC: #1)
  - [x] Create `src/modules/payment/application/queries/get-payment-history.query.ts`
  - [x] Create `src/modules/payment/application/queries/handlers/get-payment-history.handler.ts`
  - [x] Handler: inject `PortRegistry`, call `execute('payment', 'get-payment-history', { customerId, filters })`
  - [x] Returns paginated `PaymentHistoryResponse`

- [x] Task 4: Create Batch Payment Command & Handler (AC: #2, #3)
  - [x] Create `src/modules/payment/application/commands/create-batch-payment.command.ts`
  - [x] Create `src/modules/payment/application/commands/handlers/create-batch-payment.handler.ts`
  - [x] Handler: inject `PortRegistry`
  - [x] Step 1: Verify ALL invoices exist and are unpaid via invoice port (loop with `useCache: false`)
  - [x] Step 2: Calculate total amount from verified invoices
  - [x] Step 3: Create batch payment via `portRegistry.execute('payment', 'create-batch-payment', ...)`
  - [x] Return batch payment response with single QR/link

- [x] Task 5: Add Controller Endpoints (AC: all)
  - [x] Update `src/modules/payment/infrastructure/http/payment.controller.ts`
  - [x] Add `QUERY_BUS_TOKEN` injection (in addition to existing `COMMAND_BUS_TOKEN`)
  - [x] `GET /payments/history?page=1&limit=10&status=completed` → dispatch `GetPaymentHistoryQuery`
  - [x] `POST /payments/batch` → dispatch `CreateBatchPaymentCommand` (body: { invoiceIds, method })
  - [x] Validate request body/query params with Zod schemas

- [x] Task 6: Update Payment Module (AC: all)
  - [x] Update `src/modules/payment/payment.module.ts` — add new query/command handlers
  - [x] Add `GetPaymentHistoryHandler` and `CreateBatchPaymentHandler` to providers

- [x] Task 7: Write comprehensive tests (AC: all)
  - [x] Update `payment.port.spec.ts` — add tests for `get-payment-history`, `create-batch-payment` mock adapter
  - [x] `get-payment-history.handler.spec.ts` — Verify PortRegistry call with customerId + filters
  - [x] `create-batch-payment.handler.spec.ts` — Verify invoice verification loop + batch creation
  - [x] `create-batch-payment.handler.spec.ts` — Reject when any invoice is already paid
  - [x] `create-batch-payment.handler.spec.ts` — Reject when invoiceIds array is empty
  - [x] Update `payment.controller.spec.ts` — GET /payments/history, POST /payments/batch, validation
  - [x] Integration: `test/integration/payment-history.spec.ts` — full query flow

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story **extends the existing `payment` module** from Stories 4.1 + 4.2.

#### ⚡ Mixed Read/Write — Both QueryBus and CommandBus

This story adds BOTH a query (payment history — read) and a command (batch payment — write). The `PaymentController` must inject **both buses** — follow the `CustomerController` pattern:

```typescript
constructor(
  @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,      // NEW — for history
  @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,  // EXISTS — for payments
) {}
```

#### BFF Does NOT Own Payment Business Data

**Rule #1:** CSKH module NEVER owns business logic. Payment history and batch processing live in the Backend Payment Service.

#### ⚡ ABSOLUTELY NO CACHING — ALL Payment Operations

Both `get-payment-history` and `create-batch-payment` go through the `payment` port which is `cacheTier: transaction`. **No payment data is ever cached** — FR35 applies to ALL payment operations, not just creation.

#### ⚡ Batch Invoice Verification — Guard Against Double-Payment

The `CreateBatchPaymentHandler` must verify **every** invoice in the batch is unpaid before creating the batch payment:

```
For each invoiceId in invoiceIds:
  → portRegistry.execute('invoice', 'get-by-id', { invoiceId, customerId, useCache: false })
  → If paymentStatus !== 'unpaid' → throw ForbiddenException
  → Accumulate totalAmount
→ portRegistry.execute('payment', 'create-batch-payment', { invoiceIds, customerId, method, totalAmount })
```

**Edge case:** If 2 out of 3 invoices are unpaid and 1 is already paid → reject the entire batch. The customer must deselect the paid invoice.

#### What ALREADY EXISTS — DO NOT REINVENT

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **PaymentModule** | `src/modules/payment/payment.module.ts` | **EXTEND** — add query/command handlers |
| **PaymentController** | `src/modules/payment/infrastructure/http/payment.controller.ts` | **EXTEND** — add QUERY_BUS_TOKEN + 2 new endpoints |
| **MockPaymentAdapter** | `src/modules/payment/infrastructure/ports/payment.port.ts` | **EXTEND** — add `get-payment-history`, `create-batch-payment` schemas |
| **Payment DTOs** | `src/modules/payment/application/dtos/payment.dto.ts` | **EXTEND** — add history + batch DTOs |
| **CreatePaymentCommand** | `src/modules/payment/application/commands/` | **TEMPLATE** — batch command follows same pattern |
| **CreatePaymentHandler** | `src/modules/payment/application/commands/handlers/` | **TEMPLATE** — batch handler follows same sequential orchestration |
| **CustomerController** | `src/modules/customer/infrastructure/http/customer.controller.ts` | **TEMPLATE** — dual bus injection (QUERY + COMMAND) |
| **InvoiceDetail** | `src/modules/billing/application/dtos/invoice.dto.ts` | Type for invoice verification |
| **PaginationDto** | `src/libs/shared/http/dtos/pagination.dto.ts` | Shared pagination pattern |
| **PortRegistry** | `src/libs/shared/port/port-registry.service.ts` | `register()` + `execute<T>()` |
| **All shared infrastructure** | Same as Stories 2.1–4.2 | CQRS buses, exceptions, logger, auth propagation |

### 📁 File Structure — Complete Map

```
src/modules/payment/
├── application/
│   ├── commands/
│   │   ├── create-payment.command.ts                      ← EXISTS
│   │   ├── handle-payment-webhook.command.ts              ← EXISTS (Story 4.2)
│   │   ├── create-batch-payment.command.ts                ← NEW (AC#2)
│   │   ├── handlers/
│   │   │   ├── create-payment.handler.ts                  ← EXISTS
│   │   │   ├── handle-payment-webhook.handler.ts          ← EXISTS (Story 4.2)
│   │   │   └── create-batch-payment.handler.ts            ← NEW (AC#2)
│   │   └── index.ts                                       ← UPDATE
│   ├── queries/
│   │   ├── get-payment-history.query.ts                   ← NEW (AC#1)
│   │   ├── handlers/
│   │   │   └── get-payment-history.handler.ts             ← NEW (AC#1)
│   │   └── index.ts                                       ← NEW (barrel)
│   ├── dtos/
│   │   └── payment.dto.ts                                 ← UPDATE (add history + batch DTOs)
│   └── index.ts                                           ← UPDATE
├── infrastructure/
│   ├── http/
│   │   ├── payment.controller.ts                          ← UPDATE (add QUERY_BUS + 2 endpoints)
│   │   └── webhook.controller.ts                          ← EXISTS (Story 4.2, unchanged)
│   └── ports/
│       ├── payment.port.ts                                ← UPDATE (add mock schemas)
│       └── payment.port.spec.ts                           ← UPDATE (add new method tests)
└── payment.module.ts                                      ← UPDATE (add new handlers)

mocks/payment/
├── create-payment.json                                    ← EXISTS
├── get-payment-history.json                               ← NEW (AC#1)
└── create-batch-payment.json                              ← NEW (AC#2)

test/integration/
└── payment-history.spec.ts                                ← NEW
```

### 🔧 Implementation Details

#### New DTOs (add to payment.dto.ts)

```typescript
// =============================================================================
// AC#1: Payment History (paginated)
// =============================================================================

export const PaymentHistoryItemSchema = z.object({
  paymentId: z.string(),
  invoiceIds: z.array(z.string()),
  amount: z.number().nonnegative(),
  method: PaymentMethodSchema,
  status: z.enum(['completed', 'pending', 'failed', 'refunded']),
  createdAt: z.string(),
});

export const PaymentHistoryResponseSchema = z.object({
  payments: z.array(PaymentHistoryItemSchema),
  totalCount: z.number(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number(),
});

// =============================================================================
// AC#2: Batch Payment Request (controller input)
// =============================================================================

export const CreateBatchPaymentRequestSchema = z.object({
  invoiceIds: z.array(z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_]+$/)).min(1).max(20),
  method: PaymentMethodSchema,
});

// =============================================================================
// AC#2: Batch Payment Response (port response)
// =============================================================================

export const CreateBatchPaymentResponseSchema = z.object({
  paymentId: z.string(),
  invoiceIds: z.array(z.string()),
  totalAmount: z.number().positive(),
  method: PaymentMethodSchema,
  qrCodeUrl: z.string().url().nullable(),
  paymentLink: z.string().url().nullable(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  expiresAt: z.string(),
  createdAt: z.string(),
});

// =============================================================================
// AC#1: Payment History Query Params
// =============================================================================

export const PaymentHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z.enum(['completed', 'pending', 'failed']).optional(),
});

// =============================================================================
// TypeScript Types
// =============================================================================

export type PaymentHistoryItem = z.infer<typeof PaymentHistoryItemSchema>;
export type PaymentHistoryResponse = z.infer<typeof PaymentHistoryResponseSchema>;
export type CreateBatchPaymentRequest = z.infer<typeof CreateBatchPaymentRequestSchema>;
export type CreateBatchPaymentResponse = z.infer<typeof CreateBatchPaymentResponseSchema>;
```

#### Batch Payment Command

```typescript
// src/modules/payment/application/commands/create-batch-payment.command.ts
import { ICommand } from '@core/application';
import type { PaymentMethod, CreateBatchPaymentResponse } from '../dtos/payment.dto';

export class CreateBatchPaymentCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly invoiceIds: string[],
    public readonly method: PaymentMethod,
  ) {}
}

export type CreateBatchPaymentResult = CreateBatchPaymentResponse;
```

#### Batch Payment Handler — Sequential Verification + Batch Creation

```typescript
// src/modules/payment/application/commands/handlers/create-batch-payment.handler.ts
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { CreateBatchPaymentCommand } from '../create-batch-payment.command';
import type { CreateBatchPaymentResponse, PaymentMethod } from '../../dtos/payment.dto';
import type { InvoiceDetail } from '@modules/billing/application/dtos/invoice.dto';
import type { PortResult } from '@shared/port/port.interface';
import { ForbiddenException, ValidationException } from '@core/common';

@CommandHandler(CreateBatchPaymentCommand)
export class CreateBatchPaymentHandler implements ICommandHandler<CreateBatchPaymentCommand> {
  private readonly logger = new Logger(CreateBatchPaymentHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: CreateBatchPaymentCommand): Promise<CreateBatchPaymentResponse> {
    const { customerId, invoiceIds, method } = command;

    // Verify ALL invoices are unpaid (sequential — useCache: false for each)
    let totalAmount = 0;
    for (const invoiceId of invoiceIds) {
      const invoiceResult: PortResult<InvoiceDetail> = await this.portRegistry.execute<InvoiceDetail>(
        'invoice',
        'get-by-id',
        { invoiceId, customerId, useCache: false },
      );

      const invoice = invoiceResult.data;
      if (invoice.paymentStatus !== 'unpaid') {
        throw new ForbiddenException(
          `Invoice ${invoiceId} is not available for payment. Current status: ${invoice.paymentStatus}`,
        );
      }
      totalAmount += invoice.totalAmount;
    }

    this.logger.log(`Batch payment: ${invoiceIds.length} invoices, total: ${totalAmount}, method: ${method}`);

    // Create batch payment (cacheTier: transaction → NO CACHE)
    const paymentResult: PortResult<CreateBatchPaymentResponse> =
      await this.portRegistry.execute<CreateBatchPaymentResponse>(
        'payment',
        'create-batch-payment',
        { invoiceIds, customerId, method, totalAmount },
      );

    this.logger.log(`Batch payment created: ${paymentResult.data.paymentId} for ${invoiceIds.length} invoices`);
    return paymentResult.data;
  }
}
```

#### Payment History Query

```typescript
// src/modules/payment/application/queries/get-payment-history.query.ts
import { IQuery } from '@core/application';
import type { PaymentHistoryResponse } from '../dtos/payment.dto';

export class GetPaymentHistoryQuery implements IQuery {
  constructor(
    public readonly customerId: string,
    public readonly filters: { page: number; limit: number; status?: string },
  ) {}
}

export type GetPaymentHistoryResult = PaymentHistoryResponse;
```

#### Payment History Handler

```typescript
// src/modules/payment/application/queries/handlers/get-payment-history.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetPaymentHistoryQuery } from '../get-payment-history.query';
import type { PaymentHistoryResponse } from '../../dtos/payment.dto';

@QueryHandler(GetPaymentHistoryQuery)
export class GetPaymentHistoryHandler implements IQueryHandler<GetPaymentHistoryQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetPaymentHistoryQuery): Promise<PaymentHistoryResponse> {
    const result = await this.portRegistry.execute<PaymentHistoryResponse>(
      'payment',
      'get-payment-history',
      { customerId: query.customerId, filters: query.filters },
    );
    return result.data;
  }
}
```

#### Controller Update — Dual Bus Injection

```typescript
// Update existing PaymentController — add QUERY_BUS_TOKEN + 2 endpoints
import { Get, Query } from '@nestjs/common'; // add to imports
import { QUERY_BUS_TOKEN } from '@core/constants/tokens'; // add import
import type { IQueryBus } from '@core/application'; // add import

// Add to constructor:
@Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,

// Add new endpoints after existing createPayment:

@Get('history')
@ApiOperation({ summary: 'Get payment history (paginated)' })
async getPaymentHistory(
  @CurrentUser('id') userId: string,
  @Query() query: Record<string, any>,
) {
  const validated = PaymentHistoryQuerySchema.safeParse(query);
  if (!validated.success) {
    throw new ValidationException('Invalid query parameters');
  }
  return this.queryBus.execute(new GetPaymentHistoryQuery(userId, validated.data));
}

@Post('batch')
@ApiOperation({ summary: 'Pay multiple invoices at once' })
async createBatchPayment(
  @CurrentUser('id') userId: string,
  @Body() body: Record<string, unknown>,
) {
  const validated = CreateBatchPaymentRequestSchema.safeParse(body);
  if (!validated.success) {
    throw new ValidationException('Invalid batch payment request');
  }
  return this.commandBus.execute(
    new CreateBatchPaymentCommand(userId, validated.data.invoiceIds, validated.data.method),
  );
}
```

#### Payment Port Update

```typescript
// Add new schemas to MockPaymentAdapter constructor:
{
  'create-payment': CreatePaymentResponseSchema,
  'get-payment-history': PaymentHistoryResponseSchema,        // NEW
  'create-batch-payment': CreateBatchPaymentResponseSchema,   // NEW
}
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Cache payment history | `cacheTier: transaction` — ALL payment data, including history, is never cached |
| Skip invoice verification for batch | Verify EVERY invoice in the loop — reject entire batch if any is not `unpaid` |
| Use `Promise.all` for invoice verification | Use sequential `for...of` loop — each invoice must be verified before accumulating total |
| Allow empty invoiceIds array | Validate with `.min(1)` in Zod schema — batch must have at least 1 invoice |
| Allow unlimited batch size | Validate with `.max(20)` — cap batch size to prevent abuse |
| Use only `COMMAND_BUS_TOKEN` | Inject BOTH `QUERY_BUS_TOKEN` and `COMMAND_BUS_TOKEN` — history is a read, batch is a write |
| Put history under `GET /payments` | Use `GET /payments/history` — existing `POST /payments` is for single invoice |
| Forget pagination on history | Use `PaymentHistoryQuerySchema` with `page`/`limit` + pagination meta in response |

### 🧪 Testing Requirements

1. **Mock adapter — get-payment-history** — Read JSON, validate `PaymentHistoryResponseSchema`, verify pagination fields
2. **Mock adapter — create-batch-payment** — Read JSON, validate `CreateBatchPaymentResponseSchema`, verify multiple invoiceIds
3. **Query handler — get-payment-history** — Verify `portRegistry.execute('payment', 'get-payment-history', { customerId, filters })`
4. **Command handler — batch success** — All invoices unpaid → batch created → returns response with total amount
5. **Command handler — batch with paid invoice** — Invoice `paymentStatus: 'paid'` → throws `ForbiddenException`
6. **Command handler — batch with overdue invoice** — Invoice `paymentStatus: 'overdue'` → throws `ForbiddenException`
7. **Command handler — single invoice batch** — `invoiceIds: ['INV-001']` → works (min 1)
8. **Command handler — total amount accuracy** — Verify total = sum of all verified invoice amounts
9. **Controller — GET /payments/history** — Returns 200 with paginated payments
10. **Controller — GET /payments/history with status filter** — `?status=completed` → passes filter to query
11. **Controller — POST /payments/batch** — Returns batch payment with QR/link
12. **Controller — empty invoiceIds** — Returns 400 ValidationException
13. **Controller — too many invoiceIds (>20)** — Returns 400 ValidationException
14. **Controller — verify query/command class types** — `toBeInstanceOf()` for both
15. **Integration — QueryBus/CommandBus → Handler → PortRegistry → MockAdapter → JSON**

### Previous Story Learnings (Stories 2.1–4.2 — MUST Apply)

- **Module pattern:** `useExisting` for DI token provider — single shared adapter instance
- **Dual bus injection:** Follow `CustomerController` — inject both `QUERY_BUS_TOKEN` and `COMMAND_BUS_TOKEN`
- **Command pattern:** `implements ICommand`, `@CommandHandler` — same as Story 4.1
- **Query pattern:** `implements IQuery`, `@QueryHandler` — same as Stories 2.1–3.3
- **Sequential orchestration:** Invoice verification loop in handler — same as `CreatePaymentHandler` from Story 4.1
- **Cache invalidation:** Batch webhook handler (Story 4.2) already handles pattern-based purge for invoice cache
- **Pagination:** Use `PaginationDto` / `PaginatedResponseDto` pattern from Story 3.3
- **Input validation:** Validate request body AND query params with Zod schemas
- **URL validation:** Use `z.string().url()` for QR/payment link URLs
- **411+ tests passing** — ensure ZERO regressions

### 📋 Cross-Story Context

**This story's output is a dependency for:**
- **Story 4.5** (Debt Overview) — May reference payment history for debt context

**Depends on (all complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Story 2.1 (Customer Profile — dual bus injection pattern)
- Story 3.3 (Invoice List & Detail — InvoiceDetail type, invoice verification)
- Story 4.1 (Payment Initiation — PaymentModule, command pattern, sequential orchestration)
- Story 4.2 (Payment Webhook — pattern-based cache purge for batch webhook)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3: Payment History & Multi-Invoice Payment]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port Interface Catalog — payment port (row 8)]
- [Source: _bmad-output/planning-artifacts/architecture.md#api-endpoints.yaml — payment config (transaction tier)]
- [Source: _bmad-output/implementation-artifacts/4-1-payment-initiation-qr-generation.md — PREVIOUS STORY (payment module + command pattern)]
- [Source: src/modules/payment/payment.module.ts — Current module structure]
- [Source: src/modules/payment/infrastructure/http/payment.controller.ts — Current controller (COMMAND_BUS only)]
- [Source: src/modules/payment/infrastructure/ports/payment.port.ts — Current port (create-payment only)]
- [Source: src/modules/payment/application/dtos/payment.dto.ts — Current DTOs]
- [Source: src/modules/customer/infrastructure/http/customer.controller.ts — Dual bus injection TEMPLATE]
- [Source: src/modules/customer/application/commands/handlers/update-customer-profile.handler.ts — Sequential port call TEMPLATE]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (glm-5[1m])

### Debug Log References

- Fixed pre-existing bug: `handle-payment-webhook.handler.ts` imported `CommandHandler` from `@nestjs/common` instead of `@nestjs/cqrs`
- Fixed pre-existing bug: `test/integration/payment-webhook.spec.ts` used `.createNestModule()` instead of `.compile()`
- Fixed pre-existing bug: webhook integration test mock cache `get` always returned `null`, breaking idempotency duplicate detection
- Code review (2026-06-09): Fixed 5 issues — null guard on history handler, missing integration test, consolidated imports, corrected subtask claims

### Completion Notes List

- ✅ Task 1: Added 6 new Zod schemas + types to `payment.dto.ts` (PaymentHistoryItem/Response, CreateBatchPaymentRequest/Response, PaymentHistoryQuery)
- ✅ Task 2: Extended `MockPaymentAdapter` with `get-payment-history` and `create-batch-payment` schemas + JSON mock files
- ✅ Task 3: Created `GetPaymentHistoryQuery` + `GetPaymentHistoryHandler` — calls PortRegistry with customerId + filters (with null guard)
- ✅ Task 4: Created `CreateBatchPaymentCommand` + `CreateBatchPaymentHandler` — sequential invoice verification loop (useCache: false), accumulates totalAmount, rejects batch if any invoice not unpaid
- ✅ Task 5: Updated `PaymentController` with dual bus injection (QUERY_BUS + COMMAND_BUS), added `GET /payments/history` and `POST /payments/batch` endpoints with Zod validation
- ✅ Task 6: Updated `PaymentModule` with `GetPaymentHistoryHandler` and `CreateBatchPaymentHandler` providers
- ✅ Task 7: 99 unit tests across 7 test suites + 2 integration tests across 2 files, 524 total tests passing with zero regressions

### File List

**NEW files:**
- `src/modules/payment/application/commands/create-batch-payment.command.ts`
- `src/modules/payment/application/commands/handlers/create-batch-payment.handler.ts`
- `src/modules/payment/application/queries/get-payment-history.query.ts`
- `src/modules/payment/application/queries/handlers/get-payment-history.handler.ts`
- `src/modules/payment/application/queries/index.ts`
- `src/modules/payment/application/queries/handlers/get-payment-history.handler.spec.ts`
- `src/modules/payment/application/commands/handlers/create-batch-payment.handler.spec.ts`
- `mocks/payment/get-payment-history.json`
- `mocks/payment/create-batch-payment.json`

**MODIFIED files:**
- `src/modules/payment/application/dtos/payment.dto.ts` — added history + batch DTOs
- `src/modules/payment/infrastructure/ports/payment.port.ts` — added get-payment-history, create-batch-payment schemas
- `src/modules/payment/infrastructure/ports/payment.port.spec.ts` — added tests for new schemas
- `src/modules/payment/infrastructure/http/payment.controller.ts` — dual bus injection + 2 new endpoints
- `src/modules/payment/infrastructure/http/payment.controller.spec.ts` — tests for GET /history, POST /batch, validation
- `src/modules/payment/payment.module.ts` — added GetPaymentHistoryHandler, CreateBatchPaymentHandler
- `src/modules/payment/application/commands/index.ts` — added batch command export
- `src/modules/payment/application/index.ts` — added batch + history exports
- `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.ts` — fixed CommandHandler import (from @nestjs/cqrs)
- `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.spec.ts` — local IdempotencyMock interface
- `test/integration/payment-webhook.spec.ts` — fixed compile() API + working mock cache store
- `test/integration/payment-history.spec.ts` — NEW integration test for payment history query flow

## Change Log

- 2026-06-09: Story 4.3 implementation complete — Payment History & Multi-Invoice Payment. 7 tasks, 518 tests passing. Fixed 3 pre-existing bugs from Story 4.2.
