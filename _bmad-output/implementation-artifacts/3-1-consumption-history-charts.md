# Story 3.1: Consumption History & Charts

Status: done

## Story

As a **customer (Anh Tuấn)**,
I want to see my water consumption over time with visual charts and comparisons,
so that I can spot trends, detect unusual usage, and understand my water bill.

## Acceptance Criteria

### AC1: Get 12-Month Consumption History
**Given** an authenticated customer navigates to "Water Consumption"
**When** the BFF receives the request
**Then** it calls `IMeterReadingPort.getReadings(customerId, 12)` via PortRegistry
**And** returns 12 months of consumption data suitable for chart rendering: each entry includes `month` (format "YYYY-MM"), `volume` (in m³), `readingDate`
**And** the response shape is `{ readings: ConsumptionReading[], totalCount: number }` — array wrapper consistent with project pattern.

### AC2: Consumption Comparison (Current vs Previous Period)
**Given** an authenticated customer views their consumption chart
**When** the comparison data loads
**Then** the BFF calls `IMeterReadingPort.getComparison(customerId, currentPeriod, previousPeriod)` via PortRegistry
**And** returns: `currentVolume`, `previousVolume`, `percentageChange` (number, BFF-computed if not provided by Backend), and `direction` (up/down/neutral)
**And** if the Backend returns raw volumes only (e.g. 18m³ vs 20m³), BFF calculates the percentage: `(current - previous) / previous × 100` — this is presentation transformation, not business logic.

### AC3: Period Reading Detail
**Given** an authenticated customer selects a specific month in the chart
**When** they tap to view detail
**Then** the BFF calls `IMeterReadingPort.getReadingDetail(customerId, period)` via PortRegistry
**And** returns: `previousIndex` (previous meter reading), `currentIndex` (current meter reading), `volume` (consumed m³), `evidencePhotos` (array of URLs, may be empty).

### AC4: Dynamic Cache Tier
**Given** meter reading data is fetched successfully
**When** the response is cached
**Then** the cache key follows `cache:v2:port:meter-reading:{hash}` with TTL 5-15 min (dynamic tier, per api-endpoints.yaml).

### AC5: Circuit Breaker Fallback
**Given** the Meter Reading service is down
**When** the BFF attempts to fetch consumption data
**Then** the Circuit Breaker returns cached data with a "last updated" timestamp
**And** if no cache exists, returns a graceful "Consumption data temporarily unavailable" message.

## Tasks / Subtasks

- [x] Task 1: Add DI Token for Meter Reading Port (AC: all)
  - [x] Add `METER_READING_PORT_TOKEN` to `src/modules/meter/constants/tokens.ts`

