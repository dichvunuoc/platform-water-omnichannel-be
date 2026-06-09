# Story 3.2: Tariff & Pricing Display

Status: done

## Story

As a **customer (Cô Nguyễn)**,
I want to understand how my water bill is calculated — the tiered pricing, fees, and total breakdown,
so that I'm never surprised by my bill amount.

## Acceptance Criteria

### AC1: Get Tariff Plan
**Given** an authenticated customer navigates to "My Pricing"
**When** the BFF receives the request
**Then** it calls `ITariffPort.getTariffPlan(contractId)` via PortRegistry
**And** returns the applicable tariff plan: tiered pricing table (residential bậc thang or special pricing for industrial), tier ranges (m³), price per tier.

### AC2: Get Tariff Breakdown (Invoice-Specific)
**Given** an authenticated customer views an invoice with tiered pricing
**When** they tap "Price Breakdown"
**Then** the BFF calls `ITariffPort.getTariffBreakdown(invoiceId)` via PortRegistry
**And** returns each tier: volume (m³) × price = subtotal, total before fees.

### AC3: Get Applicable Fees
**Given** an authenticated customer views the tariff breakdown
**When** the fees section loads
**Then** the BFF calls `ITariffPort.getApplicableFees(contractId)` via PortRegistry
**And** returns: environmental fee, drainage fee, VAT percentage, and any special surcharges.

### AC4: Static Cache Tier
**Given** tariff data is fetched successfully
**When** the response is cached
**Then** the cache key follows `cache:v2:port:tariff:{hash}` with TTL 12-24h (static tier, per api-endpoints.yaml).

## Tasks / Subtasks

- [x] Task 1: Create Billing Module Scaffold (AC: all)
  - [x] Create `src/modules/billing/domain/index.ts`
  - [x] Create `src/modules/billing/constants/tokens.ts` — `TARIFF_PORT_TOKEN`, `INVOICE_PORT_TOKEN` (future-proof)
  - [x] Create `src/modules/billing/application/index.ts`
  - [x] Create `src/modules/billing/application/queries/index.ts`

- [x] Task 2: Add DI Tokens for Billing Ports (AC: all)
  - [x] Add `TARIFF_PORT_TOKEN` to `src/modules/billing/constants/tokens.ts`
  - [x] Add `INVOICE_PORT_TOKEN` to `src/modules/billing/constants/tokens.ts` (placeholder for Story 3.3)

