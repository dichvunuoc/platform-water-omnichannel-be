# Story 2.3: Meter Information & History

Status: done

## Story

As a **customer (Anh Tuấn)**,
I want to see my water meter details and calibration status,
so that I know my meter is working correctly and legally compliant.

## Acceptance Criteria

### AC1: Get Meter List (1 Customer : N Meters)
**Given** an authenticated customer navigates to "My Meter"
**When** the BFF receives the request
**Then** it calls `IMeterPort.getMeterByCustomer(customerId)` via PortRegistry
**And** returns a **list** of meters belonging to that customer: each entry includes serial number, type, diameter (DN), accuracy class, manufacture year
**And** the response shape is `{ meters: MeterInfo[], totalCount: number }` — because one customer may have multiple contracts, each with its own meter.

### AC2: Get Calibration Status
**Given** an authenticated customer views their meter info
**When** the calibration section loads
**Then** the BFF calls `IMeterPort.getCalibrationStatus(meterId)` via PortRegistry
**And** returns the calibration status: valid / expiring soon / expired
**And** the response includes an `isWarning: boolean` field — computed by the handler as `status === 'expiring_soon' || status === 'expired'` — so the frontend can show the warning badge without implementing if/else logic.

### AC3: Get Meter Replacement History
**Given** an authenticated customer views their meter info
**When** they tap "Replacement History"
**Then** the BFF calls `IMeterPort.getMeterHistory(meterId)` via PortRegistry
**And** returns a chronological list of meter installations, removals, and replacements with dates.

### AC4: Static Cache Tier
**Given** meter data is fetched successfully
**When** the response is cached
**Then** the cache key follows `cache:v2:port:meter:{hash}` with TTL 12-24h (static tier, per Story 1.2).

## Tasks / Subtasks

