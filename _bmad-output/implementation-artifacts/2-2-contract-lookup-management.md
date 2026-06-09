# Story 2.2: Contract Lookup & Management

Status: done

## Story

As a **customer (Cô Nguyễn)**,
I want to view my water service contract details including terms and history,
so that I understand what I signed up for without digging through paper documents.

## Acceptance Criteria

### AC1: Get Customer Contracts
**Given** an authenticated customer navigates to "My Contracts"
**When** the BFF receives the request
**Then** it calls `IContractPort.getContracts(customerId)` via PortRegistry
**And** returns a list of contracts with: address, meter ID, water quota, subscription type, pricing terms, status (active/expired/terminated).

### AC2: Get Contract Detail
**Given** an authenticated customer selects a specific contract
**When** they tap "View Details"
**Then** the BFF calls `IContractPort.getContractDetail(contractId)` via PortRegistry
**And** returns the full contract: all fields above plus detailed pricing terms and special conditions.

### AC3: Get Contract Version History
**Given** an authenticated customer views a contract
**When** they tap "Version History"
**Then** the BFF calls `IContractPort.getContractVersions(contractId)` via PortRegistry
**And** returns a chronological list of contract versions with change descriptions.

### AC4: Download Contract PDF
**Given** an authenticated customer views a contract
**When** they tap "Download PDF"
**Then** the BFF calls `IContractPort.getContractPDF(contractId)` via PortRegistry
**And** returns a downloadable PDF (binary stream or presigned URL).

### AC5: Static Cache Tier
**Given** contract data is fetched successfully
**When** the response is cached
**Then** the cache key follows `cache:v2:port:contract:{hash}` with TTL 12-24h (static tier, per Story 1.2).

## Tasks / Subtasks