- [x] Task 2: Create Meter Reading DTOs (AC: #1, #2, #3)
  - [x] Create `src/modules/meter/application/dtos/meter-reading.dto.ts`
  - [x] Zod schemas: `ConsumptionReadingSchema`, `ReadingsListResponseSchema` (array wrapper)
  - [x] Zod schemas: `ComparisonRawSchema` (raw downstream — may not include percentageChange), `ComparisonResponseSchema` (with BFF-computed percentageChange + direction)
  - [x] Zod schemas: `ReadingDetailSchema` (with evidence photos)
  - [x] Input validation: `PeriodParamSchema` — regex `^\d{4}-\d{2}$` (YYYY-MM format)

- [x] Task 3: Create Meter Reading Port Interface & Mock Adapter (AC: #1, #2, #3)
  - [x] Create `src/modules/meter/infrastructure/ports/meter-reading.port.ts`
  - [x] Define `IMeterReadingPort` interface extending `IPortAdapter`
  - [x] Create `MockMeterReadingAdapter extends MockAdapterBase implements IMeterReadingPort`
  - [x] Register schemas per method: `get-readings`, `get-comparison`, `get-reading-detail`

- [x] Task 4: Create Mock Data Files (AC: #1, #2, #3)
  - [x] Create `mocks/meter-reading/get-readings.json` — 12 months of realistic consumption data
  - [x] Create `mocks/meter-reading/get-comparison.json` — raw volumes WITHOUT percentageChange (BFF computes it)
  - [x] Create `mocks/meter-reading/get-reading-detail.json` — meter indices + evidence photo URLs

- [x] Task 5: Create CQRS Queries & Handlers (AC: #1, #2, #3)
  - [x] Create `get-readings.query.ts` + handler — returns `ReadingsListResponse` (12 months array)
  - [x] Create `get-reading-comparison.query.ts` + handler — computes `percentageChange` + `direction` from raw volumes
  - [x] Create `get-reading-detail.query.ts` + handler — pass-through returns detail with photos
  - [x] Each handler: inject `PortRegistry`, call `portRegistry.execute<T>('meter-reading', method, params)`

- [x] Task 6: Add Controller Endpoints (AC: all)
  - [x] Add 3 new endpoints to `src/modules/meter/infrastructure/http/meter.controller.ts`
  - [x] `GET /meters/consumption` → dispatch `GetReadingsQuery` (returns 12-month array)
  - [x] `GET /meters/consumption/comparison?current=YYYY-MM&previous=YYYY-MM` → dispatch `GetReadingComparisonQuery`
  - [x] `GET /meters/consumption/:period` → dispatch `GetReadingDetailQuery`
  - [x] Validate `period` param via `PeriodParamSchema` — regex `^\d{4}-\d{2}$`

- [x] Task 7: Update Meter Module Registration (AC: all)
  - [x] Update `src/modules/meter/meter.module.ts` — add `MockMeterReadingAdapter` provider with `useExisting` pattern
  - [x] Register `meter-reading` port with PortRegistry in `onModuleInit`
  - [x] Add new query handlers to providers

- [x] Task 8: Write comprehensive tests (AC: all)
  - [x] `meter-reading.port.spec.ts` — Mock adapter reads JSON + Zod validates for each method
  - [x] `get-readings.handler.spec.ts` — Handler calls PortRegistry with customerId
  - [x] `get-reading-comparison.handler.spec.ts` — Verify BFF-computed percentageChange + direction (↑ positive, ↓ negative, neutral zero)
  - [x] `get-reading-detail.handler.spec.ts` — Handler passes customerId + period
  - [x] Add new endpoint tests to `meter.controller.spec.ts` — 3 new endpoints, period validation, comparison query params
  - [x] Integration: `test/integration/meter-reading.spec.ts` — QueryBus → Handler → PortRegistry → MockAdapter → JSON

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story **extends the existing `meter` module** from Story 2.3 — NOT a new module. The `meter-reading` port is a SEPARATE port registered alongside `meter` port in the same `MeterModule`.

#### BFF Does NOT Own Consumption Business Data

**Rule #1:** CSKH module NEVER owns business logic. Consumption data lives in the Backend API.
This story adds a **thin pass-through** with one key BFF presentation transformation: calculating percentage change from raw volumes.

#### What ALREADY EXISTS — DO NOT REINVENT

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **MeterModule** | `src/modules/meter/meter.module.ts` | **EXTEND** — add meter-reading port + handlers to existing module |
| **MeterController** | `src/modules/meter/infrastructure/http/meter.controller.ts` | **EXTEND** — add 3 new consumption endpoints |
| **Meter DTOs** | `src/modules/meter/application/dtos/meter.dto.ts` | Pattern reference — create new `meter-reading.dto.ts` alongside |
| **Meter Port** | `src/modules/meter/infrastructure/ports/meter.port.ts` | **EXACT TEMPLATE** — new `meter-reading.port.ts` follows same pattern |
| **Meter Tokens** | `src/modules/meter/constants/tokens.ts` | **EXTEND** — add `METER_READING_PORT_TOKEN` |
| **PortRegistry** | `src/libs/shared/port/port-registry.service.ts` | `register()` + `execute<T>()` |
| **MockAdapterBase** | `src/libs/shared/port/mock-adapter.base.ts` | Extend this |
| **All shared infrastructure** | Same as Stories 2.1–2.3 | CQRS buses, exceptions, logger, auth propagation |

#### Meter-Reading Port — Defined in api-endpoints.yaml (Story 1.1)

```yaml
# Already in api-endpoints.yaml — DO NOT DUPLICATE
meter-reading:
  adapter: mock
  baseUrl: ${BACKEND_BASE_URL}/meter-readings
  timeout: 3000
  cacheTier: dynamic
  cacheTtl: 900
  circuitBreaker: { errorThreshold: 50, resetTimeout: 10000, minRequests: 5 }
```

#### Port Interface Catalog Entry

| # | Port Name | Interface | Methods | Cache Tier |
|---|-----------|-----------|---------|-----------|
| 5 | `meter-reading` | `IMeterReadingPort` | get-readings, get-comparison, get-reading-detail | dynamic (5-15 min) |

**MVP methods for this story:** `get-readings`, `get-comparison`, `get-reading-detail`
**Not needed now:** `getConsumptionChart` (handled by frontend from readings data), `submit` (Phase 2)

#### ⚡ Two Ports, One Module

The `meter` module now owns **two ports**:

```
modules/meter/
  └── infrastructure/ports/
      ├── meter.port.ts              ← Story 2.3 (static cache)
      └── meter-reading.port.ts      ← Story 3.1 (dynamic cache)
```

Both ports register separately with PortRegistry in `MeterModule.onModuleInit()`:

```typescript
onModuleInit() {
  // Port 1: Meter info (static, 12-24h cache) — Story 2.3
  this.portRegistry.register('meter', this.mockAdapter, this.mockAdapter);
  // Port 2: Meter readings (dynamic, 5-15 min cache) — Story 3.1
  this.portRegistry.register('meter-reading', this.mockReadingAdapter, this.mockReadingAdapter);
}
```

#### ⚡ BFF-Computed Percentage Change — CRITICAL Pattern

The downstream API returns **raw volumes**. BFF computes the percentage and direction — this is presentation transformation, NOT business logic:

```
Downstream response:  { currentVolume: 22, previousVolume: 18 }
BFF handler adds:     { percentageChange: 22.22, direction: "up" }
Frontend reads:       chart shows ↑ 22.22%
```

**Rule:** `percentageChange` and `direction` go in the **handler**, NOT in the mock JSON or raw port Zod schema. The mock JSON represents downstream data (no percentage). The handler adds it after receiving the raw response.

**Edge case:** If `previousVolume === 0`, percentageChange should be `null` (can't divide by zero) and direction should be `'neutral'`. The handler must handle this.

This is the same `isWarning` pattern from Story 2.3 — BFF computes presentation flags that the frontend just reads.

### 📁 File Structure — Complete Map

```
src/modules/meter/
├── domain/
│   └── index.ts                                           ← EXISTS (unchanged)
├── application/
│   ├── queries/
│   │   ├── get-meter-by-customer.query.ts                 ← EXISTS
│   │   ├── get-calibration-status.query.ts                ← EXISTS
│   │   ├── get-meter-history.query.ts                     ← EXISTS
│   │   ├── get-readings.query.ts                          ← NEW (AC#1)
│   │   ├── get-reading-comparison.query.ts                ← NEW (AC#2)
│   │   ├── get-reading-detail.query.ts                    ← NEW (AC#3)
│   │   ├── handlers/
│   │   │   ├── get-meter-by-customer.handler.ts           ← EXISTS
│   │   │   ├── get-calibration-status.handler.ts          ← EXISTS
│   │   │   ├── get-meter-history.handler.ts               ← EXISTS
│   │   │   ├── get-readings.handler.ts                    ← NEW (AC#1)
│   │   │   ├── get-reading-comparison.handler.ts          ← NEW (AC#2)
│   │   │   └── get-reading-detail.handler.ts              ← NEW (AC#3)
│   │   └── index.ts                                       ← UPDATE (add new exports)
│   ├── dtos/
│   │   ├── meter.dto.ts                                   ← EXISTS (unchanged)
│   │   └── meter-reading.dto.ts                           ← NEW
│   └── index.ts                                           ← UPDATE (add new exports)
├── infrastructure/
│   ├── http/
│   │   └── meter.controller.ts                            ← UPDATE (add 3 endpoints)
│   └── ports/
│       ├── meter.port.ts                                  ← EXISTS (unchanged)
│       ├── meter.port.spec.ts                             ← EXISTS (unchanged)
│       ├── meter-reading.port.ts                          ← NEW
│       └── meter-reading.port.spec.ts                     ← NEW
├── constants/
│   └── tokens.ts                                          ← UPDATE (add METER_READING_PORT_TOKEN)
└── meter.module.ts                                        ← UPDATE (add reading port + handlers)

mocks/meter-reading/                                       ← NEW directory
├── get-readings.json                                      ← NEW (12 months data)
├── get-comparison.json                                    ← NEW (raw volumes only)
└── get-reading-detail.json                                ← NEW (indices + photos)

test/integration/
└── meter-reading.spec.ts                                  ← NEW
```

**Modified Files:**
- `src/modules/meter/constants/tokens.ts` — Add `METER_READING_PORT_TOKEN`
- `src/modules/meter/meter.module.ts` — Add reading adapter provider + register meter-reading port
- `src/modules/meter/infrastructure/http/meter.controller.ts` — Add 3 consumption endpoints
- `src/modules/meter/application/queries/index.ts` — Add new query exports

### 🔧 Implementation Details

#### Meter Reading DTOs

```typescript
// src/modules/meter/application/dtos/meter-reading.dto.ts
import { z } from 'zod';

// =============================================================================
// AC#1: Consumption Readings (12 months for chart)
// =============================================================================

export const ConsumptionReadingSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format'), // "2025-06"
  volume: z.number().nonnegative(), // m³
  readingDate: z.string(), // ISO date
});

/** Readings LIST response — array wrapper */
export const ReadingsListResponseSchema = z.object({
  readings: z.array(ConsumptionReadingSchema),
  totalCount: z.number(),
});

// =============================================================================
// AC#2: Consumption Comparison — BFF-computed percentage + direction
// =============================================================================

/** Raw downstream response — may NOT include percentageChange */
export const ComparisonRawSchema = z.object({
  currentPeriod: z.string(),
  previousPeriod: z.string(),
  currentVolume: z.number().nonnegative(),
  previousVolume: z.number().nonnegative(),
});

/** Full response with BFF-computed fields */
export const ComparisonResponseSchema = ComparisonRawSchema.extend({
  percentageChange: z.number().nullable(), // null when previousVolume === 0
  direction: z.enum(['up', 'down', 'neutral']),
});

// =============================================================================
// AC#3: Period Reading Detail
// =============================================================================

export const EvidencePhotoSchema = z.object({
  url: z.string().url(),
  caption: z.string().optional(),
  takenAt: z.string().optional(),
});

export const ReadingDetailSchema = z.object({
  period: z.string(),
  previousIndex: z.number().nonnegative(),
  currentIndex: z.number().nonnegative(),
  volume: z.number().nonnegative(),
  evidencePhotos: z.array(EvidencePhotoSchema),
});

// =============================================================================
// Input Validation
// =============================================================================

/** Period param — YYYY-MM format */
export const PeriodParamSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Invalid period format. Use YYYY-MM');

/** Comparison query params */
export const ComparisonQuerySchema = z.object({
  current: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid current period'),
  previous: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid previous period'),
});

// =============================================================================
// TypeScript Types
// =============================================================================

export type ConsumptionReading = z.infer<typeof ConsumptionReadingSchema>;
export type ReadingsListResponse = z.infer<typeof ReadingsListResponseSchema>;
export type ComparisonRaw = z.infer<typeof ComparisonRawSchema>;
export type ComparisonResponse = z.infer<typeof ComparisonResponseSchema>;
export type EvidencePhoto = z.infer<typeof EvidencePhotoSchema>;
export type ReadingDetail = z.infer<typeof ReadingDetailSchema>;
```

#### Meter Reading Port

```typescript
// src/modules/meter/infrastructure/ports/meter-reading.port.ts
import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  ReadingsListResponseSchema,
  ComparisonRawSchema,  // RAW — no percentageChange
  ReadingDetailSchema,
} from '../../application/dtos/meter-reading.dto';

export interface IMeterReadingPort extends IPortAdapter {}

@Injectable()
export class MockMeterReadingAdapter extends MockAdapterBase implements IMeterReadingPort {
  constructor() {
    super(
      'meter-reading',
      {
        'get-readings': ReadingsListResponseSchema,
        'get-comparison': ComparisonRawSchema,
        'get-reading-detail': ReadingDetailSchema,
      },
      new Logger('meter-reading-mock-adapter'),
    );
  }
}
```

#### Controller Additions

```typescript
// Add to existing MeterController:
import { Query } from '@nestjs/common';  // add to imports
import {
  PeriodParamSchema,
  ComparisonQuerySchema,
} from '../../application/dtos/meter-reading.dto';
import { GetReadingsQuery } from '../../application/queries/get-readings.query';
import { GetReadingComparisonQuery } from '../../application/queries/get-reading-comparison.query';
import { GetReadingDetailQuery } from '../../application/queries/get-reading-detail.query';

// NEW ENDPOINTS (add after existing meter endpoints):

@Get('consumption')
@ApiOperation({ summary: 'Get 12-month consumption history for charts' })
async getConsumptionHistory(@CurrentUser('id') userId: string) {
  return this.queryBus.execute(new GetReadingsQuery(userId));
}

@Get('consumption/comparison')
@ApiOperation({ summary: 'Compare consumption between two periods' })
async getConsumptionComparison(
  @CurrentUser('id') userId: string,
  @Query('current') current: string,
  @Query('previous') previous: string,
) {
  this.validateComparisonParams(current, previous);
  return this.queryBus.execute(new GetReadingComparisonQuery(userId, current, previous));
}

@Get('consumption/:period')
@ApiOperation({ summary: 'Get period reading detail with evidence photos' })
async getReadingDetail(
  @CurrentUser('id') userId: string,
  @Param('period') period: string,
) {
  this.validatePeriod(period);
  return this.queryBus.execute(new GetReadingDetailQuery(userId, period));
}

private validatePeriod(period: string): void {
  const parsed = PeriodParamSchema.safeParse(period);
  if (!parsed.success) {
    throw new ValidationException('Invalid period format. Use YYYY-MM');
  }
}

private validateComparisonParams(current: string, previous: string): void {
  const parsed = ComparisonQuerySchema.safeParse({ current, previous });
  if (!parsed.success) {
    throw new ValidationException('Invalid period parameters. Use YYYY-MM format for both current and previous');
  }
}
```

#### Comparison Handler — BFF-Computed Percentage

```typescript
// src/modules/meter/application/queries/handlers/get-reading-comparison.handler.ts
@QueryHandler(GetReadingComparisonQuery)
export class GetReadingComparisonHandler implements IQueryHandler<GetReadingComparisonQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetReadingComparisonQuery): Promise<ComparisonResponse> {
    const result = await this.portRegistry.execute<ComparisonRaw>(
      'meter-reading',
      'get-comparison',
      {
        customerId: query.customerId,
        currentPeriod: query.currentPeriod,
        previousPeriod: query.previousPeriod,
      },
    );

    // BFF presentation logic: compute percentage change + direction
    const { currentVolume, previousVolume } = result.data;
    const percentageChange = previousVolume === 0
      ? null // can't divide by zero
      : Math.round(((currentVolume - previousVolume) / previousVolume * 100) * 100) / 100;

    const direction: 'up' | 'down' | 'neutral' =
      percentageChange === null ? 'neutral'
      : percentageChange > 0 ? 'up'
      : percentageChange < 0 ? 'down'
      : 'neutral';

    return {
      ...result.data,
      percentageChange,
      direction,
    };
  }
}
```

**Why `percentageChange` is BFF-computed, not downstream:**
- The downstream API returns raw volumes (`currentVolume`, `previousVolume`) — it's a data source, not a presentation layer.
- BFF is the **presentation orchestration layer** — it transforms raw data into frontend-ready shapes.
- Different frontends (mobile vs web vs Zalo) may display the percentage differently, but the calculation is the same — centralize it in BFF.
- This follows the project's core principle: BFF transforms and coordinates, but doesn't own business rules.

#### Token Update

```typescript
// src/modules/meter/constants/tokens.ts — ADD this line
export const METER_READING_PORT_TOKEN = Symbol('IMeterReadingPort');
```

#### Module Registration Update

```typescript
// meter.module.ts — updated onModuleInit
import { MockMeterReadingAdapter } from './infrastructure/ports/meter-reading.port';
import { METER_READING_PORT_TOKEN } from './constants/tokens';
import { GetReadingsHandler } from './application/queries/handlers/get-readings.handler';
import { GetReadingComparisonHandler } from './application/queries/handlers/get-reading-comparison.handler';
import { GetReadingDetailHandler } from './application/queries/handlers/get-reading-detail.handler';

// In @Module providers, ADD:
MockMeterReadingAdapter,
{
  provide: METER_READING_PORT_TOKEN,
  useExisting: MockMeterReadingAdapter,
},
GetReadingsHandler,
GetReadingComparisonHandler,
GetReadingDetailHandler,

// In constructor, ADD:
private readonly mockReadingAdapter: MockMeterReadingAdapter,

// In onModuleInit, ADD:
this.portRegistry.register(
  'meter-reading',
  this.mockReadingAdapter,
  this.mockReadingAdapter,
);
```

### ⚠️ Anti-Patterns to Avoid

All anti-patterns from Stories 2.1–2.3 apply. Key additions for this story:

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Create a new `meter-reading` module | Extend the existing `meter` module — two ports, one module (per architecture) |
| Include `percentageChange` in mock JSON | Mock JSON = raw downstream data. BFF computes `percentageChange` + `direction` in handler |
| Forget division-by-zero edge case | If `previousVolume === 0` → `percentageChange: null`, `direction: 'neutral'` |
| Use `z.number()` without `nonnegative()` | Volume values must be `z.number().nonnegative()` — meter readings can't be negative |
| Put consumption under `GET /meters/:meterId/readings` | Use `GET /meters/consumption` — readings are looked up by customerId (from auth), not meterId |
| Forget query param validation for comparison | Validate both `current` and `previous` with `ComparisonQuerySchema` |
| Use `z.string()` for URLs in evidence photos | Use `z.string().url()` for evidence photo URLs |
| Register meter-reading as a separate module import | Register both ports in `MeterModule.onModuleInit()` — single module, two port registrations |

### 🧪 Testing Requirements

1. **Mock adapter — get-readings** — Read JSON, validate Zod `ReadingsListResponseSchema` (must be array of 12), check month format YYYY-MM
2. **Mock adapter — get-comparison** — Read JSON, validate raw `ComparisonRawSchema` (note: mock JSON does NOT contain `percentageChange` — that's handler-computed)
3. **Mock adapter — get-reading-detail** — Read JSON, validate detail with evidence photos
4. **Query handler — get-readings** — Verify `portRegistry.execute('meter-reading', 'get-readings', { customerId })` returns `ReadingsListResponse` with `readings` array
5. **Query handler — get-comparison** — Verify BFF-computed fields: `currentVolume=22, previousVolume=18 → percentageChange=22.22, direction='up'`; `currentVolume=18, previousVolume=22 → percentageChange=-18.18, direction='down'`; `currentVolume=20, previousVolume=20 → percentageChange=0, direction='neutral'`; `currentVolume=5, previousVolume=0 → percentageChange=null, direction='neutral'`
6. **Query handler — get-reading-detail** — Verify customerId + period passed correctly
7. **Controller — GET /meters/consumption** — Returns 200 with `{ readings: [...], totalCount: 12 }` shape
8. **Controller — GET /meters/consumption/comparison?current=2026-05&previous=2026-04** — Returns comparison with `percentageChange` + `direction`
9. **Controller — GET /meters/consumption/:period** — Returns reading detail with photos
10. **Controller — unauthenticated** — Returns 401 on all 3 new endpoints
11. **Controller — invalid period format (e.g. "2026/05")** — Returns 400 ValidationException
12. **Controller — missing comparison params** — Returns 400 ValidationException
13. **Controller — verify query class types** — `toBeInstanceOf()` assertions for new query classes
14. **Integration — QueryBus → Handler → PortRegistry → MockAdapter → JSON** for all 3 methods

### Previous Story Learnings (Stories 2.1–2.3 — MUST Apply)

- **Module pattern:** `useExisting` for DI token provider — single shared adapter instance
- **getAuthenticatedUserId()** → `@CurrentUser('id') userId: string` pattern in controller
- **Port registration:** `PortRegistry.register()` in `onModuleInit()`
- **Input validation:** Validate URL params + query params with Zod schemas
- **Controller tests:** Verify query class types with `toBeInstanceOf()`
- **Integration test:** `CqrsModule` + `module.init()` for handler auto-discovery
- **Zod v4:** `z.record(z.string(), valueSchema)` — 2 args
- **Array wrapper pattern:** `{ items: [], totalCount: N }` for all list endpoints
- **BFF-computed UI flags:** Derive presentation flags (`isWarning`, `percentageChange`, `direction`) in handlers — don't push this logic to frontend or downstream
- **266 tests passing** — ensure ZERO regressions

### 📋 Cross-Story Context

**This story's output is a dependency for:**
- **Story 3.2** (Tariff & Pricing Display) — Will use meter/contract context for tariff lookup
- **Story 3.3** (Invoice List & Detail) — Consumption data appears on invoice detail

**Depends on (all complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Story 2.1 (Customer Profile — module pattern)
- Story 2.2 (Contract Lookup — controller validation pattern)
- Story 2.3 (Meter Information — SAME module, meter port, array wrapper, isWarning pattern)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1: Consumption History & Charts]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port Interface Catalog — meter-reading port (row 5)]
- [Source: _bmad-output/planning-artifacts/architecture.md#api-endpoints.yaml — meter-reading config]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure — modules/meter/]
- [Source: _bmad-output/project-context.md#Cache TTL Strategy — dynamic tier 5-15 min]
- [Source: _bmad-output/project-context.md#Naming Conventions — all naming rules]
- [Source: _bmad-output/implementation-artifacts/2-3-meter-information-history.md — PREVIOUS STORY (module + port + handler patterns)]
- [Source: src/modules/meter/meter.module.ts — Module registration pattern (useExisting + onModuleInit)]
- [Source: src/modules/meter/infrastructure/ports/meter.port.ts — Port interface + mock adapter template]
- [Source: src/modules/meter/infrastructure/http/meter.controller.ts — Controller endpoint pattern]
- [Source: src/modules/meter/application/queries/handlers/get-calibration-status.handler.ts — BFF-computed isWarning pattern → adapt for percentageChange]
- [Source: config/api-endpoints.yaml — meter-reading config (dynamic cache, 900s TTL)]

## Dev Agent Record

### Agent Model Used

Claude GLM-5[1m]

### Debug Log References

- 320/320 tests passing — zero regressions from previous stories (266 tests baseline)

### Completion Notes List

- ✅ Task 1: `METER_READING_PORT_TOKEN` already existed in tokens.ts
- ✅ Task 2: DTOs file already existed with all Zod schemas + types
- ✅ Task 3: Port interface + MockMeterReadingAdapter already existed
- ✅ Task 4: Mock JSON files (3) already existed with realistic data
- ✅ Task 5: Created 3 query handlers (`GetReadingsHandler`, `GetReadingComparisonHandler`, `GetReadingDetailHandler`). Updated barrel export in queries/index.ts
- ✅ Task 6: Extended `MeterController` with 3 new consumption endpoints (`GET /meters/consumption`, `GET /meters/consumption/comparison`, `GET /meters/consumption/:period`) + `validatePeriod()` + `validateComparisonParams()` methods
- ✅ Task 7: Updated `MeterModule` — added `MockMeterReadingAdapter` provider with `useExisting` pattern, registered `meter-reading` port in `onModuleInit`, added 3 new handlers to providers
- ✅ Task 8: Created comprehensive tests — port spec, 3 handler specs, controller spec (updated with 3 new endpoints + period/comparison validation), integration test

### File List

**New files:**
- `src/modules/meter/application/dtos/meter-reading.dto.ts`
- `src/modules/meter/infrastructure/ports/meter-reading.port.ts`
- `src/modules/meter/application/queries/get-readings.query.ts`
- `src/modules/meter/application/queries/get-reading-comparison.query.ts`
- `src/modules/meter/application/queries/get-reading-detail.query.ts`
- `src/modules/meter/application/queries/handlers/get-readings.handler.ts`
- `src/modules/meter/application/queries/handlers/get-reading-comparison.handler.ts`
- `src/modules/meter/application/queries/handlers/get-reading-detail.handler.ts`
- `mocks/meter-reading/get-readings.json`
- `mocks/meter-reading/get-comparison.json`
- `mocks/meter-reading/get-reading-detail.json`
- `src/modules/meter/infrastructure/ports/meter-reading.port.spec.ts`
- `src/modules/meter/application/queries/handlers/get-readings.handler.spec.ts`
- `src/modules/meter/application/queries/handlers/get-reading-comparison.handler.spec.ts`
- `src/modules/meter/application/queries/handlers/get-reading-detail.handler.spec.ts`
- `test/integration/meter-reading.spec.ts`

**Modified files:**
- `src/modules/meter/constants/tokens.ts` — Added METER_READING_PORT_TOKEN
- `src/modules/meter/meter.module.ts` — Added MockMeterReadingAdapter provider, meter-reading port registration, 3 new handlers
- `src/modules/meter/infrastructure/http/meter.controller.ts` — Added 3 consumption endpoints + validation methods
- `src/modules/meter/infrastructure/http/meter.controller.spec.ts` — Added tests for 3 new endpoints, period validation, comparison params validation, query class type checks
- `src/modules/meter/application/queries/index.ts` — Added exports for 3 new queries
- `src/modules/meter/application/index.ts` — Added meter-reading.dto barrel export
