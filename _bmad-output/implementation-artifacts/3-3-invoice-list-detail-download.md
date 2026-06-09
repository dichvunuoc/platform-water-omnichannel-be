# Story 3.3: Invoice List, Detail & Download

Status: done

## Story

As a **customer (Anh Tuấn)**,
I want to view my invoices, see the full breakdown, and download the official e-invoice PDF,
so that I can review what I owe and keep records for tax/business purposes.

## Acceptance Criteria

### AC1: Get Invoice List (Paginated + Filters)
**Given** an authenticated customer navigates to "My Invoices"
**When** the BFF receives the request with pagination params and optional filters (month, status)
**Then** it calls `IInvoicePort.getList(customerId, filters)` via PortRegistry
**And** returns a paginated list of invoices: invoice ID, period, total amount, payment status, issue date.

### AC2: Get Invoice Detail
**Given** an authenticated customer selects an invoice from the list
**When** they tap "View Detail"
**Then** the BFF calls `IInvoicePort.getById(invoiceId)` via PortRegistry
**And** returns: full line items with tiered pricing breakdown, total amount, payment status, CQT code, lookup code.

### AC3: Download Invoice PDF
**Given** an authenticated customer views an invoice detail
**When** they tap "Download PDF"
**Then** the BFF calls `IInvoicePort.getPDF(invoiceId)` via PortRegistry
**And** returns the electronic invoice PDF with: CQT code, lookup code, digital signature — compliant with Nghị định 123/2020/NĐ-CP.

### AC4: Dynamic Cache Tier
**Given** invoice data is fetched successfully
**When** the response is cached
**Then** the cache key follows `cache:v2:port:invoice:{hash}` with TTL 5-15 min (dynamic tier, per api-endpoints.yaml).

## Tasks / Subtasks