- [x] Task 1: Create Contract Module Structure & DI Tokens (AC: all)
  - [x] Create `src/modules/contract/constants/tokens.ts` — `CONTRACT_PORT_TOKEN`
  - [x] Create `src/modules/contract/domain/index.ts` — barrel export (no domain entities needed; BFF doesn't own contract data)
  - [x] Create `src/modules/contract/application/index.ts` — barrel export
  - [x] Create `src/modules/contract/application/dtos/contract.dto.ts` — Zod schemas + TS types for contract list, detail, version, PDF
  - [x] Create `src/modules/contract/application/dtos/contract-query.dto.ts` — Zod schema + TS type for contract query params (filters)

- [x] Task 2: Create Contract Port Interface & Mock Adapter (AC: #1, #2, #3, #4)
  - [x] Create `src/modules/contract/infrastructure/ports/contract.port.ts`
  - [x] Define `IContractPort` interface extending `IPortAdapter`
  - [x] Define Zod schemas: `ContractListResponseSchema`, `ContractDetailResponseSchema`, `ContractVersionsResponseSchema`, `ContractPDFResponseSchema`
  - [x] Create `MockContractAdapter extends MockAdapterBase implements IContractPort`

- [x] Task 3: Create Mock Data Files (AC: #1, #2, #3, #4)
  - [x] Create `mocks/contract/get-contracts.json`
  - [x] Create `mocks/contract/get-contract-detail.json`
  - [x] Create `mocks/contract/get-contract-versions.json`
  - [x] Create `mocks/contract/get-contract-pdf.json`

- [x] Task 4: Create CQRS Queries & Handlers (AC: #1, #2, #3, #4)
  - [x] Create `src/modules/contract/application/queries/get-contracts.query.ts` + handler
  - [x] Create `src/modules/contract/application/queries/get-contract-detail.query.ts` + handler
  - [x] Create `src/modules/contract/application/queries/get-contract-versions.query.ts` + handler
  - [x] Create `src/modules/contract/application/queries/get-contract-pdf.query.ts` + handler
  - [x] Each handler: inject `PortRegistry`, call `portRegistry.execute<T>('contract', method, params)`

- [x] Task 5: Create Contract Controller (AC: all)
  - [x] Create `src/modules/contract/infrastructure/http/contract.controller.ts`
  - [x] `GET /contracts` → dispatch `GetContractsQuery`
  - [x] `GET /contracts/:contractId` → dispatch `GetContractDetailQuery`
  - [x] `GET /contracts/:contractId/versions` → dispatch `GetContractVersionsQuery`
  - [x] `GET /contracts/:contractId/pdf` → dispatch `GetContractPDFQuery`
  - [x] Extract userId via `getAuthenticatedUserId()` pattern from AuthController

- [x] Task 6: Register Contract Module (AC: all)
  - [x] Create `src/modules/contract/contract.module.ts`
  - [x] Register MockContractAdapter, port token (use `useExisting`), controllers, query handlers
  - [x] Register port with PortRegistry via `onModuleInit` lifecycle hook
  - [x] Import `ContractModule` in `src/app.module.ts`

- [x] Task 7: Write comprehensive tests (AC: all)
  - [x] `contract.port.spec.ts` — Mock adapter reads JSON + Zod validates for each method
  - [x] `get-contracts.handler.spec.ts` — Handler calls PortRegistry with correct params
  - [x] `get-contract-detail.handler.spec.ts` — Handler passes contractId to port
  - [x] `get-contract-versions.handler.spec.ts` — Handler passes contractId to port
  - [x] `get-contract-pdf.handler.spec.ts` — Handler passes contractId to port
  - [x] `contract.controller.spec.ts` — All 4 endpoints, auth guard, returns correct response shapes, verifies query class types
  - [x] Integration: `test/integration/contract.spec.ts` — QueryBus → Handler → PortRegistry → MockAdapter → JSON

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This is the **second domain module** using the Port Registry pattern. The **Customer module (Story 2.1)** established the canonical pattern. **Follow it exactly.**

#### BFF Does NOT Own Contract Business Data

**Rule #1 from project-context.md:** CSKH module NEVER owns business logic. It coordinates, routes, and transforms only.

- Contract data (terms, pricing, versions, PDFs) lives in the **Backend API**
- This module is a **thin pass-through**: Controller → CQRS → Handler → PortRegistry → Adapter → Downstream
- No domain entities, no repositories, no business logic
- The only "logic" is routing the correct port method based on the endpoint

#### What ALREADY EXISTS — DO NOT REINVENT

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **PortRegistry** | `src/libs/shared/port/port-registry.service.ts` | `register()` + `execute<T>()` — fully built in Story 1.1 |
| **MockAdapterBase** | `src/libs/shared/port/mock-adapter.base.ts` | Extend this — reads JSON files, validates with Zod |
| **PortModule** | `src/libs/shared/port/port.module.ts` | @Global — provides PortRegistry everywhere |
| **NestQueryBus** | `src/libs/shared/cqrs/buses/nest-query-bus.ts` | Use `IQueryBus` with `QUERY_BUS_TOKEN` |
| **AuthController** | `src/modules/auth/infrastructure/http/auth.controller.ts` | Copy `getAuthenticatedUserId()` pattern |
| **DI Token Pattern** | `src/modules/auth/constants/tokens.ts` | `Symbol()` tokens following `{MODULE}_{TYPE}_TOKEN` |
| **MockAuthAdapter** | `src/modules/auth/infrastructure/ports/auth.port.ts` | **COPY THIS PATTERN** |
| **MockCustomerProfileAdapter** | `src/modules/customer/infrastructure/ports/customer-profile.port.ts` | **EXACT TEMPLATE** — copy and adapt for contract |
| **CustomerModule** | `src/modules/customer/customer.module.ts` | **EXACT TEMPLATE** — use `useExisting` pattern |
| **Exception Classes** | `src/libs/core/common/exceptions/` | `NotFoundException`, `ForbiddenException`, `ValidationException`, `UnauthorizedException` |
| **StructuredLogger** | `src/libs/shared/observability/structured-logger.service.ts` | Structured logging with correlation ID |
| **AuthPropagationMiddleware** | `src/libs/shared/auth-propagation/` | JWT already injected on every downstream call |

#### Contract Port — Defined in api-endpoints.yaml (Story 1.1)

```yaml
# Already in api-endpoints.yaml — DO NOT DUPLICATE
contract:
  adapter: mock
  baseUrl: ${CONTRACT_SERVICE_URL:http://localhost:3012}
  timeout: 3000
  cacheTier: static
  circuitBreaker:
    errorThreshold: 50
    resetTimeout: 10000
    minRequests: 5
```

The `register()` call in `onModuleInit` will merge with this YAML config automatically.

#### Port Interface Catalog Entry

| # | Port Name | Interface | Methods | Cache Tier |
|---|-----------|-----------|---------|-----------|
| 3 | `contract` | `IContractPort` | getContracts, getContractDetail, getContractVersions, getContractPDF, signContract, checkRenewalAlerts | static |

**MVP methods for this story:** `get-contracts`, `get-contract-detail`, `get-contract-versions`, `get-contract-pdf`
**Phase 2 methods (skip now):** `signContract`, `checkRenewalAlerts`

### 📁 File Structure — Complete Map

```
src/modules/contract/
├── domain/
│   └── index.ts                                  # Empty barrel — no domain entities
├── application/
│   ├── queries/
│   │   ├── get-contracts.query.ts                # Query class
│   │   ├── get-contract-detail.query.ts          # Query class
│   │   ├── get-contract-versions.query.ts        # Query class
│   │   ├── get-contract-pdf.query.ts             # Query class
│   │   ├── handlers/
│   │   │   ├── get-contracts.handler.ts          # Query handler
│   │   │   ├── get-contract-detail.handler.ts    # Query handler
│   │   │   ├── get-contract-versions.handler.ts  # Query handler
│   │   │   └── get-contract-pdf.handler.ts       # Query handler
│   │   └── index.ts
│   ├── dtos/
│   │   ├── contract.dto.ts                       # Zod schemas + TS types
│   │   └── contract-query.dto.ts                 # Query filter schemas
│   └── index.ts
├── infrastructure/
│   ├── http/
│   │   └── contract.controller.ts                # REST endpoints
│   └── ports/
│       ├── contract.port.ts                      # IContractPort + MockContractAdapter + Zod schemas
│       └── contract.port.spec.ts                 # Mock adapter tests
├── constants/
│   └── tokens.ts                                 # DI tokens
└── contract.module.ts                            # NestJS module + PortRegistry registration

mocks/contract/
├── get-contracts.json                            # Mock contract list response
├── get-contract-detail.json                      # Mock contract detail response
├── get-contract-versions.json                    # Mock version history response
└── get-contract-pdf.json                         # Mock PDF response (presigned URL)

test/integration/
└── contract.spec.ts                              # Integration: QueryBus → Handler → PortRegistry → MockAdapter → JSON
```

**Modified Files:**
- `src/app.module.ts` — Add `ContractModule` to imports (after `CustomerModule`)

### 🔧 Implementation Details

#### Contract Port Interface & Mock Adapter

```typescript
// src/modules/contract/infrastructure/ports/contract.port.ts
import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  ContractListResponseSchema,
  ContractDetailResponseSchema,
  ContractVersionsResponseSchema,
  ContractPDFResponseSchema,
} from '../../application/dtos/contract.dto';

export interface IContractPort extends IPortAdapter {
  // Methods: get-contracts, get-contract-detail, get-contract-versions, get-contract-pdf
}

@Injectable()
export class MockContractAdapter extends MockAdapterBase implements IContractPort {
  constructor() {
    super(
      'contract',
      {
        'get-contracts': ContractListResponseSchema,
        'get-contract-detail': ContractDetailResponseSchema,
        'get-contract-versions': ContractVersionsResponseSchema,
        'get-contract-pdf': ContractPDFResponseSchema,
      },
      new Logger('contract-mock-adapter'),
    );
  }
}
```

#### DI Tokens

```typescript
// src/modules/contract/constants/tokens.ts
export const CONTRACT_PORT_TOKEN = Symbol('IContractPort');
```

#### Contract DTOs

```typescript
// src/modules/contract/application/dtos/contract.dto.ts
import { z } from 'zod';

// Contract list item (AC#1)
export const ContractListItemSchema = z.object({
  contractId: z.string(),
  address: z.string(),
  meterId: z.string().nullable(),
  waterQuota: z.number().nullable(),
  subscriptionType: z.enum(['residential', 'commercial', 'industrial', 'administrative']),
  status: z.enum(['active', 'expired', 'terminated']),
  startDate: z.string(),
  endDate: z.string().nullable(),
});

export const ContractListResponseSchema = z.object({
  contracts: z.array(ContractListItemSchema),
  totalCount: z.number(),
});

// Contract detail (AC#2)
export const ContractDetailResponseSchema = z.object({
  contractId: z.string(),
  address: z.string(),
  meterId: z.string().nullable(),
  waterQuota: z.number().nullable(),
  subscriptionType: z.enum(['residential', 'commercial', 'industrial', 'administrative']),
  status: z.enum(['active', 'expired', 'terminated']),
  startDate: z.string(),
  endDate: z.string().nullable(),
  pricingTerms: z.object({
    basePrice: z.number(),
    currency: z.string(),
    billingCycle: z.string(),
  }),
  specialConditions: z.array(z.string()).nullable(),
});

// Contract version (AC#3)
export const ContractVersionSchema = z.object({
  versionId: z.string(),
  versionNumber: z.number(),
  changeDescription: z.string(),
  effectiveDate: z.string(),
  changedBy: z.string(),
});

export const ContractVersionsResponseSchema = z.object({
  versions: z.array(ContractVersionSchema),
  totalCount: z.number(),
});

// Contract PDF (AC#4)
export const ContractPDFResponseSchema = z.object({
  contractId: z.string(),
  downloadUrl: z.string(),
  fileName: z.string(),
  expiresAt: z.string().nullable(),
});

// Export TS types
export type ContractListItem = z.infer<typeof ContractListItemSchema>;
export type ContractListResponse = z.infer<typeof ContractListResponseSchema>;
export type ContractDetailResponse = z.infer<typeof ContractDetailResponseSchema>;
export type ContractVersion = z.infer<typeof ContractVersionSchema>;
export type ContractVersionsResponse = z.infer<typeof ContractVersionsResponseSchema>;
export type ContractPDFResponse = z.infer<typeof ContractPDFResponseSchema>;
```

#### Contract Module Registration

```typescript
// src/modules/contract/contract.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { ContractController } from './infrastructure/http/contract.controller';
import { MockContractAdapter } from './infrastructure/ports/contract.port';
import { CONTRACT_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
// Import all query handlers...

@Module({
  controllers: [ContractController],
  providers: [
    MockContractAdapter,
    {
      provide: CONTRACT_PORT_TOKEN,
      useExisting: MockContractAdapter, // ← Single shared instance (code review fix from Story 2.1)
    },
    // CQRS Query Handlers
  ],
  exports: [CONTRACT_PORT_TOKEN],
})
export class ContractModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockContractAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register(
      'contract',
      this.mockAdapter,
      this.mockAdapter, // live adapter = mock until Backend available
    );
  }
}
```

#### Contract Controller

```typescript
// src/modules/contract/infrastructure/http/contract.controller.ts
@ApiTags('Contract')
@ApiBearerAuth('JWT-auth')
@Controller('contracts')
export class ContractController {
  // Copy getAuthenticatedUserId() from AuthController — same pattern

  @Get()                          // GET /contracts → GetContractsQuery
  @Get(':contractId')             // GET /contracts/:contractId → GetContractDetailQuery
  @Get(':contractId/versions')    // GET /contracts/:contractId/versions → GetContractVersionsQuery
  @Get(':contractId/pdf')         // GET /contracts/:contractId/pdf → GetContractPDFQuery
}
```

#### AppModule Update

```typescript
// In src/app.module.ts — add ContractModule after CustomerModule
import { ContractModule } from 'src/modules/contract/contract.module';

@Module({
  imports: [
    // ... existing imports ...
    AuthModule,
    CustomerModule,
    ContractModule,       // ← ADD HERE
    AuthPropagationModule,
    PortModule,
  ],
})
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Create contract entities in BFF domain layer | BFF doesn't own contract data — no entities, no repositories. Only port calls. |
| Use `fetch()` to call Backend API | Always use `PortRegistry.execute('contract', method, params)` |
| Use `useClass` for port token provider | Use `useExisting: MockContractAdapter` — single shared instance (learned from Story 2.1 code review) |
| Forget `@QueryHandler` decorators | Required for NestJS CQRS auto-discovery |
| Register port in AppModule instead of ContractModule | Each module owns its port registration via `onModuleInit` |
| Create `contract` entry in api-endpoints.yaml | Already exists — built in Story 1.1. Don't duplicate. |
| Use `any` type for port responses | Define Zod schemas + TypeScript types for all port responses |
| Use `z.record(valueSchema)` with 1 arg | Zod v4 requires `z.record(z.string(), valueSchema)` — 2 args (learned from Story 2.1) |
| Skip integration test | Create `test/integration/contract.spec.ts` with `CqrsModule` + `module.init()` (learned from Story 2.1 code review) |
| Forget to verify query class types in controller tests | Assert `toBeInstanceOf(GetContractsQuery)` etc. (learned from Story 2.1 code review) |

### 🧪 Testing Requirements

**Key test scenarios:**

1. **Mock adapter — get-contracts** — Read JSON, validate Zod, return contract list
2. **Mock adapter — get-contract-detail** — Read JSON, validate full detail schema
3. **Mock adapter — get-contract-versions** — Read JSON, validate version array
4. **Mock adapter — get-contract-pdf** — Read JSON, validate presigned URL response
5. **Query handler — get-contracts** — Verify `portRegistry.execute('contract', 'get-contracts', { customerId })` called
6. **Query handler — get-contract-detail** — Verify contractId passed correctly
7. **Query handler — get-contract-versions** — Verify contractId passed correctly
8. **Query handler — get-contract-pdf** — Verify contractId passed correctly
9. **Controller — GET /contracts** — Returns 200 with contract list shape
10. **Controller — GET /contracts/:id** — Returns 200 with contract detail
11. **Controller — GET /contracts/:id/versions** — Returns 200 with version array
12. **Controller — GET /contracts/:id/pdf** — Returns 200 with download URL
13. **Controller — unauthenticated request** — Returns 401 Unauthorized
14. **Controller — verify query class types** — Assert correct Query class passed to bus
15. **Integration — QueryBus → Handler → PortRegistry → MockAdapter → JSON** — Full chain with real CqrsModule

### Project Structure Notes

- New module: `src/modules/contract/` — follows DDD/CQRS module structure
- **No domain layer** — BFF doesn't own contract entities or repositories. `domain/index.ts` is an empty barrel.
- **Port replaces repository** — `IContractPort` is the data access boundary
- **Modified:** `src/app.module.ts` — Add `ContractModule` to imports
- Cache tier: `static` (12h TTL) — per api-endpoints.yaml
- DI token: `CONTRACT_PORT_TOKEN` in `src/modules/contract/constants/tokens.ts`
- Port name: `contract` (matches api-endpoints.yaml key)

### Previous Story Learnings (Story 2.1 — MUST Apply)

- **Module pattern:** `useExisting` for DI token provider (not `useClass`) — single shared adapter instance
- **getAuthenticatedUserId() pattern:** Copy from AuthController — uses better-auth `api.getSession()` with request headers
- **Port registration:** Use `PortRegistry.register()` in module's `onModuleInit()`. Config auto-merges from `api-endpoints.yaml`.
- **Mock adapter pattern:** Extends `MockAdapterBase`, pass port name + Zod schema map to `super()`. See `MockCustomerProfileAdapter` as the canonical example.
- **Module registration order in AppModule:** `AuthModule` → `CustomerModule` → `ContractModule` → `AuthPropagationModule` → `PortModule`.
- **195 tests passing across 23 suites** — ensure ZERO regressions. Run full test suite before marking done.
- **Zod v4 compat:** `z.record()` requires 2 args — `z.record(z.string(), valueSchema)`
- **Integration test pattern:** Use `CqrsModule` + `module.init()` for handler auto-discovery (learned from code review)
- **Controller test quality:** Verify query class types with `toBeInstanceOf()` (learned from code review)
- **UpdateProfileSchema pattern:** Use `.refine()` for cross-field validation when needed

### 📋 Cross-Story Context

**This story's output is a dependency for:**
- **Story 2.3** (Meter Information) — Will follow same module pattern
- **Story 3.1+** (Consumption & Billing) — Will reference contract context for tariff lookups
- **Story 4.1+** (Payments) — Will need contract info for payment context
- **Epic 6** (Notifications) — May need contract renewal alerts

**Depends on (all complete ✅):**
- **Story 1.1** (Port Infrastructure) — PortRegistry, MockAdapterBase
- **Story 1.2** (Resilient Communication) — Circuit Breaker, cache tiers
- **Story 1.3** (Auth) — better-auth session, getAuthenticatedUserId() pattern
- **Story 1.4** (Token Lifecycle) — JWT auto-injection on downstream calls
- **Story 2.1** (Customer Profile 360°) — Module pattern, DI token pattern, controller pattern

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2: Contract Lookup & Management]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port Interface Catalog — contract port (row 3)]
- [Source: _bmad-output/planning-artifacts/architecture.md#api-endpoints.yaml — contract config]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure — modules/contract/]
- [Source: _bmad-output/planning-artifacts/architecture.md#Cache Strategy — static tier 12-24h]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules — Rules 1-3]
- [Source: _bmad-output/project-context.md#Module Internal Structure]
- [Source: _bmad-output/project-context.md#Cache TTL Strategy]
- [Source: src/libs/shared/port/port-registry.service.ts — PortRegistry.register() + execute()]
- [Source: src/libs/shared/port/mock-adapter.base.ts — MockAdapterBase pattern]
- [Source: src/modules/customer/infrastructure/ports/customer-profile.port.ts — ICustomerProfilePort + MockCustomerProfileAdapter (CANONICAL TEMPLATE)]
- [Source: src/modules/customer/customer.module.ts — CustomerModule with useExisting pattern]
- [Source: src/modules/customer/infrastructure/http/customer.controller.ts — Controller pattern]
- [Source: src/app.module.ts — Module import order]

## Dev Agent Record

### Agent Model Used

Dev Agent (Amelia) — Claude Code

### Debug Log References

### Completion Notes List

- ✅ Task 1: Module structure — DI tokens, empty domain barrel, DTOs with Zod schemas (4 response schemas + query filter DTO)
- ✅ Task 2: Port interface + Mock adapter following Story 2.1 canonical pattern
- ✅ Task 3: Mock JSON files — realistic Vietnamese water utility contract data (list, detail with pricing, version history, presigned PDF URL)
- ✅ Task 4: CQRS queries + handlers — 4 query classes + 4 handlers, thin pass-through to PortRegistry.execute()
- ✅ Task 5: Controller with 4 endpoints + getAuthenticatedUserId() + query class type verification in tests
- ✅ Task 6: ContractModule with onModuleInit PortRegistry registration, `useExisting` pattern, imported in AppModule
- ✅ Task 7: 25 new tests across 7 test files (port spec, 4 handler specs, controller spec, integration spec) — 220 total tests passing, 0 regressions

### File List

**New Files:**
- `src/modules/contract/constants/tokens.ts`
- `src/modules/contract/domain/index.ts`
- `src/modules/contract/application/index.ts`
- `src/modules/contract/application/dtos/contract.dto.ts`
- `src/modules/contract/application/dtos/contract-query.dto.ts`
- `src/modules/contract/application/queries/get-contracts.query.ts`
- `src/modules/contract/application/queries/get-contract-detail.query.ts`
- `src/modules/contract/application/queries/get-contract-versions.query.ts`
- `src/modules/contract/application/queries/get-contract-pdf.query.ts`
- `src/modules/contract/application/queries/index.ts`
- `src/modules/contract/application/queries/handlers/get-contracts.handler.ts`
- `src/modules/contract/application/queries/handlers/get-contract-detail.handler.ts`
- `src/modules/contract/application/queries/handlers/get-contract-versions.handler.ts`
- `src/modules/contract/application/queries/handlers/get-contract-pdf.handler.ts`
- `src/modules/contract/infrastructure/ports/contract.port.ts`
- `src/modules/contract/infrastructure/http/contract.controller.ts`
- `src/modules/contract/contract.module.ts`
- `mocks/contract/get-contracts.json`
- `mocks/contract/get-contract-detail.json`
- `mocks/contract/get-contract-versions.json`
- `mocks/contract/get-contract-pdf.json`

**Test Files:**
- `src/modules/contract/infrastructure/ports/contract.port.spec.ts`
- `src/modules/contract/application/queries/handlers/get-contracts.handler.spec.ts`
- `src/modules/contract/application/queries/handlers/get-contract-detail.handler.spec.ts`
- `src/modules/contract/application/queries/handlers/get-contract-versions.handler.spec.ts`
- `src/modules/contract/application/queries/handlers/get-contract-pdf.handler.spec.ts`
- `src/modules/contract/infrastructure/http/contract.controller.spec.ts`
- `test/integration/contract.spec.ts`

**Modified Files:**
- `src/app.module.ts` — Added ContractModule import after CustomerModule