- [x] Task 3: Create Tariff DTOs (AC: #1, #2, #3)
  - [x] Create `src/modules/billing/application/dtos/tariff.dto.ts`
  - [x] Zod schemas: `TariffTierSchema` (fromVolume, toVolume, pricePerM3), `TariffPlanSchema` (planName, customerType, tiers array)
  - [x] Zod schemas: `TariffBreakdownTierSchema` (fromVolume, toVolume, volume, pricePerM3, subtotal), `TariffBreakdownSchema` (invoiceId, tiers, totalBeforeFees)
  - [x] Zod schemas: `ApplicableFeeSchema` (feeType, feeName, rate/amount, isPercentage), `ApplicableFeesResponseSchema` (fees array, vatPercentage)
  - [x] Input validation: `ContractIdParamSchema` — alphanumeric + dashes
  - [x] Input validation: `InvoiceIdParamSchema` — alphanumeric + dashes

- [x] Task 4: Create Tariff Port Interface & Mock Adapter (AC: #1, #2, #3)
  - [x] Create `src/modules/billing/infrastructure/ports/tariff.port.ts`
  - [x] Define `ITariffPort` interface extending `IPortAdapter`
  - [x] Create `MockTariffAdapter extends MockAdapterBase implements ITariffPort`
  - [x] Register schemas per method: `get-tariff-plan`, `get-tariff-breakdown`, `get-applicable-fees`

- [x] Task 5: Create Mock Data Files (AC: #1, #2, #3)
  - [x] Create `mocks/tariff/get-tariff-plan.json` — residential bậc thang (4-tier pricing table)
  - [x] Create `mocks/tariff/get-tariff-breakdown.json` — invoice-specific tier breakdown with subtotals
  - [x] Create `mocks/tariff/get-applicable-fees.json` — environmental fee, drainage fee, VAT, surcharges

- [x] Task 6: Create CQRS Queries & Handlers (AC: #1, #2, #3)
  - [x] Create `get-tariff-plan.query.ts` + handler — returns `TariffPlan` (tiered pricing table)
  - [x] Create `get-tariff-breakdown.query.ts` + handler — returns `TariffBreakdown` (invoice-specific breakdown)
  - [x] Create `get-applicable-fees.query.ts` + handler — returns `ApplicableFeesResponse` (fees list)
  - [x] Each handler: inject `PortRegistry`, call `portRegistry.execute<T>('tariff', method, params)`

- [x] Task 7: Create Billing Controller (AC: all)
  - [x] Create `src/modules/billing/infrastructure/http/tariff.controller.ts`
  - [x] `GET /billing/tariff/:contractId` → dispatch `GetTariffPlanQuery`
  - [x] `GET /billing/tariff/:contractId/breakdown?invoiceId=X` → dispatch `GetTariffBreakdownQuery`
  - [x] `GET /billing/tariff/:contractId/fees` → dispatch `GetApplicableFeesQuery`
  - [ ] Validate `contractId` param via `ContractIdParamSchema`

- [x] Task 8: Create Billing Module Registration (AC: all)
  - [x] Create `src/modules/billing/billing.module.ts`
  - [x] Add `MockTariffAdapter` provider with `useExisting` pattern
  - [x] Register `tariff` port with PortRegistry in `onModuleInit`
  - [x] Add query handlers to providers
  - [x] Register `BillingModule` in `src/app.module.ts`

- [x] Task 9: Write comprehensive tests (AC: all)
  - [x] `tariff.port.spec.ts` — Mock adapter reads JSON + Zod validates for each method
  - [x] `get-tariff-plan.handler.spec.ts` — Handler calls PortRegistry with contractId
  - [x] `get-tariff-breakdown.handler.spec.ts` — Handler calls PortRegistry with invoiceId
  - [x] `get-applicable-fees.handler.spec.ts` — Handler passes contractId correctly
  - [x] `tariff.controller.spec.ts` — 3 endpoints, contractId validation, query class types
  - [x] Integration: `test/integration/tariff.spec.ts` — QueryBus → Handler → PortRegistry → MockAdapter → JSON

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story creates a **NEW `billing` module** — the first story in the billing domain. The architecture specifies `modules/billing/` owns both `tariff` and `invoice` ports (Story 3.3 adds invoice).

#### BFF Does NOT Own Tariff Business Data

**Rule #1:** CSKH module NEVER owns business logic. Tariff/pricing data lives in the Backend API.
This story adds a **thin pass-through** — tariff plans, breakdowns, and fees are fetched from downstream, not computed in BFF.

#### What ALREADY EXISTS — DO NOT REINVENT

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **PortRegistry** | `src/libs/shared/port/port-registry.service.ts` | `register()` + `execute<T>()` |
| **MockAdapterBase** | `src/libs/shared/port/mock-adapter.base.ts` | Extend this |
| **IQuery** | `src/libs/core/application/` | Base query class |
| **QUERY_BUS_TOKEN** | `src/libs/core/constants/tokens.ts` | DI token for query bus |
| **IQueryBus** | `src/libs/core/application/` | Bus interface |
| **ValidationException** | `src/libs/core/common/` | For input validation errors |
| **SessionAuthGuard** | `src/modules/auth/infrastructure/guards/` | JWT auth guard |
| **@CurrentUser()** | `src/modules/auth/infrastructure/decorators/` | Extract userId from session |
| **MeterModule** | `src/modules/meter/meter.module.ts` | **EXACT TEMPLATE** — same pattern (two ports, one module) |
| **MeterController** | `src/modules/meter/infrastructure/http/meter.controller.ts` | Controller pattern reference |
| **All shared infrastructure** | Same as Stories 2.1–2.3, 3.1 | CQRS buses, exceptions, logger, auth propagation |

#### Tariff Port — Defined in api-endpoints.yaml (Story 1.1)

```yaml
# Already in api-endpoints.yaml — DO NOT DUPLICATE
tariff:
  adapter: mock
  timeout: 3000
  cacheTier: static
  circuitBreaker: { errorThreshold: 50, resetTimeout: 10000, minRequests: 5 }
```

#### Port Interface Catalog Entry

| # | Port Name | Interface | Methods | Cache Tier |
|---|-----------|-----------|---------|-----------|
| 6 | `tariff` | `ITariffPort` | get-tariff-plan, get-tariff-breakdown, get-applicable-fees | static (12-24h) |

**MVP methods for this story:** `get-tariff-plan`, `get-tariff-breakdown`, `get-applicable-fees`
**Not needed now:** `previewBill` (Phase 2)

#### ⚡ New Module — Billing

This is the **first story** in `modules/billing/`. Follow the exact pattern established by `modules/meter/` (created in Stories 2.3 and 3.1).

```
modules/billing/
  ├── domain/
  │   └── index.ts
  ├── application/
  │   ├── queries/
  │   │   ├── get-tariff-plan.query.ts                  ← NEW (AC#1)
  │   │   ├── get-tariff-breakdown.query.ts             ← NEW (AC#2)
  │   │   ├── get-applicable-fees.query.ts              ← NEW (AC#3)
  │   │   ├── handlers/
  │   │   │   ├── get-tariff-plan.handler.ts            ← NEW
  │   │   │   ├── get-tariff-breakdown.handler.ts       ← NEW
  │   │   │   └── get-applicable-fees.handler.ts        ← NEW
  │   │   └── index.ts
  │   ├── dtos/
  │   │   └── tariff.dto.ts                             ← NEW
  │   └── index.ts
  ├── infrastructure/
  │   ├── http/
  │   │   └── tariff.controller.ts                      ← NEW
  │   └── ports/
  │       ├── tariff.port.ts                            ← NEW
  │       └── tariff.port.spec.ts                       ← NEW
  ├── constants/
  │   └── tokens.ts                                     ← NEW
  └── billing.module.ts                                 ← NEW

mocks/tariff/                                            ← NEW directory
├── get-tariff-plan.json                                 ← NEW (4-tier residential)
├── get-tariff-breakdown.json                            ← NEW (invoice breakdown)
└── get-applicable-fees.json                             ← NEW (fees list)

test/integration/
└── tariff.spec.ts                                      ← NEW
```

Story 3.3 will extend this module with `invoice.port.ts` and `invoice.controller.ts` — same "two ports, one module" pattern as `MeterModule`.

### 🔧 Implementation Details

#### Tariff DTOs

```typescript
// src/modules/billing/application/dtos/tariff.dto.ts
import { z } from 'zod';

// =============================================================================
// AC#1: Tariff Plan (tiered pricing table)
// =============================================================================

export const TariffTierSchema = z.object({
  tier: z.number().int().positive(), // Tier number (1, 2, 3, 4)
  fromVolume: z.number().nonnegative(), // m³ start of tier
  toVolume: z.number().nullable(), // m³ end of tier (null = unlimited)
  pricePerM3: z.number().positive(), // VND per m³
});

export const TariffPlanSchema = z.object({
  planId: z.string(),
  planName: z.string(), // e.g. "Bậc thang sinh hoạt"
  customerType: z.enum(['residential', 'industrial', 'commercial', 'institutional']),
  applicableContractId: z.string(),
  tiers: z.array(TariffTierSchema).min(1),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
});

// =============================================================================
// AC#2: Tariff Breakdown (invoice-specific)
// =============================================================================

export const TariffBreakdownTierSchema = z.object({
  tier: z.number().int().positive(),
  fromVolume: z.number().nonnegative(),
  toVolume: z.number().nullable(),
  volume: z.number().nonnegative(), // m³ consumed in this tier
  pricePerM3: z.number().positive(), // VND per m³
  subtotal: z.number().nonnegative(), // volume × pricePerM3
});

export const TariffBreakdownSchema = z.object({
  invoiceId: z.string(),
  contractId: z.string(),
  tiers: z.array(TariffBreakdownTierSchema),
  totalBeforeFees: z.number().nonnegative(),
});

// =============================================================================
// AC#3: Applicable Fees
// =============================================================================

export const ApplicableFeeSchema = z.object({
  feeType: z.enum(['environmental', 'drainage', 'vat', 'surcharge']),
  feeName: z.string(), // Display name e.g. "Phí bảo vệ môi trường"
  rate: z.number().nonnegative(), // percentage or fixed amount
  isPercentage: z.boolean(), // true = rate is %, false = fixed VND
});

export const ApplicableFeesResponseSchema = z.object({
  contractId: z.string(),
  fees: z.array(ApplicableFeeSchema),
  vatPercentage: z.number().nonnegative(), // e.g. 5 (means 5%)
});

// =============================================================================
// Input Validation
// =============================================================================

export const ContractIdParamSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_]+$/, 'Invalid Contract ID format');
export const InvoiceIdParamSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_]+$/, 'Invalid Invoice ID format');

// =============================================================================
// TypeScript Types
// =============================================================================

export type TariffTier = z.infer<typeof TariffTierSchema>;
export type TariffPlan = z.infer<typeof TariffPlanSchema>;
export type TariffBreakdownTier = z.infer<typeof TariffBreakdownTierSchema>;
export type TariffBreakdown = z.infer<typeof TariffBreakdownSchema>;
export type ApplicableFee = z.infer<typeof ApplicableFeeSchema>;
export type ApplicableFeesResponse = z.infer<typeof ApplicableFeesResponseSchema>;
```

#### Tariff Port

```typescript
// src/modules/billing/infrastructure/ports/tariff.port.ts
import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  TariffPlanSchema,
  TariffBreakdownSchema,
  ApplicableFeesResponseSchema,
} from '../../application/dtos/tariff.dto';

export interface ITariffPort extends IPortAdapter {}

@Injectable()
export class MockTariffAdapter extends MockAdapterBase implements ITariffPort {
  constructor() {
    super(
      'tariff',
      {
        'get-tariff-plan': TariffPlanSchema,
        'get-tariff-breakdown': TariffBreakdownSchema,
        'get-applicable-fees': ApplicableFeesResponseSchema,
      },
      new Logger('tariff-mock-adapter'),
    );
  }
}
```

#### Controller

```typescript
// src/modules/billing/infrastructure/http/tariff.controller.ts
@ApiTags('Billing — Tariff')
@ApiBearerAuth('JWT-auth')
@Controller('billing/tariff')
export class TariffController {
  constructor(@Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus) {}

  @Get(':contractId')
  async getTariffPlan(@CurrentUser('id') userId: string, @Param('contractId') contractId: string) {
    this.validateContractId(contractId);
    return this.queryBus.execute(new GetTariffPlanQuery(userId, contractId));
  }

  @Get(':contractId/breakdown')
  async getTariffBreakdown(
    @CurrentUser('id') userId: string,
    @Param('contractId') contractId: string,
    @Query('invoiceId') invoiceId: string,
  ) {
    this.validateContractId(contractId);
    this.validateInvoiceId(invoiceId);
    return this.queryBus.execute(new GetTariffBreakdownQuery(userId, contractId, invoiceId));
  }

  @Get(':contractId/fees')
  async getApplicableFees(@CurrentUser('id') userId: string, @Param('contractId') contractId: string) {
    this.validateContractId(contractId);
    return this.queryBus.execute(new GetApplicableFeesQuery(userId, contractId));
  }
}
```

#### Module Registration

```typescript
// src/modules/billing/billing.module.ts
@Module({
  controllers: [TariffController],
  providers: [
    MockTariffAdapter,
    { provide: TARIFF_PORT_TOKEN, useExisting: MockTariffAdapter },
    GetTariffPlanHandler,
    GetTariffBreakdownHandler,
    GetApplicableFeesHandler,
  ],
  exports: [TARIFF_PORT_TOKEN],
})
export class BillingModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockTariffAdapter: MockTariffAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register('tariff', this.mockTariffAdapter, this.mockTariffAdapter);
  }
}
```

**Register in `app.module.ts`:** Add `BillingModule` to imports, following the existing module registration order (after `MeterModule`, before `AuthPropagationModule`).

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Add tariff to `meter` module | Create new `billing` module — tariff is billing domain, not meter domain |
| Compute tier breakdown in BFF | Pass through from Backend — tier breakdown is billing logic |
| Forget `useExisting` DI pattern | Use `useExisting: MockTariffAdapter` for single shared instance |
| Use `z.number()` without `positive()` for prices | Prices must be `z.number().positive()` — zero price is not a valid tariff |
| Put tariff under `GET /tariff` | Use `GET /billing/tariff` — follows module-scoped route convention |
| Forget to register `BillingModule` in `app.module.ts` | New module MUST be imported in root app module |
| Hardcode Vietnamese tier names | Use `planName` and `feeName` from downstream — display names are i18n concern |

### 🧪 Testing Requirements

1. **Mock adapter — get-tariff-plan** — Read JSON, validate Zod `TariffPlanSchema`, verify 4 tiers, check tier ranges
2. **Mock adapter — get-tariff-breakdown** — Read JSON, validate `TariffBreakdownSchema`, verify subtotals (volume × price)
3. **Mock adapter — get-applicable-fees** — Read JSON, validate `ApplicableFeesResponseSchema`, check fee types enum
4. **Query handler — get-tariff-plan** — Verify `portRegistry.execute('tariff', 'get-tariff-plan', { contractId })` returns `TariffPlan`
5. **Query handler — get-tariff-breakdown** — Verify handler passes invoiceId + contractId correctly
6. **Query handler — get-applicable-fees** — Verify handler passes contractId correctly
7. **Controller — GET /billing/tariff/:contractId** — Returns 200 with tariff plan
8. **Controller — GET /billing/tariff/:contractId/breakdown?invoiceId=X** — Returns breakdown
9. **Controller — GET /billing/tariff/:contractId/fees** — Returns fees list
10. **Controller — invalid contractId** — Returns 400 ValidationException
11. **Controller — missing invoiceId on breakdown** — Returns 400 ValidationException
12. **Controller — verify query class types** — `toBeInstanceOf()` assertions
13. **Integration — QueryBus → Handler → PortRegistry → MockAdapter → JSON** for all 3 methods

### Previous Story Learnings (Stories 2.1–3.1 — MUST Apply)

- **Module pattern:** `useExisting` for DI token provider — single shared adapter instance
- **getAuthenticatedUserId()** → `@CurrentUser('id') userId: string` pattern in controller
- **Port registration:** `PortRegistry.register()` in `onModuleInit()`
- **Input validation:** Validate URL params + query params with Zod schemas
- **Controller tests:** Verify query class types with `toBeInstanceOf()`
- **Integration test:** `CqrsModule` + `module.init()` for handler auto-discovery
- **Zod v4:** `z.record(z.string(), valueSchema)` — 2 args
- **Array wrapper pattern:** `{ items: [], totalCount: N }` for list endpoints
- **BFF-computed UI flags:** This story is pure pass-through — NO BFF computation needed
- **Barrel exports:** Update `application/index.ts` and `queries/index.ts` with new exports
- **323 tests passing** — ensure ZERO regressions

### 📋 Cross-Story Context

**This story's output is a dependency for:**
- **Story 3.3** (Invoice List & Detail) — Invoice detail shows tiered pricing breakdown from tariff port
- **Story 4.1** (Payment Initiation) — Payment amount calculated from tariff + fees

**Depends on (all complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Story 2.1 (Customer Profile — module pattern)
- Story 2.2 (Contract Lookup — controller validation pattern)
- Story 2.3 (Meter Information — module + port pattern)
- Story 3.1 (Consumption History — meter-reading port pattern, latest story)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2: Tariff & Pricing Display]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port Interface Catalog — tariff port (row 6)]
- [Source: _bmad-output/planning-artifacts/architecture.md#api-endpoints.yaml — tariff config (static cache)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure — modules/billing/]
- [Source: _bmad-output/project-context.md#Cache TTL Strategy — static tier 12-24h]
- [Source: _bmad-output/project-context.md#Naming Conventions — all naming rules]
- [Source: _bmad-output/project-context.md#Module Internal Structure — domain/application/infrastructure layers]
- [Source: src/modules/meter/meter.module.ts — Module registration pattern (useExisting + onModuleInit)]
- [Source: src/modules/meter/infrastructure/ports/meter.port.ts — Port interface + mock adapter template]
- [Source: src/modules/meter/infrastructure/http/meter.controller.ts — Controller endpoint pattern]
- [Source: config/api-endpoints.yaml — tariff config (static cache)]

## Dev Agent Record

### Agent Model Used

Claude GLM-5[1m]

### Debug Log References

- 359/359 tests passing — zero regressions from baseline (323 tests from Stories 1-3.1)

### Completion Notes List

- ✅ Task 1: Created billing module scaffold (domain, constants, application, queries barrel exports)
- ✅ Task 2: Created DI tokens — `TARIFF_PORT_TOKEN` + `INVOICE_PORT_TOKEN` (future-proofed for Story 3.3)
- ✅ Task 3: Created tariff DTOs — 4-tier bậc thang pricing, breakdown with subtotals, fees with VAT
- ✅ Task 4: Created `MockTariffAdapter` following exact meter-reading.port.ts pattern
- ✅ Task 5: Created 3 mock JSON files — realistic Vietnamese residential water pricing
- ✅ Task 6: Created 3 queries + 3 handlers — all pure pass-through via PortRegistry
- ✅ Task 7: Created `TariffController` with 3 endpoints + validation (contractId, invoiceId)
- ✅ Task 8: Created `BillingModule` with `onModuleInit` port registration, registered in `app.module.ts`
- ✅ Task 9: 6 test files — port spec, 3 handler specs, controller spec, integration test

### File List

**New files:**
- `src/modules/billing/domain/index.ts`
- `src/modules/billing/constants/tokens.ts`
- `src/modules/billing/application/index.ts`
- `src/modules/billing/application/queries/index.ts`
- `src/modules/billing/application/dtos/tariff.dto.ts`
- `src/modules/billing/application/queries/get-tariff-plan.query.ts`
- `src/modules/billing/application/queries/get-tariff-breakdown.query.ts`
- `src/modules/billing/application/queries/get-applicable-fees.query.ts`
- `src/modules/billing/application/queries/handlers/get-tariff-plan.handler.ts`
- `src/modules/billing/application/queries/handlers/get-tariff-breakdown.handler.ts`
- `src/modules/billing/application/queries/handlers/get-applicable-fees.handler.ts`
- `src/modules/billing/infrastructure/ports/tariff.port.ts`
- `src/modules/billing/infrastructure/http/tariff.controller.ts`
- `src/modules/billing/billing.module.ts`
- `mocks/tariff/get-tariff-plan.json`
- `mocks/tariff/get-tariff-breakdown.json`
- `mocks/tariff/get-applicable-fees.json`
- `src/modules/billing/infrastructure/ports/tariff.port.spec.ts`
- `src/modules/billing/application/queries/handlers/get-tariff-plan.handler.spec.ts`
- `src/modules/billing/application/queries/handlers/get-tariff-breakdown.handler.spec.ts`
- `src/modules/billing/application/queries/handlers/get-applicable-fees.handler.spec.ts`
- `src/modules/billing/infrastructure/http/tariff.controller.spec.ts`
- `test/integration/tariff.spec.ts`

**Modified files:**
- `src/app.module.ts` — Added BillingModule import and registration
