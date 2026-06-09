# Story 4.1: Payment Initiation & QR Generation

Status: done

## Story

As a **customer (Anh Tuấn)**,
I want to select an invoice and get a QR code or payment link to pay instantly,
so that I can settle my water bill in under 60 seconds.

## Acceptance Criteria

### AC1: Initiate Payment from Invoice
**Given** an authenticated customer views an unpaid invoice
**When** they tap "Pay Now"
**Then** the BFF calls `IInvoicePort.getById(invoiceId)` with `useCache: false` to verify the invoice exists and is unpaid
**And** then calls `IPaymentPort.createPayment(invoiceId, customerId, method)` via PortRegistry
**And** returns the payment QR code or payment link to the frontend.

### AC2: ABSOLUTELY NO CACHING (FR35)
**Given** a payment request is made
**When** the PortRegistry processes the call
**Then** the payment port uses `cacheTier: transaction` — the request **always** hits the Payment Service live (FR35)
**And** no payment data is ever stored in Redis cache.

### AC3: Circuit Breaker — Graceful Error (NOT Cached Data)
**Given** the Payment Service is down or times out
**When** the BFF attempts to create a payment
**Then** the Circuit Breaker opens for the payment port
**And** returns a graceful error: "Payment service temporarily unavailable. Please try again in a moment."
**And** does NOT return any cached payment data (because none exists).

### AC4: Idempotency Key (FR70)
**Given** the BFF makes an outbound payment creation call
**When** the request is constructed
**Then** the `x-idempotency-key` header is injected (per Story 1.2, FR70)
**And** duplicate payment creation requests with the same idempotency key return the original payment result.

## Tasks / Subtasks