- [x] Task 1: Create Invoice DTOs (AC: #1, #2, #3)
  - [x] Create `src/modules/billing/application/dtos/invoice.dto.ts`
  - [x] Zod schemas: `InvoiceListItemSchema` (invoiceId, period, totalAmount, paymentStatus, issueDate), `InvoiceListResponseSchema` (invoices array + pagination meta)
  - [x] Zod schemas: `InvoiceLineItemSchema` (description, volume, unitPrice, amount), `InvoiceDetailSchema` (full detail with line items, CQT code, lookup code)
  - [x] Zod schemas: `InvoicePdfSchema` (pdfUrl, cqtCode, lookupCode, digitalSignature)
  - [x] Input validation: `InvoiceIdParamSchema`, `InvoiceListQuerySchema` (month YYYY-MM, status enum, page/limit)
  - [x] Reuse `PaginationDto` / `PaginatedResponseDto` from `@shared/http/dtos` if applicable for pagination pattern

- [x] Task 2: Create Invoice Port Interface & Mock Adapter (AC: #1, #2, #3)
  - [x] Create `src/modules/billing/infrastructure/ports/invoice.port.ts`
  - [x] Define `IInvoicePort` interface extending `IPortAdapter`
  - [x] Create `MockInvoiceAdapter extends MockAdapterBase implements IInvoicePort`
  - [x] Register schemas per method: `get-list`, `get-by-id`, `get-pdf`

- [x] Task 3: Create Mock Data Files (AC: #1, #2, #3)
  - [x] Create `mocks/invoice/get-list.json` — paginated invoice list with multiple invoices
  - [x] Create `mocks/invoice/get-by-id.json` — full invoice detail with line items and CQT code
  - [x] Create `mocks/invoice/get-pdf.json` — PDF URL with CQT code, lookup code, digital signature

- [x] Task 4: Create CQRS Queries & Handlers (AC: #1, #2, #3)
  - [x] Create `get-invoice-list.query.ts` + handler — returns paginated `InvoiceListResponse`
  - [x] Create `get-invoice-detail.query.ts` + handler — returns `InvoiceDetail` with line items
  - [x] Create `get-invoice-pdf.query.ts` + handler — returns `InvoicePdf` with PDF URL
  - [x] Each handler: inject `PortRegistry`, call `portRegistry.execute<T>('invoice', method, params)`

- [x] Task 5: Add Invoice Controller Endpoints (AC: all)
  - [x] Create `src/modules/billing/infrastructure/http/invoice.controller.ts`
  - [x] `GET /billing/invoices?month=YYYY-MM&status=paid|unpaid|overdue&page=1&limit=10` → dispatch `GetInvoiceListQuery`
  - [x] `GET /billing/invoices/:invoiceId` → dispatch `GetInvoiceDetailQuery`
  - [x] `GET /billing/invoices/:invoiceId/pdf` → dispatch `GetInvoicePdfQuery`
  - [x] Validate `invoiceId` param via `InvoiceIdParamSchema` (reuse from tariff.dto.ts or define in invoice.dto.ts)
  - [x] Validate query params (month format, status enum) via Zod schemas

- [x] Task 6: Update Billing Module Registration (AC: all)
  - [x] Update `src/modules/billing/billing.module.ts` — add `MockInvoiceAdapter` provider with `useExisting` pattern
  - [x] Register `invoice` port with PortRegistry in `onModuleInit`
  - [x] Add new query handlers to providers
  - [x] Add `InvoiceController` to controllers

- [x] Task 7: Write comprehensive tests (AC: all)
  - [x] `invoice.port.spec.ts` — Mock adapter reads JSON + Zod validates for each method
  - [x] `get-invoice-list.handler.spec.ts` — Handler calls PortRegistry with customerId + filters
  - [x] `get-invoice-detail.handler.spec.ts` — Handler calls PortRegistry with invoiceId
  - [x] `get-invoice-pdf.handler.spec.ts` — Handler passes invoiceId correctly
  - [x] `invoice.controller.spec.ts` — 3 endpoints, invoiceId validation, query param validation, query class types
  - [x] Integration: `test/integration/invoice.spec.ts` — QueryBus → Handler → PortRegistry → MockAdapter → JSON

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story **extends the existing `billing` module** from Story 3.2 — NOT a new module. The `invoice` port is a SEPARATE port registered alongside `tariff` port in the same `BillingModule`.

#### BFF Does NOT Own Invoice Business Data

**Rule #1:** CSKH module NEVER owns business logic. Invoice data lives in the Backend API.
This story adds a **thin pass-through** — no BFF computation needed.

#### What ALREADY EXISTS — DO NOT REINVENT

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **BillingModule** | `src/modules/billing/billing.module.ts` | **EXTEND** — add invoice port + controller + handlers |
| **TariffController** | `src/modules/billing/infrastructure/http/tariff.controller.ts` | Pattern reference for new InvoiceController |
| **Billing Tokens** | `src/modules/billing/constants/tokens.ts` | `INVOICE_PORT_TOKEN` already exists as placeholder |
| **Billing DTOs** | `src/modules/billing/application/dtos/tariff.dto.ts` | Pattern reference — create `invoice.dto.ts` alongside |
| **PortRegistry** | `src/libs/shared/port/port-registry.service.ts` | `register()` + `execute<T>()` |
| **MockAdapterBase** | `src/libs/shared/port/mock-adapter.base.ts` | Extend this |
| **PaginationDto** | `src/libs/shared/http/dtos/pagination.dto.ts` | Shared pagination DTO — USE for query param pattern |
| **PaginatedResponseDto** | `src/libs/shared/http/dtos/pagination.dto.ts` | Shared paginated response — USE for list endpoint |
| **All shared infrastructure** | Same as Stories 2.1–3.2 | CQRS buses, exceptions, logger, auth propagation |

#### Invoice Port — Defined in api-endpoints.yaml (Story 1.1)

```yaml
# Already in api-endpoints.yaml — DO NOT DUPLICATE
invoice:
  adapter: mock
  timeout: 3000
  cacheTier: dynamic
  circuitBreaker: { errorThreshold: 50, resetTimeout: 10000, minRequests: 5 }
```

#### Port Interface Catalog Entry

| # | Port Name | Interface | Methods | Cache Tier |
|---|-----------|-----------|---------|-----------|
| 7 | `invoice` | `IInvoicePort` | get-list, get-by-id, get-pdf | dynamic (5-15 min) |

**MVP methods for this story:** `get-list`, `get-by-id`, `get-pdf`
**Not needed now:** `getInvoiceDeliveryStatus`, `getBatchInvoices` (Phase 2)

#### ⚡ Two Ports, One Module — Extending Story 3.2

The `billing` module now owns **two ports**:

```
modules/billing/
  └── infrastructure/ports/
      ├── tariff.port.ts              ← Story 3.2 (static cache)
      └── invoice.port.ts            ← Story 3.3 (dynamic cache)
```

Both ports register separately with PortRegistry in `BillingModule.onModuleInit()`:

```typescript
onModuleInit() {
  // Port 1: Tariff (static, 12-24h cache) — Story 3.2
  this.portRegistry.register('tariff', this.mockTariffAdapter, this.mockTariffAdapter);
  // Port 2: Invoice (dynamic, 5-15 min cache) — Story 3.3
  this.portRegistry.register('invoice', this.mockInvoiceAdapter, this.mockInvoiceAdapter);
}
```

### 📁 File Structure — Complete Map

```
src/modules/billing/
├── domain/
│   └── index.ts                                           ← EXISTS (unchanged)
├── application/
│   ├── queries/
│   │   ├── get-tariff-plan.query.ts                       ← EXISTS
│   │   ├── get-tariff-breakdown.query.ts                  ← EXISTS
│   │   ├── get-applicable-fees.query.ts                   ← EXISTS
│   │   ├── get-invoice-list.query.ts                      ← NEW (AC#1)
│   │   ├── get-invoice-detail.query.ts                    ← NEW (AC#2)
│   │   ├── get-invoice-pdf.query.ts                       ← NEW (AC#3)
│   │   ├── handlers/
│   │   │   ├── get-tariff-plan.handler.ts                 ← EXISTS
│   │   │   ├── get-tariff-breakdown.handler.ts            ← EXISTS
│   │   │   ├── get-applicable-fees.handler.ts             ← EXISTS
│   │   │   ├── get-invoice-list.handler.ts                ← NEW
│   │   │   ├── get-invoice-detail.handler.ts              ← NEW
│   │   │   └── get-invoice-pdf.handler.ts                 ← NEW
│   │   └── index.ts                                       ← UPDATE (add new exports)
│   ├── dtos/
│   │   ├── tariff.dto.ts                                  ← EXISTS (unchanged)
│   │   └── invoice.dto.ts                                 ← NEW
│   └── index.ts                                           ← UPDATE (add invoice exports)
├── infrastructure/
│   ├── http/
│   │   ├── tariff.controller.ts                           ← EXISTS (unchanged)
│   │   └── invoice.controller.ts                          ← NEW
│   └── ports/
│       ├── tariff.port.ts                                 ← EXISTS (unchanged)
│       ├── tariff.port.spec.ts                            ← EXISTS (unchanged)
│       ├── invoice.port.ts                                ← NEW
│       └── invoice.port.spec.ts                           ← NEW
├── constants/
│   └── tokens.ts                                          ← EXISTS (INVOICE_PORT_TOKEN already there)
└── billing.module.ts                                      ← UPDATE (add invoice port + controller + handlers)

mocks/invoice/                                             ← NEW directory (NOTE: get-list.json already exists from prior story)
├── get-list.json                                          ← EXISTS — may need updating for new schema
├── get-by-id.json                                         ← NEW
└── get-pdf.json                                           ← NEW

test/integration/
└── invoice.spec.ts                                        ← NEW
```

**Modified Files:**
- `src/modules/billing/billing.module.ts` — Add MockInvoiceAdapter, InvoiceController, register invoice port
- `src/modules/billing/application/queries/index.ts` — Add new query exports
- `src/modules/billing/application/index.ts` — Add invoice.dto exports

### 🔧 Implementation Details

#### Invoice DTOs

```typescript
// src/modules/billing/application/dtos/invoice.dto.ts
import { z } from 'zod';

// =============================================================================
// AC#1: Invoice List (paginated)
// =============================================================================

export const PaymentStatusSchema = z.enum(['paid', 'unpaid', 'overdue', 'cancelled']);

export const InvoiceListItemSchema = z.object({
  invoiceId: z.string(),
  contractId: z.string(),
  period: z.string(), // "2025-06"
  totalAmount: z.number().nonnegative(),
  paymentStatus: PaymentStatusSchema,
  issueDate: z.string(),
  dueDate: z.string().optional(),
});

export const InvoiceListResponseSchema = z.object({
  invoices: z.array(InvoiceListItemSchema),
  totalCount: z.number(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number(),
});

// =============================================================================
// AC#2: Invoice Detail (full breakdown)
// =============================================================================

export const InvoiceLineItemSchema = z.object({
  description: z.string(),
  volume: z.number().nonnegative(), // m³
  unitPrice: z.number().nonnegative(), // VND per m³ or fixed
  amount: z.number().nonnegative(), // line total
});

export const InvoiceDetailSchema = z.object({
  invoiceId: z.string(),
  contractId: z.string(),
  period: z.string(),
  lineItems: z.array(InvoiceLineItemSchema),
  subtotal: z.number().nonnegative(),
  fees: z.array(z.object({
    feeName: z.string(),
    amount: z.number().nonnegative(),
  })),
  totalAmount: z.number().nonnegative(),
  paymentStatus: PaymentStatusSchema,
  cqtCode: z.string().nullable(), // CQT mã tra cứu
  lookupCode: z.string().nullable(), // Mã tra cứu hóa đơn điện tử
  issueDate: z.string(),
  dueDate: z.string().optional(),
});

// =============================================================================
// AC#3: Invoice PDF
// =============================================================================

export const InvoicePdfSchema = z.object({
  invoiceId: z.string(),
  pdfUrl: z.string().url(),
  cqtCode: z.string(),
  lookupCode: z.string(),
  digitalSignature: z.string(), // Base64 or URL to signature
});

// =============================================================================
// Input Validation
// =============================================================================

export const InvoiceIdParamSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_]+$/, 'Invalid Invoice ID format');

export const InvoiceStatusFilterSchema = z.enum(['paid', 'unpaid', 'overdue']).optional();

export const InvoiceListQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format. Use YYYY-MM').optional(),
  status: InvoiceStatusFilterSchema,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

// =============================================================================
// TypeScript Types
// =============================================================================

export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export type InvoiceListItem = z.infer<typeof InvoiceListItemSchema>;
export type InvoiceListResponse = z.infer<typeof InvoiceListResponseSchema>;
export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;
export type InvoiceDetail = z.infer<typeof InvoiceDetailSchema>;
export type InvoicePdf = z.infer<typeof InvoicePdfSchema>;
```

#### Invoice Controller

```typescript
// src/modules/billing/infrastructure/http/invoice.controller.ts
@ApiTags('Billing — Invoice')
@ApiBearerAuth('JWT-auth')
@Controller('billing/invoices')
export class InvoiceController {
  constructor(@Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus) {}

  @Get()
  async getInvoiceList(
    @CurrentUser('id') userId: string,
    @Query() query: Record<string, any>,
  ) {
    const validated = InvoiceListQuerySchema.safeParse(query);
    if (!validated.success) {
      throw new ValidationException('Invalid query parameters');
    }
    return this.queryBus.execute(new GetInvoiceListQuery(userId, validated.data));
  }

  @Get(':invoiceId')
  async getInvoiceDetail(
    @CurrentUser('id') userId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    this.validateInvoiceId(invoiceId);
    return this.queryBus.execute(new GetInvoiceDetailQuery(userId, invoiceId));
  }

  @Get(':invoiceId/pdf')
  async getInvoicePdf(
    @CurrentUser('id') userId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    this.validateInvoiceId(invoiceId);
    return this.queryBus.execute(new GetInvoicePdfQuery(userId, invoiceId));
  }
}
```

#### Module Registration Update

```typescript
// billing.module.ts — updated onModuleInit
import { MockInvoiceAdapter } from './infrastructure/ports/invoice.port';
import { INVOICE_PORT_TOKEN } from './constants/tokens';
import { InvoiceController } from './infrastructure/http/invoice.controller';
import { GetInvoiceListHandler } from './application/queries/handlers/get-invoice-list.handler';
import { GetInvoiceDetailHandler } from './application/queries/handlers/get-invoice-detail.handler';
import { GetInvoicePdfHandler } from './application/queries/handlers/get-invoice-pdf.handler';

// In @Module, ADD to controllers: InvoiceController
// In @Module providers, ADD:
MockInvoiceAdapter,
{ provide: INVOICE_PORT_TOKEN, useExisting: MockInvoiceAdapter },
GetInvoiceListHandler,
GetInvoiceDetailHandler,
GetInvoicePdfHandler,

// In constructor, ADD: private readonly mockInvoiceAdapter: MockInvoiceAdapter,
// In onModuleInit, ADD:
this.portRegistry.register('invoice', this.mockInvoiceAdapter, this.mockInvoiceAdapter);
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Create a new `invoice` module | Extend existing `billing` module — two ports, one module (per architecture) |
| Implement custom pagination from scratch | Use `PaginationDto` / `PaginatedResponseDto` from `@shared/http/dtos` as reference pattern |
| Use `z.string()` for PDF URLs | Use `z.string().url()` for pdfUrl — same lesson from Story 3.1 EvidencePhoto fix |
| Forget `useExisting` DI pattern | Use `useExisting: MockInvoiceAdapter` for single shared instance |
| Put invoices under `GET /invoices` | Use `GET /billing/invoices` — module-scoped route convention |
| Hardcode CQT code format | Pass through from downstream — CQT is government standard, not BFF concern |
| Forget to validate query params (month, status) | Validate with `InvoiceListQuerySchema` — month must be YYYY-MM, status must be enum |

### 🧪 Testing Requirements

1. **Mock adapter — get-list** — Read JSON, validate Zod `InvoiceListResponseSchema`, verify pagination fields (page, limit, totalPages)
2. **Mock adapter — get-by-id** — Read JSON, validate `InvoiceDetailSchema`, verify line items + CQT code
3. **Mock adapter — get-pdf** — Read JSON, validate `InvoicePdfSchema`, verify pdfUrl is valid URL
4. **Query handler — get-list** — Verify `portRegistry.execute('invoice', 'get-list', { customerId, filters })` returns paginated response
5. **Query handler — get-detail** — Verify handler passes invoiceId correctly
6. **Query handler — get-pdf** — Verify handler passes invoiceId correctly
7. **Controller — GET /billing/invoices** — Returns 200 with paginated invoices
8. **Controller — GET /billing/invoices/:invoiceId** — Returns invoice detail with line items
9. **Controller — GET /billing/invoices/:invoiceId/pdf** — Returns PDF URL
10. **Controller — invalid invoiceId** — Returns 400 ValidationException
11. **Controller — invalid month query param** — Returns 400 ValidationException
12. **Controller — invalid status filter** — Returns 400 ValidationException
13. **Controller — verify query class types** — `toBeInstanceOf()` assertions
14. **Integration — QueryBus → Handler → PortRegistry → MockAdapter → JSON** for all 3 methods

### Previous Story Learnings (Stories 2.1–3.2 — MUST Apply)

- **Module pattern:** `useExisting` for DI token provider — single shared adapter instance
- **getAuthenticatedUserId()** → `@CurrentUser('id') userId: string` pattern in controller
- **Port registration:** `PortRegistry.register()` in `onModuleInit()`
- **Input validation:** Validate URL params + query params with Zod schemas
- **Controller tests:** Verify query class types with `toBeInstanceOf()`
- **Integration test:** `CqrsModule` + `module.init()` for handler auto-discovery
- **Zod v4:** `z.record(z.string(), valueSchema)` — 2 args
- **BFF-computed UI flags:** This story is pure pass-through — NO BFF computation needed
- **Barrel exports:** Update `application/index.ts` and `queries/index.ts` with new exports
- **URL validation:** Use `z.string().url()` for all URL fields (lesson from Story 3.1 review fix)
- **Schema rejection tests:** Include negative-case Zod schema tests in port spec (lesson from Story 3.2 review fix)
- **Max-length boundary tests:** Test param schemas at 100-char boundary (lesson from Story 3.2 review fix)
- **367 tests passing** — ensure ZERO regressions

### 📋 Cross-Story Context

**This story's output is a dependency for:**
- **Story 4.1** (Payment Initiation) — Payment verifies invoice exists via `get-by-id` before creating payment

**Depends on (all complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Story 2.1 (Customer Profile — module pattern)
- Story 2.2 (Contract Lookup — controller validation pattern)
- Story 3.1 (Consumption History — meter-reading port pattern)
- Story 3.2 (Tariff Display — billing module + tariff port, INVOICE_PORT_TOKEN placeholder)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3: Invoice List, Detail & Download]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port Interface Catalog — invoice port (row 7)]
- [Source: _bmad-output/planning-artifacts/architecture.md#api-endpoints.yaml — invoice config (dynamic cache)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure — modules/billing/]
- [Source: _bmad-output/project-context.md#Cache TTL Strategy — dynamic tier 5-15 min]
- [Source: _bmad-output/project-context.md#Naming Conventions — all naming rules]
- [Source: src/libs/shared/http/dtos/pagination.dto.ts — Shared PaginationDto + PaginatedResponseDto]
- [Source: src/modules/billing/billing.module.ts — Module registration pattern (useExisting + onModuleInit)]
- [Source: src/modules/billing/infrastructure/ports/tariff.port.ts — Port interface + mock adapter template]
- [Source: src/modules/billing/infrastructure/http/tariff.controller.ts — Controller endpoint pattern]
- [Source: src/modules/meter/infrastructure/ports/meter-reading.port.ts — Dynamic cache port pattern]

## Dev Agent Record

### Agent Model Used

Claude GLM-5[1m]

### Debug Log References

- 411/411 tests passing — zero regressions from baseline (367 tests from Stories 1–3.2)
- Fixed regression in `port-registry.spec.ts` and `port-registry.service.spec.ts` caused by `get-list.json` schema change — updated `config/mock-schemas.ts` and test assertions

### Completion Notes List

- ✅ Task 1: Created invoice DTOs — list with pagination, detail with line items/CQT code, PDF with digital signature
- ✅ Task 2: Created `MockInvoiceAdapter` following tariff port pattern
- ✅ Task 3: Updated `get-list.json` to new schema (was old format from project scaffolding), created `get-by-id.json` and `get-pdf.json`
- ✅ Task 4: Created 3 queries + 3 handlers — list passes filters, detail and PDF are pass-through
- ✅ Task 5: Created `InvoiceController` with 3 endpoints + query param validation (month, status, page, limit)
- ✅ Task 6: Updated `BillingModule` — added invoice port registration, InvoiceController, 3 handlers
- ✅ Task 7: 6 test files — port spec, 3 handler specs, controller spec, integration test

### Code Review Fixes (Amelia — CR)

- H1: Fixed mock data inconsistency — `get-list.json` totalAmount for INV-2026-001 aligned with `get-by-id.json` (123273)
- M2: Marked Task 5 unchecked subtasks as [x] — invoiceId + query param validation were implemented but not checked off
- M3: Added `InvoiceGetByIdSchema` + `InvoiceGetPdfSchema` to `config/mock-schemas.ts` and updated `port-registry.spec.ts` to validate all 3 invoice methods
- M4: Added YYYY-MM regex to `period` field in `InvoiceListItemSchema` + `InvoiceDetailSchema` for response validation consistency
- L5: Added `.min(10)` to `digitalSignature` in `InvoicePdfSchema` to reject trivially short values

### File List

**New files:**
- `src/modules/billing/application/dtos/invoice.dto.ts`
- `src/modules/billing/infrastructure/ports/invoice.port.ts`
- `src/modules/billing/application/queries/get-invoice-list.query.ts`
- `src/modules/billing/application/queries/get-invoice-detail.query.ts`
- `src/modules/billing/application/queries/get-invoice-pdf.query.ts`
- `src/modules/billing/application/queries/handlers/get-invoice-list.handler.ts`
- `src/modules/billing/application/queries/handlers/get-invoice-detail.handler.ts`
- `src/modules/billing/application/queries/handlers/get-invoice-pdf.handler.ts`
- `src/modules/billing/infrastructure/http/invoice.controller.ts`
- `mocks/invoice/get-by-id.json`
- `mocks/invoice/get-pdf.json`
- `src/modules/billing/infrastructure/ports/invoice.port.spec.ts`
- `src/modules/billing/application/queries/handlers/get-invoice-list.handler.spec.ts`
- `src/modules/billing/application/queries/handlers/get-invoice-detail.handler.spec.ts`
- `src/modules/billing/application/queries/handlers/get-invoice-pdf.handler.spec.ts`
- `src/modules/billing/infrastructure/http/invoice.controller.spec.ts`
- `test/integration/invoice.spec.ts`

**Modified files:**
- `src/modules/billing/billing.module.ts` — Added MockInvoiceAdapter, InvoiceController, invoice port registration
- `src/modules/billing/application/queries/index.ts` — Added 3 new query exports
- `src/modules/billing/application/index.ts` — Added invoice.dto exports
- `mocks/invoice/get-list.json` — Updated from old `{ data, pagination }` to new `{ invoices, totalCount, page, limit, totalPages }` schema
- `config/mock-schemas.ts` — Updated InvoiceGetListSchema to match new DTO structure + added InvoiceGetByIdSchema, InvoiceGetPdfSchema
- `test/integration/port-registry.spec.ts` — Updated InvoiceMockAdapter to validate all 3 invoice methods
- `src/modules/billing/application/dtos/invoice.dto.ts` — Added period YYYY-MM regex, digitalSignature `.min(10)` (review fix)
- `mocks/invoice/get-list.json` — Fixed totalAmount for INV-2026-001 to match get-by-id.json (review fix)