- [x] Task 1: Create Meter Module Structure & DI Tokens (AC: all)
  - [x] Create `src/modules/meter/constants/tokens.ts` — `METER_PORT_TOKEN`
  - [x] Create `src/modules/meter/domain/index.ts` — barrel export (no domain entities; BFF doesn't own meter data)
  - [x] Create `src/modules/meter/application/index.ts` — barrel export
  - [x] Create `src/modules/meter/application/dtos/meter.dto.ts` — Zod schemas + TS types for meter info, calibration status, history

- [x] Task 2: Create Meter Port Interface & Mock Adapter (AC: #1, #2, #3)
  - [x] Create `src/modules/meter/infrastructure/ports/meter.port.ts`
  - [x] Define `IMeterPort` interface extending `IPortAdapter`
  - [x] Define Zod schemas: `MeterInfoSchema`, `MeterListResponseSchema` (array wrapper), `CalibrationStatusResponseSchema` (with `isWarning`), `MeterHistoryResponseSchema`
  - [x] Create `MockMeterAdapter extends MockAdapterBase implements IMeterPort`

- [x] Task 3: Create Mock Data Files (AC: #1, #2, #3)
  - [x] Create `mocks/meter/get-meter-by-customer.json`
  - [x] Create `mocks/meter/get-calibration-status.json`
  - [x] Create `mocks/meter/get-meter-history.json`

- [x] Task 4: Create CQRS Queries & Handlers (AC: #1, #2, #3)
  - [x] Create `src/modules/meter/application/queries/get-meter-by-customer.query.ts` + handler — returns `MeterListResponse` (array)
  - [x] Create `src/modules/meter/application/queries/get-calibration-status.query.ts` + handler — maps `isWarning` from downstream status
  - [x] Create `src/modules/meter/application/queries/get-meter-history.query.ts` + handler
  - [x] Each handler: inject `PortRegistry`, call `portRegistry.execute<T>('meter', method, params)`

- [x] Task 5: Create Meter Controller (AC: all)
  - [x] Create `src/modules/meter/infrastructure/http/meter.controller.ts`
  - [x] `GET /meters` → dispatch `GetMeterByCustomerQuery` (returns array of meters)
  - [x] `GET /meters/:meterId/calibration` → dispatch `GetCalibrationStatusQuery` (returns status + `isWarning`)
  - [x] `GET /meters/:meterId/history` → dispatch `GetMeterHistoryQuery`
  - [x] Extract userId via `getAuthenticatedUserId()` pattern
  - [x] Validate `meterId` param via `MeterIdParamSchema` — regex: `^[a-zA-Z0-9-_]+$` (allows dashes, underscores for IoT/device IDs)

- [x] Task 6: Register Meter Module (AC: all)
  - [x] Create `src/modules/meter/meter.module.ts`
  - [x] Register MockMeterAdapter with `useExisting`, controllers, query handlers
  - [x] Register port with PortRegistry via `onModuleInit`
  - [x] Import `MeterModule` in `src/app.module.ts`

- [x] Task 7: Write comprehensive tests (AC: all)
  - [x] `meter.port.spec.ts` — Mock adapter reads JSON + Zod validates for each method
  - [x] `get-meter-by-customer.handler.spec.ts` — Handler calls PortRegistry with customerId
  - [x] `get-calibration-status.handler.spec.ts` — Handler passes meterId to port + isWarning computation
  - [x] `get-meter-history.handler.spec.ts` — Handler passes meterId to port
  - [x] `meter.controller.spec.ts` — All 3 endpoints, auth guard, query class types, meterId validation
  - [x] Integration: `test/integration/meter.spec.ts` — QueryBus → Handler → PortRegistry → MockAdapter → JSON

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This is the **third domain module** using the Port Registry pattern. Follow **Story 2.1** (Customer) and **Story 2.2** (Contract) as exact templates.

#### BFF Does NOT Own Meter Business Data

**Rule #1:** CSKH module NEVER owns business logic. Meter data lives in the Backend API.
This module is a **thin pass-through**: Controller → CQRS → Handler → PortRegistry → Adapter → Downstream.

#### What ALREADY EXISTS — DO NOT REINVENT

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **PortRegistry** | `src/libs/shared/port/port-registry.service.ts` | `register()` + `execute<T>()` |
| **MockAdapterBase** | `src/libs/shared/port/mock-adapter.base.ts` | Extend this |
| **ContractController** | `src/modules/contract/infrastructure/http/contract.controller.ts` | **EXACT TEMPLATE** — includes `validateContractId` pattern → adapt as `validateMeterId` |
| **ContractModule** | `src/modules/contract/contract.module.ts` | **EXACT TEMPLATE** — `useExisting` pattern |
| **ContractQueryDTO** | `src/modules/contract/application/dtos/contract-query.dto.ts` | `ContractIdParamSchema` pattern → rename for meter |
| **All shared infrastructure** | Same as Stories 2.1 & 2.2 | CQRS buses, exceptions, logger, auth propagation |

#### Meter Port — Defined in api-endpoints.yaml (Story 1.1)

```yaml
# Already in api-endpoints.yaml — DO NOT DUPLICATE
meter:
  adapter: mock
  timeout: 3000
  cacheTier: static
  circuitBreaker: { errorThreshold: 50, resetTimeout: 10000, minRequests: 5 }
```

#### Port Interface Catalog Entry

| # | Port Name | Interface | Methods | Cache Tier |
|---|-----------|-----------|---------|-----------|
| 4 | `meter` | `IMeterPort` | getMeterByCustomer, getMeterDetail, getMeterHistory, getCalibrationStatus | static |

**MVP methods for this story:** `get-meter-by-customer`, `get-calibration-status`, `get-meter-history`
**Not needed now:** `getMeterDetail` (covered by individual entries in getMeterByCustomer response)

#### ⚡ 1:N Relationship — Customer : Meters

One customer can have **multiple contracts**, each with its own meter. The `GET /meters` endpoint MUST return an **array**, not a single object.

```
Customer (USR-12345)
  ├── Contract CTR-001 → Meter MT-001 (DN15, sinh hoạt)
  ├── Contract CTR-002 → Meter MT-002 (DN20, sinh hoạt)
  └── Contract CTR-003 → Meter MT-003 (DN50, sản xuất — KCN)
```

**Response shape:**
```typescript
{
  "meters": [
    { "meterId": "MT-001", "serialNumber": "SN-2024-001", ... },
    { "meterId": "MT-002", "serialNumber": "SN-2024-002", ... },
    { "meterId": "MT-003", "serialNumber": "SN-2024-003", ... }
  ],
  "totalCount": 3
}
```

This pattern (array wrapper with `totalCount`) should be reused for ALL future list endpoints across the project.

#### ⚡ BFF-Computed UI Flags — `isWarning` Pattern

The downstream API returns raw data (`status: 'expired'`). BFF adds presentation-friendly flags so the frontend doesn't need to implement conditional logic:

```
Downstream response:  { status: 'expired', ... }
BFF handler adds:     { ...response, isWarning: true }
Frontend reads:       if (data.isWarning) → show red badge
```

**Rule:** `isWarning` goes in the **handler**, NOT in the mock JSON or port Zod schema. The mock JSON represents downstream data (no `isWarning`). The handler adds it after receiving the raw response.

This same pattern should apply to future stories: `isOverdue` for debt (Epic 4), `isUrgent` for tickets (Epic 5), etc.

### 📁 File Structure — Complete Map

```
src/modules/meter/
├── domain/
│   └── index.ts
├── application/
│   ├── queries/
│   │   ├── get-meter-by-customer.query.ts
│   │   ├── get-calibration-status.query.ts
│   │   ├── get-meter-history.query.ts
│   │   ├── handlers/
│   │   │   ├── get-meter-by-customer.handler.ts
│   │   │   ├── get-calibration-status.handler.ts
│   │   │   └── get-meter-history.handler.ts
│   │   └── index.ts
│   ├── dtos/
│   │   └── meter.dto.ts
│   └── index.ts
├── infrastructure/
│   ├── http/
│   │   └── meter.controller.ts
│   └── ports/
│       ├── meter.port.ts
│       └── meter.port.spec.ts
├── constants/
│   └── tokens.ts
└── meter.module.ts

mocks/meter/
├── get-meter-by-customer.json
├── get-calibration-status.json
└── get-meter-history.json

test/integration/
└── meter.spec.ts
```

**Modified Files:**
- `src/app.module.ts` — Add `MeterModule` to imports (after `ContractModule`)

### 🔧 Implementation Details

#### Meter DTOs

```typescript
// src/modules/meter/application/dtos/meter.dto.ts
import { z } from 'zod';

// AC#1: Single meter info — one customer may have MANY meters (1:N)
export const MeterInfoSchema = z.object({
  meterId: z.string(),
  serialNumber: z.string(),
  type: z.enum(['mechanical', 'ultrasonic', 'electromagnetic']),
  diameter: z.string(), // e.g. "DN15", "DN20"
  accuracyClass: z.string(), // e.g. "Class B", "Class C"
  manufactureYear: z.number(),
  installationDate: z.string(),
  status: z.enum(['active', 'removed', 'defective']),
});

// AC#1: Meter LIST response — array wrapper for 1:N relationship
export const MeterListResponseSchema = z.object({
  meters: z.array(MeterInfoSchema),
  totalCount: z.number(),
});

// AC#2: Calibration status — includes isWarning for frontend badge logic
export const CalibrationStatusResponseSchema = z.object({
  meterId: z.string(),
  status: z.enum(['valid', 'expiring_soon', 'expired']),
  isWarning: z.boolean(), // BFF-computed: true when status !== 'valid'
  lastCalibrationDate: z.string(),
  nextCalibrationDate: z.string(),
  certificateNumber: z.string().nullable(),
});

// AC#3: Meter history
export const MeterHistoryEntrySchema = z.object({
  eventDate: z.string(),
  eventType: z.enum(['installation', 'removal', 'replacement', 'calibration']),
  description: z.string(),
  performedBy: z.string(),
});

export const MeterHistoryResponseSchema = z.object({
  entries: z.array(MeterHistoryEntrySchema),
  totalCount: z.number(),
});

// Input validation — :meterId param (allows dashes + underscores for IoT/device IDs)
export const MeterIdParamSchema = z.object({
  meterId: z.string().regex(/^[a-zA-Z0-9-_]+$/, 'Invalid Meter ID format'),
});
```

#### Meter Controller

```typescript
@ApiTags('Meter')
@ApiBearerAuth('JWT-auth')
@Controller('meters')
export class MeterController {
  @Get()                              // GET /meters → GetMeterByCustomerQuery → returns MeterListResponse (array)
  @Get(':meterId/calibration')        // GET /meters/:meterId/calibration → GetCalibrationStatusQuery → includes isWarning
  @Get(':meterId/history')            // GET /meters/:meterId/history → GetMeterHistoryQuery
}
```

#### Calibration Handler — isWarning Mapping Logic

```typescript
// src/modules/meter/application/queries/handlers/get-calibration-status.handler.ts
@QueryHandler(GetCalibrationStatusQuery)
export class GetCalibrationStatusHandler implements IQueryHandler<GetCalibrationStatusQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetCalibrationStatusQuery) {
    const result = await this.portRegistry.execute<CalibrationStatusRaw>(
      'meter',
      'get-calibration-status',
      { meterId: query.meterId },
    );

    // BFF presentation logic: derive isWarning flag for frontend badge
    const isWarning = result.data.status === 'expiring_soon' || result.data.status === 'expired';

    return { ...result.data, isWarning };
  }
}
```

**Why `isWarning` is BFF-computed, not downstream:**
- The downstream API returns raw status (`valid` / `expiring_soon` / `expired`) — it's a data source, not a presentation layer.
- BFF is the **presentation orchestration layer** — it's BFF's job to add UI-friendly flags so the frontend doesn't need if/else logic.
- This follows the project's core principle: BFF transforms and coordinates, but doesn't own business rules.

#### AppModule Update

```typescript
// After ContractModule
import { MeterModule } from 'src/modules/meter/meter.module';
// ...
ContractModule,
MeterModule,          // ← ADD HERE
AuthPropagationModule,
```

### ⚠️ Anti-Patterns to Avoid

All anti-patterns from Stories 2.1 & 2.2 apply. Key additions:

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Return single meter object from `GET /meters` | Return `MeterListResponse` with `meters: array` — 1 Customer can have N Meters (multiple contracts) |
| Skip meterId validation | Use `MeterIdParamSchema` — regex `^[a-zA-Z0-9-_]+$` (allows dashes, underscores for IoT/device IDs) |
| Let frontend compute warning badge from status | BFF computes `isWarning: boolean` in handler — frontend just reads the flag |
| Put `isWarning` in downstream schema | `isWarning` is BFF-computed presentation logic — not in mock JSON or Zod schema for port response. Add it in the handler after receiving raw downstream data. |
| Use `z.string()` for URLs | Use `z.string().url()` where applicable |

### 🧪 Testing Requirements

1. **Mock adapter — get-meter-by-customer** — Read JSON, validate Zod `MeterListResponseSchema` (must be array), check meter fields
2. **Mock adapter — get-calibration-status** — Read JSON, validate status enum (note: mock JSON does NOT contain `isWarning` — that's handler-computed)
3. **Mock adapter — get-meter-history** — Read JSON, validate chronological entries
4. **Query handler — get-meter-by-customer** — Verify `portRegistry.execute('meter', 'get-meter-by-customer', { customerId })` returns `MeterListResponse` with `meters` array
5. **Query handler — get-calibration-status** — Verify meterId passed correctly AND `isWarning` is computed: `status='valid' → isWarning=false`, `status='expiring_soon' → isWarning=true`, `status='expired' → isWarning=true`
6. **Query handler — get-meter-history** — Verify meterId passed correctly
7. **Controller — GET /meters** — Returns 200 with `{ meters: [...], totalCount: N }` shape
8. **Controller — GET /meters/:meterId/calibration** — Returns calibration status with `isWarning` field
9. **Controller — GET /meters/:meterId/history** — Returns history entries
10. **Controller — unauthenticated** — Returns 401
11. **Controller — invalid meterId (special chars)** — Returns 400 ValidationException — test with `meterId: "INV@LID!"` → rejected by regex
12. **Controller — valid meterId with dashes/underscores** — `meterId: "MT-001_A"` → accepted by `MeterIdParamSchema`
13. **Controller — verify query class types** — `toBeInstanceOf()` assertions
14. **Integration — QueryBus → Handler → PortRegistry → MockAdapter → JSON**

### Previous Story Learnings (Stories 2.1 & 2.2 — MUST Apply)

- **Module pattern:** `useExisting` for DI token provider — single shared adapter instance
- **getAuthenticatedUserId()** — copy from AuthController
- **Port registration:** `PortRegistry.register()` in `onModuleInit()`
- **Input validation:** Validate URL params with Zod (`ContractIdParamSchema` → `MeterIdParamSchema` pattern)
- **Controller tests:** Verify query class types with `toBeInstanceOf()`
- **Integration test:** `CqrsModule` + `module.init()` for handler auto-discovery
- **Zod v4:** `z.record(z.string(), valueSchema)` — 2 args
- **1:N awareness:** When a customer can have multiple items (meters, contracts, invoices), always return an **array** with a wrapper object `{ items: [], totalCount: N }`. Never return a single object when the relationship is 1:N.
- **BFF-computed UI flags:** Derive presentation flags (`isWarning`, `isOverdue`, etc.) in handlers — don't push this logic to frontend or downstream.
- **225 tests passing across 30 suites** — ensure ZERO regressions

### 📋 Cross-Story Context

**This story's output is a dependency for:**
- **Story 3.1** (Consumption History) — Will reference meter for readings
- **Story 3.2** (Tariff Display) — Will reference meter for tariff lookup

**Depends on (all complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Story 2.1 (Customer Profile — module pattern)
- Story 2.2 (Contract Lookup — controller validation pattern)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3: Meter Information & History]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port Interface Catalog — meter port (row 4)]
- [Source: _bmad-output/planning-artifacts/architecture.md#api-endpoints.yaml — meter config]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure — modules/meter/]
- [Source: src/modules/contract/infrastructure/http/contract.controller.ts — CANONICAL TEMPLATE (with input validation)]
- [Source: src/modules/contract/contract.module.ts — Module registration template]
- [Source: src/app.module.ts — Module import order]

## Dev Agent Record

### Agent Model Used

Dev Agent (Amelia) — Claude Code

### Debug Log References

### Completion Notes List

- ✅ Task 1: Module structure — DI tokens, empty domain barrel, DTOs with Zod schemas (MeterInfo + MeterListResponse for 1:N, CalibrationStatusRaw + extended with isWarning, MeterHistory, MeterIdParamSchema)
- ✅ Task 2: Port interface + Mock adapter — IMeterPort extends IPortAdapter, MockMeterAdapter with CalibrationStatusRawSchema (no isWarning in mock — BFF-computed)
- ✅ Task 3: Mock JSON files — 3 realistic Vietnamese water utility meter datasets (list with 3 meters, calibration expiring_soon, history with installation/calibration/replacement)
- ✅ Task 4: CQRS queries + handlers — 3 query classes + 3 handlers. GetCalibrationStatusHandler computes isWarning from raw downstream status (valid→false, expiring_soon/expired→true)
- ✅ Task 5: Controller with 3 endpoints + getAuthenticatedUserId() + MeterIdParamSchema validation (regex allows dashes/underscores for IoT IDs)
- ✅ Task 6: MeterModule with onModuleInit PortRegistry registration, useExisting pattern, imported in AppModule after ContractModule
- ✅ Task 7: 4 test files — port spec (15 tests), handler specs (16 tests), controller spec (18 tests). 266 total tests passing, 0 regressions
- ⬜ Integration test deferred (follows contract module integration test pattern — needs Test module with CqrsModule + PortModule)
- ✅ Code Review fixes applied:
  - M1: Created integration test `test/integration/meter.spec.ts` (5 tests covering AC#1, AC#2, AC#3 end-to-end)
  - M2: Added `customerId` to calibration/history handler port calls for future ownership validation
  - L1: Added `.int().min(1990)` to `manufactureYear` Zod schema for realistic bounds

### File List

**New Files:**
- `src/modules/meter/constants/tokens.ts`
- `src/modules/meter/domain/index.ts`
- `src/modules/meter/application/index.ts`
- `src/modules/meter/application/dtos/meter.dto.ts`
- `src/modules/meter/application/queries/index.ts`
- `src/modules/meter/application/queries/get-meter-by-customer.query.ts`
- `src/modules/meter/application/queries/get-calibration-status.query.ts`
- `src/modules/meter/application/queries/get-meter-history.query.ts`
- `src/modules/meter/application/queries/handlers/get-meter-by-customer.handler.ts`
- `src/modules/meter/application/queries/handlers/get-calibration-status.handler.ts`
- `src/modules/meter/application/queries/handlers/get-meter-history.handler.ts`
- `src/modules/meter/infrastructure/ports/meter.port.ts`
- `src/modules/meter/infrastructure/http/meter.controller.ts`
- `src/modules/meter/meter.module.ts`
- `mocks/meter/get-meter-by-customer.json`
- `mocks/meter/get-calibration-status.json`
- `mocks/meter/get-meter-history.json`

**Test Files:**
- `src/modules/meter/infrastructure/ports/meter.port.spec.ts`
- `src/modules/meter/application/queries/handlers/get-meter-by-customer.handler.spec.ts`
- `src/modules/meter/application/queries/handlers/get-calibration-status.handler.spec.ts`
- `src/modules/meter/application/queries/handlers/get-meter-history.handler.spec.ts`
- `src/modules/meter/infrastructure/http/meter.controller.spec.ts`
- `test/integration/meter.spec.ts`

**Modified Files:**
- `src/app.module.ts` — Added MeterModule import after ContractModule
- `src/modules/meter/application/dtos/meter.dto.ts` — Added `.int().min(1990)` to manufactureYear
- `src/modules/meter/application/queries/handlers/get-calibration-status.handler.ts` — Added customerId to port call
- `src/modules/meter/application/queries/handlers/get-meter-history.handler.ts` — Added customerId to port call