- [x] Task 1: Create Payment Module Structure & DI Tokens (AC: all)
  - [x] Create `src/modules/payment/constants/tokens.ts` — `PAYMENT_PORT_TOKEN`
  - [x] Create `src/modules/payment/domain/index.ts` — barrel export (no domain entities; BFF doesn't own payment data)
  - [x] Create `src/modules/payment/application/index.ts` — barrel export

- [x] Task 2: Create Payment DTOs (AC: #1, #2, #3, #4)
  - [x] Create `src/modules/payment/application/dtos/payment.dto.ts`
  - [x] Zod schemas: `PaymentMethodSchema` (enum: `qr_code`, `payment_link`, `bank_transfer`), `CreatePaymentResponseSchema` (paymentId, qrCodeUrl/paymentLink, amount, status, expiresAt)
  - [x] Zod schemas: `CreatePaymentRequestSchema` (invoiceId, method) — input validation for controller body
  - [x] Input validation: `InvoiceIdParamSchema` — reuse pattern from billing module

- [x] Task 3: Create Payment Port Interface & Mock Adapter (AC: #1, #2, #4)
  - [x] Create `src/modules/payment/infrastructure/ports/payment.port.ts`
  - [x] Define `IPaymentPort` interface extending `IPortAdapter`
  - [x] Create `MockPaymentAdapter extends MockAdapterBase implements IPaymentPort`
  - [x] Register schemas per method: `create-payment`

- [x] Task 4: Create Mock Data Files (AC: #1)
  - [x] Create `mocks/payment/create-payment.json` — mock payment response with QR code URL + payment link

- [x] Task 5: Create CQRS Command & Handler — Sequential Orchestration (AC: #1, #2, #4)
  - [x] Create `src/modules/payment/application/commands/create-payment.command.ts` — ICommand class
  - [x] Create `src/modules/payment/application/commands/handlers/create-payment.handler.ts`
  - [x] Handler: inject `PortRegistry` (both `invoice` and `payment` ports)
  - [x] Step 1: Verify invoice exists and is unpaid via `portRegistry.execute('invoice', 'get-by-id', { invoiceId, useCache: false })`
  - [x] Step 2: Create payment via `portRegistry.execute('payment', 'create-payment', { invoiceId, customerId, method })`
  - [x] Return `CreatePaymentResponse` with QR code / payment link

- [x] Task 6: Create Payment Controller (AC: all)
  - [x] Create `src/modules/payment/infrastructure/http/payment.controller.ts`
  - [x] `POST /payments` → dispatch `CreatePaymentCommand` (body: { invoiceId, method })
  - [x] Validate request body via `CreatePaymentRequestSchema`
  - [x] Inject `ICommandBus` via `COMMAND_BUS_TOKEN`

- [x] Task 7: Register Payment Module (AC: all)
  - [x] Create `src/modules/payment/payment.module.ts`
  - [x] Register MockPaymentAdapter with `useExisting`, controllers, command handlers
  - [x] Register `payment` port with PortRegistry via `onModuleInit`
  - [x] Import `PaymentModule` in `src/app.module.ts` (after `BillingModule`)

- [x] Task 8: Write comprehensive tests (AC: all)
  - [x] `payment.port.spec.ts` — Mock adapter reads JSON + Zod validates create-payment + schema rejection tests
  - [x] `create-payment.handler.spec.ts` — Verify invoice lookup (no cache) → payment creation → response shape
  - [x] `create-payment.handler.spec.ts` — Verify rejection when invoice is already paid + overdue
  - [x] `payment.controller.spec.ts` — POST /payments, body validation, command class types
  - [x] Integration: `test/integration/payment.spec.ts` — CommandBus → Handler → PortRegistry → MockAdapter → JSON

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This is a **NEW module**: `modules/payment/`. It is the first module in Epic 4 (Payments & Financial Management).

#### ⚡ FIRST COMMAND-ONLY STORY — Sequential Orchestration Pattern

Unlike Stories 2.1–3.3 (pure query pass-throughs), this story uses a **Command** with **sequential orchestration**:

```
Controller → CommandBus → CreatePaymentHandler
  → Step 1: Verify invoice (invoice port, useCache: false)
  → Step 2: Create payment (payment port, no cache)
  → Return QR code / payment link
```

**This follows the existing `UpdateCustomerProfileCommand` pattern** from Story 2.1 — sequential port calls in a command handler. See `src/modules/customer/application/commands/handlers/update-customer-profile.handler.ts` as the EXACT TEMPLATE.

#### BFF Does NOT Own Payment Business Data

**Rule #1:** CSKH module NEVER owns business logic. Payment processing lives in the Backend Payment Service.
This module is a **thin orchestrator**: verify invoice → delegate payment → return result.

#### ⚡ ABSOLUTELY NO CACHING — Transaction Tier

Payment data is `cacheTier: transaction` — PortRegistry will **never** cache payment responses. This is enforced by the api-endpoints.yaml config:

```yaml
payment:
  adapter: mock
  timeout: 5000
  cacheTier: transaction       # ← NO CACHE — every request hits service live
  circuitBreaker:
    errorThreshold: 30         # ← Lower threshold (30% vs 50%) — payments are sensitive
    resetTimeout: 30000        # ← Longer reset (30s vs 10s) — don't retry too fast
    minRequests: 3             # ← Fewer min requests before CB opens
```

**Key difference from all previous stories:** When Circuit Breaker is OPEN for payment:
- ❌ Do NOT return cached data (there is none)
- ✅ Return a **graceful error message** — "Payment service temporarily unavailable. Please try again in a moment."

#### What ALREADY EXISTS — DO NOT REINVENT

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **BillingModule** | `src/modules/billing/billing.module.ts` | Import `BillingModule` for `INVOICE_PORT_TOKEN` access |
| **IInvoicePort** | `src/modules/billing/infrastructure/ports/invoice.port.ts` | Call `get-by-id` for invoice verification |
| **InvoiceDetail DTO** | `src/modules/billing/application/dtos/invoice.dto.ts` | Type for invoice verification response |
| **UpdateCustomerProfileCommand** | `src/modules/customer/application/commands/` | **EXACT TEMPLATE** — sequential port calls in command handler |
| **CustomerController** | `src/modules/customer/infrastructure/http/customer.controller.ts` | **EXACT TEMPLATE** — shows both `QUERY_BUS_TOKEN` and `COMMAND_BUS_TOKEN` injection |
| **PortRegistry** | `src/libs/shared/port/port-registry.service.ts` | `register()` + `execute<T>()` |
| **MockAdapterBase** | `src/libs/shared/port/mock-adapter.base.ts` | Extend this |
| **ICommand / ICommandBus** | `@core/application` | Command interface + bus |
| **COMMAND_BUS_TOKEN** | `@core/constants/tokens` | DI token for command bus injection |
| **All shared infrastructure** | Same as Stories 2.1–3.3 | CQRS buses, exceptions, logger, auth propagation |

#### Payment Port — Defined in api-endpoints.yaml (Story 1.1)

```yaml
# Already in api-endpoints.yaml — DO NOT DUPLICATE
payment:
  adapter: mock
  baseUrl: ${BACKEND_BASE_URL}/payments
  timeout: 5000
  cacheTier: transaction
  circuitBreaker:
    errorThreshold: 30
    resetTimeout: 30000
    minRequests: 3
```

#### Port Interface Catalog Entry

| # | Port Name | Interface | Methods | Cache Tier |
|---|-----------|-----------|---------|-----------|
| 8 | `payment` | `IPaymentPort` | createPayment, createBatchPayment, getPaymentStatus, getPaymentHistory, setupAutoDebit, handleWebhook, getReceipt | **transaction (NO CACHE)** |

**MVP methods for this story:** `create-payment`
**Not needed now:** `createBatchPayment` (Story 4.3), `getPaymentStatus` / `getPaymentHistory` (Story 4.3), `setupAutoDebit` (Story 4.4), `handleWebhook` (Story 4.2), `getReceipt` (Phase 2)

### 📁 File Structure — Complete Map

```
src/modules/payment/
├── domain/
│   └── index.ts                                           ← NEW (barrel export, no entities)
├── application/
│   ├── commands/
│   │   ├── create-payment.command.ts                      ← NEW (AC#1)
│   │   ├── handlers/
│   │   │   └── create-payment.handler.ts                  ← NEW (AC#1 — sequential orchestration)
│   │   └── index.ts                                       ← NEW (barrel)
│   ├── dtos/
│   │   └── payment.dto.ts                                 ← NEW
│   └── index.ts                                           ← NEW (barrel)
├── infrastructure/
│   ├── http/
│   │   └── payment.controller.ts                          ← NEW
│   └── ports/
│       ├── payment.port.ts                                ← NEW
│       └── payment.port.spec.ts                           ← NEW
├── constants/
│   └── tokens.ts                                          ← NEW
└── payment.module.ts                                      ← NEW

mocks/payment/                                              ← NEW directory
└── create-payment.json                                     ← NEW

test/integration/
└── payment.spec.ts                                         ← NEW
```

**Modified Files:**
- `src/app.module.ts` — Add `PaymentModule` to imports (after `BillingModule`)

### 🔧 Implementation Details

#### Payment DTOs

```typescript
// src/modules/payment/application/dtos/payment.dto.ts
import { z } from 'zod';

// =============================================================================
// Payment Method Enum
// =============================================================================

export const PaymentMethodSchema = z.enum(['qr_code', 'payment_link', 'bank_transfer']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

// =============================================================================
// AC#1: Create Payment Request (controller input)
// =============================================================================

export const CreatePaymentRequestSchema = z.object({
  invoiceId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_]+$/, 'Invalid Invoice ID format'),
  method: PaymentMethodSchema,
});

// =============================================================================
// AC#1: Create Payment Response (port response)
// =============================================================================

export const CreatePaymentResponseSchema = z.object({
  paymentId: z.string(),
  invoiceId: z.string(),
  amount: z.number().positive(),
  method: PaymentMethodSchema,
  qrCodeUrl: z.string().url().nullable(), // Present when method = qr_code
  paymentLink: z.string().url().nullable(), // Present when method = payment_link
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  expiresAt: z.string(), // ISO timestamp — payment link/QR expiry
  createdAt: z.string(),
});

// =============================================================================
// Input Validation
// =============================================================================

export const InvoiceIdParamSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_]+$/, 'Invalid Invoice ID format');

// =============================================================================
// TypeScript Types
// =============================================================================

export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;
export type CreatePaymentResponse = z.infer<typeof CreatePaymentResponseSchema>;
```

#### Payment Port

```typescript
// src/modules/payment/infrastructure/ports/payment.port.ts
import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { CreatePaymentResponseSchema } from '../../application/dtos/payment.dto';

export interface IPaymentPort extends IPortAdapter {}

@Injectable()
export class MockPaymentAdapter extends MockAdapterBase implements IPaymentPort {
  constructor() {
    super(
      'payment',
      {
        'create-payment': CreatePaymentResponseSchema,
      },
      new Logger('payment-mock-adapter'),
    );
  }
}
```

#### Create Payment Command

```typescript
// src/modules/payment/application/commands/create-payment.command.ts
import { ICommand } from '@core/application';
import type { PaymentMethod } from '../dtos/payment.dto';
import type { CreatePaymentResponse } from '../dtos/payment.dto';

export class CreatePaymentCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly invoiceId: string,
    public readonly method: PaymentMethod,
  ) {}
}

export type CreatePaymentResult = CreatePaymentResponse;
```

#### Create Payment Handler — Sequential Orchestration

```typescript
// src/modules/payment/application/commands/handlers/create-payment.handler.ts
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { CreatePaymentCommand } from '../create-payment.command';
import type { CreatePaymentResponse } from '../../dtos/payment.dto';
import type { InvoiceDetail } from '@modules/billing/application/dtos/invoice.dto';
import type { PortResult } from '@shared/port/port.interface';
import { ForbiddenException } from '@core/common';

@CommandHandler(CreatePaymentCommand)
export class CreatePaymentHandler implements ICommandHandler<CreatePaymentCommand> {
  private readonly logger = new Logger(CreatePaymentHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: CreatePaymentCommand): Promise<CreatePaymentResponse> {
    const { customerId, invoiceId, method } = command;

    // Step 1: Verify invoice exists and is unpaid (useCache: false — transaction context)
    this.logger.log(`Verifying invoice ${invoiceId} for payment`);
    const invoiceResult: PortResult<InvoiceDetail> = await this.portRegistry.execute<InvoiceDetail>(
      'invoice',
      'get-by-id',
      { invoiceId, customerId, useCache: false },
    );

    const invoice = invoiceResult.data;

    // Guard: Invoice must be unpaid to initiate payment
    if (invoice.paymentStatus !== 'unpaid') {
      throw new ForbiddenException(`Invoice ${invoiceId} is not available for payment. Current status: ${invoice.paymentStatus}`);
    }

    // Step 2: Create payment via payment port (cacheTier: transaction → NO CACHE)
    this.logger.log(`Creating payment for invoice ${invoiceId}, method: ${method}`);
    const paymentResult: PortResult<CreatePaymentResponse> = await this.portRegistry.execute<CreatePaymentResponse>(
      'payment',
      'create-payment',
      { invoiceId, customerId, method, amount: invoice.totalAmount },
    );

    this.logger.log(`Payment created: ${paymentResult.data.paymentId} for invoice ${invoiceId}`);
    return paymentResult.data;
  }
}
```

#### Payment Controller

```typescript
// src/modules/payment/infrastructure/http/payment.controller.ts
import { Controller, Post, Body, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { COMMAND_BUS_TOKEN } from '@core/constants/tokens';
import type { ICommandBus } from '@core/application';
import { CreatePaymentCommand } from '../../application/commands/create-payment.command';
import { CreatePaymentRequestSchema } from '../../application/dtos/payment.dto';
import { ValidationException } from '@core/common';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';

@ApiTags('Payment')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentController {

  constructor(
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  /**
   * POST /payments
   * Initiate payment for an invoice → returns QR code or payment link (AC#1)
   */
  @Post()
  @ApiOperation({ summary: 'Initiate payment for an invoice' })
  async createPayment(
    @CurrentUser('id') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const validated = CreatePaymentRequestSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException('Invalid payment request');
    }
    return this.commandBus.execute(
      new CreatePaymentCommand(userId, validated.data.invoiceId, validated.data.method),
    );
  }
}
```

#### Payment Module

```typescript
// src/modules/payment/payment.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { PaymentController } from './infrastructure/http/payment.controller';
import { MockPaymentAdapter } from './infrastructure/ports/payment.port';
import { PAYMENT_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { CreatePaymentHandler } from './application/commands/handlers/create-payment.handler';
import { BillingModule } from '@modules/billing/billing.module';

@Module({
  imports: [BillingModule], // Import BillingModule for invoice port access
  controllers: [PaymentController],
  providers: [
    // Port Adapter (single instance shared via useExisting)
    MockPaymentAdapter,
    {
      provide: PAYMENT_PORT_TOKEN,
      useExisting: MockPaymentAdapter,
    },
    // CQRS Command Handlers
    CreatePaymentHandler,
  ],
  exports: [PAYMENT_PORT_TOKEN],
})
export class PaymentModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockPaymentAdapter: MockPaymentAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register(
      'payment',
      this.mockPaymentAdapter,
      this.mockPaymentAdapter,
    );
  }
}
```

#### AppModule Update

```typescript
// After BillingModule
import { PaymentModule } from 'src/modules/payment/payment.module';
// ...
BillingModule,
PaymentModule,           // ← ADD HERE
AuthPropagationModule,
```

### ⚠️ Anti-Patterns to Avoid

All anti-patterns from Stories 2.1–3.3 apply. **Critical additions for payments:**

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Cache payment responses | `cacheTier: transaction` — **ABSOLUTELY NO CACHING** (FR35). PortRegistry enforces this from api-endpoints.yaml |
| Return cached data on CB fallback | Return graceful error message — payment has NO cached data to fall back to |
| Use `QueryBus` for payment creation | Use `CommandBus` — payment is a WRITE operation, not a read |
| Skip invoice verification step | Always verify invoice exists + is unpaid before creating payment (sequential orchestration) |
| Create payment without `useCache: false` | Invoice lookup must use `{ useCache: false }` — stale invoice status could allow double-payment |
| Use generic `HttpException` for "invoice already paid" | Use `ForbiddenException` — semantically correct (customer can't pay an already-paid invoice) |
| Forget `COMMAND_BUS_TOKEN` | Controller must inject `COMMAND_BUS_TOKEN` (not `QUERY_BUS_TOKEN`) — see CustomerController template |
| Use `z.string()` for QR/payment URLs | Use `z.string().url()` for qrCodeUrl and paymentLink |
| Forget idempotency key | PortRegistry auto-injects `x-idempotency-key` via PortHttpClient (Story 1.2) — verify mock adapter doesn't break this |

### 🧪 Testing Requirements

1. **Mock adapter — create-payment** — Read JSON, validate Zod `CreatePaymentResponseSchema`, verify all fields (paymentId, qrCodeUrl/paymentLink, status, expiresAt)
2. **Command handler — successful flow** — Invoice unpaid → payment created → returns response with QR/link
3. **Command handler — invoice already paid** — Invoice `paymentStatus: 'paid'` → throws `ForbiddenException`
4. **Command handler — invoice overdue status** — Invoice `paymentStatus: 'overdue'` → throws `ForbiddenException` (only `unpaid` is valid)
5. **Command handler — invoice lookup uses no cache** — Verify `useCache: false` is passed to invoice port call
6. **Command handler — verify invoice customerId passed** — Ensures invoice ownership check (future security enhancement)
7. **Controller — POST /payments** — Returns 201 with payment response
8. **Controller — invalid body (missing invoiceId)** — Returns 400 ValidationException
9. **Controller — invalid body (bad method)** — Returns 400 ValidationException
10. **Controller — unauthenticated** — Returns 401
11. **Controller — verify command class type** — `toBeInstanceOf(CreatePaymentCommand)`
12. **Integration — CommandBus → Handler → PortRegistry → MockAdapter → JSON**

### Previous Story Learnings (Stories 2.1–3.3 — MUST Apply)

- **Module pattern:** `useExisting` for DI token provider — single shared adapter instance
- **getAuthenticatedUserId()** → `@CurrentUser('id') userId: string` pattern in controller
- **Port registration:** `PortRegistry.register()` in `onModuleInit()`
- **Command pattern:** Follow `UpdateCustomerProfileCommand` from Story 2.1 — `implements ICommand`, `@CommandHandler`, inject `PortRegistry`
- **Command bus injection:** Use `COMMAND_BUS_TOKEN` from `@core/constants/tokens` — see `CustomerController`
- **Input validation:** Validate request body with Zod `CreatePaymentRequestSchema`
- **Controller tests:** Verify command class types with `toBeInstanceOf()`
- **Integration test:** `CqrsModule` + `module.init()` for handler auto-discovery
- **Sequential orchestration:** `UpdateCustomerProfileHandler` pattern — multiple port calls in sequence, each with proper error handling
- **URL validation:** Use `z.string().url()` for all URL fields (qrCodeUrl, paymentLink)
- **411 tests passing** — ensure ZERO regressions
- **Cross-module port access:** PaymentModule imports BillingModule to access invoice port — handler calls both ports via shared `PortRegistry`

### 📋 Cross-Story Context

**This story's output is a dependency for:**
- **Story 4.2** (Payment Webhook) — Payment service sends webhook after payment completes
- **Story 4.3** (Payment History & Multi-Invoice) — Reuses `IPaymentPort` + adds `getPaymentHistory`, `createBatchPayment`

**Depends on (all complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Story 2.1 (Customer Profile — command pattern: `UpdateCustomerProfileCommand`)
- Story 3.3 (Invoice List & Detail — `IInvoicePort`, `InvoiceDetail` type, invoice verification)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1: Payment Initiation & QR Generation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port Interface Catalog — payment port (row 8)]
- [Source: _bmad-output/planning-artifacts/architecture.md#api-endpoints.yaml — payment config (transaction tier, lower CB threshold)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 3: Sequential Orchestration (payment flow)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure — modules/payment/]
- [Source: _bmad-output/project-context.md#Cache TTL Strategy — transaction tier: NO CACHE]
- [Source: _bmad-output/project-context.md#Error Handling Chain — transaction tier error handling]
- [Source: _bmad-output/implementation-artifacts/3-3-invoice-list-detail-download.md — PREVIOUS STORY (invoice port + InvoiceDetail type)]
- [Source: src/modules/customer/application/commands/update-customer-profile.command.ts — COMMAND TEMPLATE]
- [Source: src/modules/customer/application/commands/handlers/update-customer-profile.handler.ts — SEQUENTIAL ORCHESTRATION TEMPLATE]
- [Source: src/modules/customer/infrastructure/http/customer.controller.ts — COMMAND_BUS_TOKEN injection template]
- [Source: src/modules/billing/infrastructure/ports/invoice.port.ts — IInvoicePort (invoice verification)]
- [Source: src/modules/billing/application/dtos/invoice.dto.ts — InvoiceDetail type + PaymentStatusSchema]
- [Source: config/api-endpoints.yaml — payment config (transaction cache, 5000ms timeout, 30% CB threshold)]

## Dev Agent Record

### Agent Model Used

Claude GLM-5[1m]

### Debug Log References

- 522/522 tests passing — zero regressions
- Code review (2026-06-09): Fixed 4 issues — added InvoiceIdParamSchema, paid-invoice integration test, payment result null guard, stale test count

### Completion Notes List

- ✅ Task 1: Created payment module structure — DI tokens, empty domain barrel, application barrel
- ✅ Task 2: Created payment DTOs — PaymentMethod enum, CreatePaymentRequestSchema (input), CreatePaymentResponseSchema (output with QR/payment link URLs), InvoiceIdParamSchema
- ✅ Task 3: Created `MockPaymentAdapter` following existing port pattern — `create-payment` method with Zod validation
- ✅ Task 4: Created `mocks/payment/create-payment.json` — QR code response with consistent amount (123273 matching INV-2026-001)
- ✅ Task 5: Created `CreatePaymentCommand` + `CreatePaymentHandler` — sequential orchestration: verify invoice (useCache:false) → guard unpaid → create payment → return response (with null guard for payment result)
- ✅ Task 6: Created `PaymentController` with POST /payments — COMMAND_BUS_TOKEN injection, body validation via Zod
- ✅ Task 7: Created `PaymentModule` with BillingModule import, payment port registration in onModuleInit, updated AppModule
- ✅ Task 8: 4 test files — port spec (17 tests), handler spec (8 tests covering success/paid/overdue guards/cache bypass), controller spec (12 tests), integration test (3 tests including paid invoice rejection)

### File List

**New files:**
- `src/modules/payment/constants/tokens.ts`
- `src/modules/payment/domain/index.ts`
- `src/modules/payment/application/index.ts`
- `src/modules/payment/application/dtos/payment.dto.ts`
- `src/modules/payment/application/commands/create-payment.command.ts`
- `src/modules/payment/application/commands/index.ts`
- `src/modules/payment/application/commands/handlers/create-payment.handler.ts`
- `src/modules/payment/infrastructure/ports/payment.port.ts`
- `src/modules/payment/infrastructure/http/payment.controller.ts`
- `src/modules/payment/payment.module.ts`
- `mocks/payment/create-payment.json`
- `src/modules/payment/infrastructure/ports/payment.port.spec.ts`
- `src/modules/payment/application/commands/handlers/create-payment.handler.spec.ts`
- `src/modules/payment/infrastructure/http/payment.controller.spec.ts`
- `test/integration/payment.spec.ts`

**Modified files:**
- `src/app.module.ts` — Added PaymentModule import after BillingModule
- `src/modules/payment/application/dtos/payment.dto.ts` — Added InvoiceIdParamSchema, refactored CreatePaymentRequestSchema to use it
- `src/modules/payment/application/commands/handlers/create-payment.handler.ts` — Added null guard for paymentResult.data
- `test/integration/payment.spec.ts` — Added paid invoice rejection test with custom adapter
