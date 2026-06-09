# Story 2.1: Customer Profile 360°

Status: done

## Story

As a **customer (Anh Tuấn)**,
I want to view my complete profile with all interactions in one place,
so that I have full visibility into my water service relationship without calling the hotline.

## Acceptance Criteria

### AC1: Get Customer 360° Profile
**Given** an authenticated customer navigates to "My Profile"
**When** the BFF receives the request
**Then** it calls `ICustomerProfilePort.getProfile(customerId)` via PortRegistry
**And** returns the 360° profile: customer ID, identity info, usage classification (sinh hoạt/sản xuất/hành chính), full address, contact info
**And** the response uses the Port schema (normalized, not raw downstream format).

### AC2: Get Interaction Timeline
**Given** an authenticated customer views their profile
**When** they navigate to the "Interaction Timeline" tab
**Then** the BFF calls `ICustomerProfilePort.getTimeline(customerId, filters)` via PortRegistry
**And** returns a chronological timeline: contracts → meters → readings → invoices → payments → complaints → multi-channel interactions
**And** each timeline entry includes timestamp, event type, channel, and a brief summary.

### AC3: Update Contact Info with Cache Invalidation
**Given** an authenticated customer views their profile
**When** they tap "Edit Contact Info" and submit changes
**Then** the BFF sends `ICustomerProfilePort.updateProfile(customerId, data)` via PortRegistry with `useCache: false`
**And** upon success, the system **explicitly invalidates** the cached profile by calling `RedisCacheService.delete('cache:v2:port:customer-profile:{hash}')`
**And** immediately calls `ICustomerProfilePort.getProfile(customerId)` again (with `useCache: false`) to populate Redis with fresh data
**And** returns the updated profile to the frontend — customer sees the new info immediately, not after 12 hours.

### AC4: Get Related Accounts (KCN Relationship Tree)
**Given** a customer belonging to an Industrial Zone (KCN) relationship tree
**When** they navigate to "Related Accounts"
**Then** the BFF calls `ICustomerProfilePort.getRelatedAccounts(customerId)` via PortRegistry
**And** displays the relationship tree (KCN → member factories) and auxiliary contact persons.

### AC5: Circuit Breaker Fallback
**Given** the Customer Profile service is down
**When** the BFF attempts to fetch the profile
**Then** the Circuit Breaker (from Story 1.2) opens and returns cached profile data
**And** the customer sees their profile with a "last updated" timestamp.

## Tasks / Subtasks

- [x] Task 1: Create Customer Module Structure & DI Tokens (AC: all)
  - [x] Create `src/modules/customer/constants/tokens.ts` — `CUSTOMER_PROFILE_PORT_TOKEN`
  - [x] Create `src/modules/customer/domain/index.ts` — barrel export (no domain entities needed; BFF doesn't own customer data)
  - [x] Create `src/modules/customer/application/index.ts` — barrel export
  - [x] Create `src/modules/customer/application/dtos/customer-profile.dto.ts` — Zod schemas + TS types for profile, timeline, related accounts
  - [x] Create `src/modules/customer/application/dtos/update-profile.dto.ts` — Zod schema + TS type for profile update request

- [x] Task 2: Create Customer Profile Port Interface & Mock Adapter (AC: #1, #2, #4)
  - [x] Create `src/modules/customer/infrastructure/ports/customer-profile.port.ts`
  - [x] Define `ICustomerProfilePort` interface extending `IPortAdapter`
  - [x] Define Zod schemas: `ProfileResponseSchema`, `TimelineResponseSchema`, `RelatedAccountsResponseSchema`, `UpdateProfileResponseSchema`
  - [x] Create `MockCustomerProfileAdapter extends MockAdapterBase implements ICustomerProfilePort`

- [x] Task 3: Create Mock Data Files (AC: #1, #2, #4)
  - [x] Create `mocks/customer-profile/get-profile.json`
  - [x] Create `mocks/customer-profile/get-timeline.json`
  - [x] Create `mocks/customer-profile/get-related-accounts.json`
  - [x] Create `mocks/customer-profile/update-profile.json`

- [x] Task 4: Create CQRS Queries & Handlers (AC: #1, #2, #4)
  - [x] Create `src/modules/customer/application/queries/get-customer-profile.query.ts` + handler
  - [x] Create `src/modules/customer/application/queries/get-customer-timeline.query.ts` + handler
  - [x] Create `src/modules/customer/application/queries/get-related-accounts.query.ts` + handler
  - [x] Each handler: inject `PortRegistry`, call `portRegistry.execute<T>('customer-profile', method, params)`

- [x] Task 5: Create Update Profile Command & Handler (AC: #3)
  - [x] Create `src/modules/customer/application/commands/update-customer-profile.command.ts` + handler
  - [x] Handler: call `portRegistry.execute('customer-profile', 'update-profile', params)`
  - [x] On success: invalidate cache, re-fetch profile, return fresh data

- [x] Task 6: Create Customer Controller (AC: all)
  - [x] Create `src/modules/customer/infrastructure/http/customer.controller.ts`
  - [x] `GET /customers/profile` → dispatch `GetCustomerProfileQuery`
  - [x] `GET /customers/timeline` → dispatch `GetCustomerTimelineQuery`
  - [x] `GET /customers/related-accounts` → dispatch `GetRelatedAccountsQuery`
  - [x] `PUT /customers/profile` → dispatch `UpdateCustomerProfileCommand`
  - [x] Extract userId via `getAuthenticatedUserId()` pattern from AuthController

- [x] Task 7: Register Customer Module (AC: all)
  - [x] Create `src/modules/customer/customer.module.ts`
  - [x] Register MockCustomerProfileAdapter, port token, controllers, query/command handlers
  - [x] Register port with PortRegistry via `onModuleInit` lifecycle hook
  - [x] Import `CustomerModule` in `src/app.module.ts`

- [x] Task 8: Write comprehensive tests (AC: all)
  - [x] `customer-profile.port.spec.ts` — Mock adapter reads JSON + Zod validates for each method
  - [x] `get-customer-profile.handler.spec.ts` — Handler calls PortRegistry with correct params
  - [x] `get-customer-timeline.handler.spec.ts` — Handler passes filters to port
  - [x] `update-customer-profile.handler.spec.ts` — Handler invalidates cache, re-fetches, returns fresh data
  - [x] `customer.controller.spec.ts` — All 4 endpoints, auth guard, returns correct response shapes
  - [x] Integration: Controller → QueryBus → Handler → PortRegistry → MockAdapter → JSON

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This is the **first domain module after Auth** that uses the Port Registry to fetch data from downstream. Every future module (contract, meter, billing, payment, ticket) will copy this pattern. **Get it right.**

#### BFF Does NOT Own Customer Business Data

**Rule #1 from project-context.md:** CSKH module NEVER owns business logic. It coordinates, routes, and transforms only.

- Customer profile data (name, address, classification) lives in the **Backend API**
- BFF owns the Auth DB (users, sessions) — that's it
- This module is a **thin pass-through**: Controller → CQRS → Handler → PortRegistry → Adapter → Downstream
- The only "logic" is **cache invalidation** on profile update (AC3) — which is presentation state management, not business logic

#### What ALREADY EXISTS — DO NOT REINVENT

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **PortRegistry** | `src/libs/shared/port/port-registry.service.ts` | `register()` + `execute<T>()` — fully built in Story 1.1 |
| **MockAdapterBase** | `src/libs/shared/port/mock-adapter.base.ts` | Extend this — reads JSON files, validates with Zod |
| **InternalAdapterBase** | `src/libs/shared/port/internal-adapter.base.ts` | For future live adapter (not needed now) |
| **PortModule** | `src/libs/shared/port/port.module.ts` | @Global — provides PortRegistry everywhere |
| **NestQueryBus** | `src/libs/shared/cqrs/buses/nest-query-bus.ts` | Use `IQueryBus` with `QUERY_BUS_TOKEN` |
| **NestCommandBus** | `src/libs/shared/cqrs/buses/nest-command-bus.ts` | Use `ICommandBus` with `COMMAND_BUS_TOKEN` |
| **AuthController** | `src/modules/auth/infrastructure/http/auth.controller.ts` | Copy `getAuthenticatedUserId()` pattern — extracts userId from better-auth session |
| **DI Token Pattern** | `src/modules/auth/constants/tokens.ts` | `Symbol()` tokens following `{MODULE}_{TYPE}_TOKEN` |
| **Auth Module Pattern** | `src/modules/auth/auth.module.ts` | Reference for module registration, provider setup |
| **MockAuthAdapter** | `src/modules/auth/infrastructure/ports/auth.port.ts` | **COPY THIS PATTERN** — interface extends IPortAdapter, Zod schemas, MockAdapterBase subclass |
| **CACHE_SERVICE_TOKEN** | `src/libs/core/constants/tokens.ts` | Inject for explicit cache invalidation in AC3 |
| **Exception Classes** | `src/libs/core/common/exceptions/` | `NotFoundException`, `ForbiddenException`, `ValidationException`, `UnauthorizedException` |
| **StructuredLogger** | `src/libs/shared/observability/structured-logger.service.ts` | Structured logging with correlation ID |
| **AuthPropagationMiddleware** | `src/libs/shared/auth-propagation/` | JWT already injected on every downstream call — no manual JWT handling needed |

#### Cache Key Pattern — Use Exact Format

The PortRegistry builds cache keys as: `cache:v2:port:{portName}:{sha256Hash}`

For AC3 (cache invalidation), you need to know the hash to delete the right key. **Two approaches:**

**Approach A (Recommended):** Re-build the cache key using the same hash function:
```typescript
import { generateShortHash } from '@shared/utils/hash.util';

const cacheKey = `cache:v2:port:customer-profile:${generateShortHash(JSON.stringify({ method: 'get-profile', params: { customerId } }))}`;
await this.cacheService.delete(cacheKey);
```

**Approach B (Simpler):** Use Redis SCAN with pattern match:
```typescript
// Less efficient but doesn't require importing hash utility
await this.cacheService.deleteByPattern(`cache:v2:port:customer-profile:*`);
```

Choose Approach A for precision. If `RedisCacheService` doesn't have `deleteByPattern`, use A.

#### Port Registration Pattern — Use `onModuleInit`

Auth module registers its port as a NestJS provider but does NOT register it with PortRegistry. For Customer module, register the port with PortRegistry in the module's `onModuleInit` lifecycle hook:

```typescript
// In customer.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { PortRegistry } from '@shared/port';

@Module({ ... })
export class CustomerModule implements OnModuleInit {
  constructor(private readonly portRegistry: PortRegistry) {}

  onModuleInit() {
    this.portRegistry.register(
      'customer-profile',
      this.mockAdapter,
      this.mockAdapter, // live adapter = mock for now (no backend yet)
      { cacheTier: 'static', cacheTtl: 43200 }, // 12 hours
    );
  }
}
```

**IMPORTANT:** The PortRegistry reads config from `api-endpoints.yaml` if a matching entry exists. The `customer-profile` entry is already defined there (built in Story 1.1). So the `register()` call will merge with the YAML config — the explicit `cacheTier` override is just a safety net.

### 📁 File Structure — Complete Map

```
src/modules/customer/
├── domain/
│   └── index.ts                                  # Empty barrel — no domain entities
├── application/
│   ├── commands/
│   │   ├── update-customer-profile.command.ts     # Command class
│   │   ├── handlers/
│   │   │   └── update-customer-profile.handler.ts # Command handler — port call + cache invalidation
│   │   └── index.ts
│   ├── queries/
│   │   ├── get-customer-profile.query.ts          # Query class
│   │   ├── get-customer-timeline.query.ts         # Query class
│   │   ├── get-related-accounts.query.ts          # Query class
│   │   ├── handlers/
│   │   │   ├── get-customer-profile.handler.ts    # Query handler — PortRegistry.execute()
│   │   │   ├── get-customer-timeline.handler.ts   # Query handler
│   │   │   └── get-related-accounts.handler.ts    # Query handler
│   │   └── index.ts
│   ├── dtos/
│   │   ├── customer-profile.dto.ts                # Zod schemas + TS types
│   │   └── update-profile.dto.ts                  # Zod schema + TS type
│   └── index.ts
├── infrastructure/
│   ├── http/
│   │   └── customer.controller.ts                 # REST endpoints
│   └── ports/
│       ├── customer-profile.port.ts               # ICustomerProfilePort + MockCustomerProfileAdapter + Zod schemas
│       └── customer-profile.port.spec.ts          # Mock adapter tests
├── constants/
│   └── tokens.ts                                  # DI tokens
└── customer.module.ts                             # NestJS module + PortRegistry registration

mocks/customer-profile/
├── get-profile.json                               # Mock 360° profile response
├── get-timeline.json                              # Mock timeline response
├── get-related-accounts.json                      # Mock related accounts response
└── update-profile.json                            # Mock update profile response
```

**Modified Files:**
- `src/app.module.ts` — Add `CustomerModule` to imports (after `AuthModule`, before `PortModule`)

### 🔧 Implementation Details

#### Customer Profile Port Interface & Mock Adapter

```typescript
// src/modules/customer/infrastructure/ports/customer-profile.port.ts
import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { z } from 'zod';
import { IPortAdapter } from '@shared/port/port.interface';

/**
 * Customer Profile Port Interface
 * AC: #1 (getProfile), #2 (getTimeline), #3 (updateProfile), #4 (getRelatedAccounts)
 */
export interface ICustomerProfilePort extends IPortAdapter {
  // Methods: get-profile, get-timeline, update-profile, get-related-accounts
}

// ── Zod Schemas for Port Responses ──────────────────────────────

export const CustomerProfileSchema = z.object({
  customerId: z.string(),
  fullName: z.string(),
  classification: z.enum(['sinh_hoat', 'san_xuat', 'hanh_chinh']),
  address: z.object({
    street: z.string(),
    ward: z.string(),
    district: z.string(),
    city: z.string(),
    fullAddress: z.string(),
  }),
  contactInfo: z.object({
    phone: z.string().nullable(),
    email: z.string().nullable(),
    contactAddress: z.string().nullable(),
  }),
  status: z.enum(['active', 'inactive', 'suspended']),
});

export const TimelineEntrySchema = z.object({
  eventType: z.string(),
  timestamp: z.string(),
  summary: z.string(),
  channel: z.enum(['zalo', 'hotline', 'counter', 'web']).nullable(),
  referenceId: z.string().nullable(),
});

export const TimelineResponseSchema = z.object({
  entries: z.array(TimelineEntrySchema),
  totalCount: z.number(),
});

export const RelatedAccountSchema = z.object({
  customerId: z.string(),
  name: z.string(),
  relationshipType: z.string(), // e.g. 'parent_kcn', 'member_factory', 'auxiliary_contact'
  address: z.string().nullable(),
  contactInfo: z.record(z.string().nullable()),
});

export const RelatedAccountsResponseSchema = z.object({
  accounts: z.array(RelatedAccountSchema),
});

export const UpdateProfileResponseSchema = z.object({
  customerId: z.string(),
  updatedFields: z.array(z.string()),
  updatedAt: z.string(),
});

/**
 * Mock Customer Profile Adapter
 * Reads from mocks/customer-profile/{method}.json, validates with Zod.
 */
@Injectable()
export class MockCustomerProfileAdapter extends MockAdapterBase implements ICustomerProfilePort {
  constructor() {
    super(
      'customer-profile',
      {
        'get-profile': CustomerProfileSchema,
        'get-timeline': TimelineResponseSchema,
        'get-related-accounts': RelatedAccountsResponseSchema,
        'update-profile': UpdateProfileResponseSchema,
      },
      new Logger('customer-profile-mock-adapter'),
    );
  }
}
```

#### DI Tokens

```typescript
// src/modules/customer/constants/tokens.ts
export const CUSTOMER_PROFILE_PORT_TOKEN = Symbol('ICustomerProfilePort');
```

#### Query & Handler Example

```typescript
// src/modules/customer/application/queries/get-customer-profile.query.ts
import { IQuery } from '@core/application';

export class GetCustomerProfileQuery implements IQuery<CustomerProfileResult> {
  constructor(public readonly customerId: string) {}
}

// src/modules/customer/application/queries/handlers/get-customer-profile.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetCustomerProfileQuery } from '../get-customer-profile.query';

@QueryHandler(GetCustomerProfileQuery)
export class GetCustomerProfileHandler implements IQueryHandler<GetCustomerProfileQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetCustomerProfileQuery) {
    const result = await this.portRegistry.execute<CustomerProfileResponse>(
      'customer-profile',
      'get-profile',
      { customerId: query.customerId },
    );
    return result.data;
  }
}
```

#### Update Profile Handler (AC3 — Cache Invalidation)

```typescript
// src/modules/customer/application/commands/handlers/update-customer-profile.handler.ts
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { Inject } from '@nestjs/common';
import { CACHE_SERVICE_TOKEN } from '@core/constants/tokens';
import type { ICacheService } from '@shared/caching/cache.interface';
import { generateShortHash } from '@shared/utils/hash.util';
import { UpdateCustomerProfileCommand } from '../update-customer-profile.command';

@CommandHandler(UpdateCustomerProfileCommand)
export class UpdateCustomerProfileHandler implements ICommandHandler<UpdateCustomerProfileCommand> {
  constructor(
    private readonly portRegistry: PortRegistry,
    @Inject(CACHE_SERVICE_TOKEN)
    private readonly cacheService: ICacheService,
  ) {}

  async execute(command: UpdateCustomerProfileCommand) {
    // 1. Call downstream to update profile (no cache)
    const updateResult = await this.portRegistry.execute(
      'customer-profile',
      'update-profile',
      { customerId: command.customerId, data: command.data },
    );

    // 2. Explicitly invalidate cached profile
    const cacheKey = `cache:v2:port:customer-profile:${generateShortHash(
      JSON.stringify({ method: 'get-profile', params: { customerId: command.customerId } })
    )}`;
    await this.cacheService.delete(cacheKey);

    // 3. Re-fetch fresh profile (bypasses cache via execute which checks)
    const freshProfile = await this.portRegistry.execute<CustomerProfileResponse>(
      'customer-profile',
      'get-profile',
      { customerId: command.customerId },
    );

    return freshProfile.data;
  }
}
```

#### Customer Controller

```typescript
// src/modules/customer/infrastructure/http/customer.controller.ts
import { Controller, Get, Put, Body, Req, Inject, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { QUERY_BUS_TOKEN, COMMAND_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus, ICommandBus } from '@core/application';
import { GetCustomerProfileQuery } from '../../application/queries/get-customer-profile.query';
import { GetCustomerTimelineQuery } from '../../application/queries/get-customer-timeline.query';
import { GetRelatedAccountsQuery } from '../../application/queries/get-related-accounts.query';
import { UpdateCustomerProfileCommand } from '../../application/commands/update-customer-profile.command';
import { UpdateProfileSchema } from '../../application/dtos/update-profile.dto';
import { ValidationException, UnauthorizedException } from '@core/common';
import { BETTER_AUTH_INSTANCE_TOKEN } from '@modules/auth/constants/tokens';
import type { BetterAuthInstance } from '@modules/auth/infrastructure/better-auth/better-auth.setup';

@ApiTags('Customer')
@ApiBearerAuth('JWT-auth')
@Controller('customers')
export class CustomerController {
  private readonly logger = new Logger(CustomerController.name);

  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
    @Inject(BETTER_AUTH_INSTANCE_TOKEN) private readonly authInstance: BetterAuthInstance,
  ) {}

  // Copy getAuthenticatedUserId() from AuthController — same pattern

  @Get('profile')
  @ApiOperation({ summary: 'Get customer 360° profile' })
  async getProfile(@Req() request: FastifyRequest) {
    const userId = await this.getAuthenticatedUserId(request);
    return this.queryBus.execute(new GetCustomerProfileQuery(userId));
  }

  @Get('timeline')
  @ApiOperation({ summary: 'Get customer interaction timeline' })
  async getTimeline(@Req() request: FastifyRequest) {
    const userId = await this.getAuthenticatedUserId(request);
    return this.queryBus.execute(new GetCustomerTimelineQuery(userId));
  }

  @Get('related-accounts')
  @ApiOperation({ summary: 'Get related accounts (KCN relationship tree)' })
  async getRelatedAccounts(@Req() request: FastifyRequest) {
    const userId = await this.getAuthenticatedUserId(request);
    return this.queryBus.execute(new GetRelatedAccountsQuery(userId));
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update customer contact info' })
  async updateProfile(@Req() request: FastifyRequest, @Body() body: unknown) {
    const userId = await this.getAuthenticatedUserId(request);
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) throw new ValidationException(parsed.error.message);
    return this.commandBus.execute(new UpdateCustomerProfileCommand(userId, parsed.data));
  }

  private async getAuthenticatedUserId(request: FastifyRequest): Promise<string> {
    // EXACT same pattern as AuthController — copy it
    try {
      const api = (this.authInstance as Record<string, unknown>)?.api as Record<string, unknown> | undefined;
      const getSessionFn = api?.getSession as ((opts: { headers: Record<string, string | string[] | undefined> }) => Promise<unknown>) | undefined;
      const session = await getSessionFn?.({ headers: request.headers });
      if (!session || typeof session !== 'object') throw UnauthorizedException.missingToken();
      const sessionData = session as { user?: { id?: string } };
      if (!sessionData.user?.id) throw UnauthorizedException.missingToken();
      return sessionData.user.id;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw UnauthorizedException.invalidToken('Session verification failed');
    }
  }
}
```

**⚠️ `getAuthenticatedUserId()` duplication:** This is the third module needing this method. Consider extracting to a shared `AuthenticatedUserService` later (post-Epic 2), but **don't do it now** — keep scope tight. Copy the pattern as-is.

#### Customer Module Registration

```typescript
// src/modules/customer/customer.module.ts
import { Module, OnModuleInit, Inject } from '@nestjs/common';
import { CustomerController } from './infrastructure/http/customer.controller';
import { MockCustomerProfileAdapter } from './infrastructure/ports/customer-profile.port';
import { CUSTOMER_PROFILE_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetCustomerProfileHandler } from './application/queries/handlers/get-customer-profile.handler';
import { GetCustomerTimelineHandler } from './application/queries/handlers/get-customer-timeline.handler';
import { GetRelatedAccountsHandler } from './application/queries/handlers/get-related-accounts.handler';
import { UpdateCustomerProfileHandler } from './application/commands/handlers/update-customer-profile.handler';

@Module({
  controllers: [CustomerController],
  providers: [
    MockCustomerProfileAdapter,
    { provide: CUSTOMER_PROFILE_PORT_TOKEN, useClass: MockCustomerProfileAdapter },
    // CQRS Handlers
    GetCustomerProfileHandler,
    GetCustomerTimelineHandler,
    GetRelatedAccountsHandler,
    UpdateCustomerProfileHandler,
  ],
  exports: [CUSTOMER_PROFILE_PORT_TOKEN],
})
export class CustomerModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockCustomerProfileAdapter,
  ) {}

  onModuleInit() {
    // Register port with PortRegistry — config merged from api-endpoints.yaml
    this.portRegistry.register(
      'customer-profile',
      this.mockAdapter, // mock adapter
      this.mockAdapter, // live adapter (mock until Backend available)
    );
  }
}
```

#### AppModule Update

```typescript
// In src/app.module.ts — add CustomerModule after AuthModule, before AuthPropagationModule
import { CustomerModule } from 'src/modules/customer/customer.module';

@Module({
  imports: [
    // ... existing imports ...
    AuthModule,
    CustomerModule,     // ← ADD HERE
    AuthPropagationModule,
    PortModule,
  ],
})
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Create customer entities in BFF domain layer | BFF doesn't own customer data — no entities, no repositories. Only port calls. |
| Use `fetch()` to call Backend API | Always use `PortRegistry.execute('customer-profile', method, params)` |
| Hardcode cache key | Use `generateShortHash()` with same format as PortRegistry: `cache:v2:port:customer-profile:{hash}` |
| Skip cache invalidation on profile update | AC3: MUST invalidate + re-fetch. Customer must see new info immediately. |
| Define domain events for customer profile | BFF doesn't own this domain. No events needed — just port calls. |
| Create a repository interface for customer data | No BFF-owned persistence. Port interface replaces repository. |
| Use `any` type for port responses | Define Zod schemas + TypeScript types for all port responses |
| Forget `@QueryHandler` / `@CommandHandler` decorators | Required for NestJS CQRS auto-discovery |
| Register port in AppModule instead of CustomerModule | Each module owns its port registration via `onModuleInit` |
| Put cache invalidation in controller | Cache invalidation belongs in the command handler (CQRS) |
| Create `customer-profile` entry in api-endpoints.yaml | Already exists — built in Story 1.1. Don't duplicate. |

### 🧪 Testing Requirements

**Key test scenarios:**

1. **Mock adapter — get-profile** — Read `mocks/customer-profile/get-profile.json`, validate against Zod, return normalized data
2. **Mock adapter — get-timeline** — Read timeline JSON, validate entries array
3. **Mock adapter — get-related-accounts** — Read related accounts JSON, validate array
4. **Mock adapter — update-profile** — Read update response JSON, validate updated fields
5. **Query handler — get-profile** — Verify `portRegistry.execute('customer-profile', 'get-profile', { customerId })` is called
6. **Query handler — get-timeline** — Verify params including filters are passed through
7. **Query handler — get-related-accounts** — Verify correct port method called
8. **Command handler — update-profile** — Verify: (1) port update called, (2) cache invalidated, (3) fresh profile fetched, (4) fresh data returned
9. **Command handler — cache invalidation** — Verify cache key matches PortRegistry format
10. **Controller — GET /customers/profile** — Returns 200 with profile data shape
11. **Controller — GET /customers/timeline** — Returns 200 with timeline entries
12. **Controller — PUT /customers/profile** — Validates body, returns updated profile
13. **Controller — unauthenticated request** — Returns 401 Unauthorized
14. **Controller — invalid body on PUT** — Returns 400 ValidationException
15. **Module registration** — Verify port registered with PortRegistry on init

### Project Structure Notes

- New module: `src/modules/customer/` — follows DDD/CQRS module structure from architecture
- **No domain layer** — BFF doesn't own customer entities or repositories. `domain/index.ts` is an empty barrel.
- **Port replaces repository** — `ICustomerProfilePort` is the data access boundary, not a repository interface
- **Modified:** `src/app.module.ts` — Add `CustomerModule` to imports
- Cache tier: `static` (12h TTL) — per api-endpoints.yaml
- DI token: `CUSTOMER_PROFILE_PORT_TOKEN` in `src/modules/customer/constants/tokens.ts`
- Port name: `customer-profile` (matches api-endpoints.yaml key)

### Previous Story Learnings (Epic 1 — MUST Apply)

- **getAuthenticatedUserId() pattern:** Established in Story 1.3, refined in 1.4. Copy from `AuthController` — uses better-auth `api.getSession()` with request headers. **Do not reinvent.**
- **Port registration:** Use `PortRegistry.register()` in module's `onModuleInit()`. Config auto-merges from `api-endpoints.yaml`.
- **Mock adapter pattern:** Extends `MockAdapterBase`, pass port name + Zod schema map to `super()`. See `MockAuthAdapter` as the canonical example.
- **Module registration order in AppModule:** `AuthModule` → domain modules → `AuthPropagationModule` → `PortModule`. CustomerModule goes after AuthModule.
- **164 tests passing across 18 suites** — ensure ZERO regressions. Run full test suite before marking done.
- **bodyParser: false in main.ts** — Don't change this. Better-auth compatibility.
- **jose is ESM-only** — Not relevant to this story but good to know.

### 📋 Cross-Story Context

**This story's output is a dependency for:**
- **Story 2.2** (Contract Lookup) — Will follow same module pattern
- **Story 2.3** (Meter Information) — Will follow same module pattern
- **Story 3.1+** (Consumption & Billing) — Will reference customer context
- **Epic 6** (Notifications) — Will need customer contact info from profile
- **Epic 7** (Session) — Will record `invoice_viewed`, `profile_viewed` events

**Depends on (all complete ✅):**
- **Story 1.1** (Port Infrastructure) — PortRegistry, MockAdapterBase, InternalAdapterBase
- **Story 1.2** (Resilient Communication) — Circuit Breaker, cache tiers, idempotency
- **Story 1.3** (Auth) — better-auth session, getAuthenticatedUserId() pattern
- **Story 1.4** (Token Lifecycle) — JWT auto-injection on downstream calls

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Customer Profile 360°]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port Registry Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port Interface Base]
- [Source: _bmad-output/planning-artifacts/architecture.md#30 Port Interface Catalog — customer-profile port]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure — modules/customer/]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns — Pattern 1: Single Port Call]
- [Source: _bmad-output/planning-artifacts/architecture.md#Cache Strategy — static tier 12-24h]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules — Rules 1-3]
- [Source: _bmad-output/project-context.md#Module Internal Structure]
- [Source: _bmad-output/project-context.md#Cache TTL Strategy]
- [Source: _bmad-output/project-context.md#Adapter Contract — NormalizedRequest]
- [Source: _bmad-output/project-context.md#Key Files to Reference — Core Library, Shared CQRS]
- [Source: src/libs/shared/port/port-registry.service.ts — PortRegistry.register() + execute()]
- [Source: src/libs/shared/port/mock-adapter.base.ts — MockAdapterBase pattern]
- [Source: src/libs/shared/port/port.module.ts — @Global PortModule]
- [Source: src/modules/auth/infrastructure/ports/auth.port.ts — IAuthPort + MockAuthAdapter (canonical pattern)]
- [Source: src/modules/auth/auth.module.ts — Module registration pattern]
- [Source: src/modules/auth/infrastructure/http/auth.controller.ts — getAuthenticatedUserId() pattern]
- [Source: src/libs/core/constants/tokens.ts — QUERY_BUS_TOKEN, COMMAND_BUS_TOKEN, CACHE_SERVICE_TOKEN]
- [Source: src/libs/shared/cqrs/buses/nest-query-bus.ts — IQueryBus implementation]
- [Source: src/app.module.ts — Module import order]

## Dev Agent Record

### Agent Model Used

Dev Agent (Amelia) — Claude Code

### Debug Log References

- Fixed import paths: query/command files used `../../dtos/` instead of `../dtos/` (1 level up from queries/commands/ to application/)
- Fixed Zod v4 compat: `z.record()` requires 2 args in Zod v4 — changed to `z.record(z.string(), z.string().nullable())`
- Fixed controller tests: `UpdateProfileSchema` allows empty body (all fields optional) — adjusted tests to use actually invalid data (empty strings, bad email)

### Completion Notes List

- ✅ Task 1: Module structure created — DI tokens, empty domain barrel, DTOs with Zod schemas
- ✅ Task 2: Port interface + Mock adapter following `MockAuthAdapter` canonical pattern
- ✅ Task 3: Mock JSON files — realistic Vietnamese water utility data (contracts, invoices, KCN tree)
- ✅ Task 4: CQRS queries + handlers — thin pass-through to PortRegistry.execute()
- ✅ Task 5: Update command handler with AC3 cache invalidation (Approach A: precise cache key via generateShortHash)
- ✅ Task 6: Controller with 4 endpoints + getAuthenticatedUserId() copied from AuthController
- ✅ Task 7: CustomerModule with onModuleInit PortRegistry registration, imported in AppModule after AuthModule
- ✅ Task 8: 34 new tests across 6 test files — 190 total tests passing, 0 regressions
- ✅ Code Review fixes applied:
  - H1: Created integration test (test/integration/customer-profile.spec.ts) — 5 tests covering full CQRS chain
  - M1: UpdateProfileSchema now requires at least one field via .refine()
  - M2: Controller tests now verify correct query/command class types passed to buses
  - M3: Module uses `useExisting` instead of `useClass` to share single adapter instance
- Final: 23 suites, 195 tests, 0 failures

### File List

**New Files:**
- `src/modules/customer/constants/tokens.ts`
- `src/modules/customer/domain/index.ts`
- `src/modules/customer/application/index.ts`
- `src/modules/customer/application/dtos/customer-profile.dto.ts`
- `src/modules/customer/application/dtos/update-profile.dto.ts`
- `src/modules/customer/application/queries/get-customer-profile.query.ts`
- `src/modules/customer/application/queries/get-customer-timeline.query.ts`
- `src/modules/customer/application/queries/get-related-accounts.query.ts`
- `src/modules/customer/application/queries/index.ts`
- `src/modules/customer/application/queries/handlers/get-customer-profile.handler.ts`
- `src/modules/customer/application/queries/handlers/get-customer-timeline.handler.ts`
- `src/modules/customer/application/queries/handlers/get-related-accounts.handler.ts`
- `src/modules/customer/application/commands/update-customer-profile.command.ts`
- `src/modules/customer/application/commands/index.ts`
- `src/modules/customer/application/commands/handlers/update-customer-profile.handler.ts`
- `src/modules/customer/infrastructure/ports/customer-profile.port.ts`
- `src/modules/customer/infrastructure/http/customer.controller.ts`
- `src/modules/customer/customer.module.ts`
- `mocks/customer-profile/get-profile.json`
- `mocks/customer-profile/get-timeline.json`
- `mocks/customer-profile/get-related-accounts.json`
- `mocks/customer-profile/update-profile.json`

**Test Files:**
- `src/modules/customer/infrastructure/ports/customer-profile.port.spec.ts`
- `src/modules/customer/application/queries/handlers/get-customer-profile.handler.spec.ts`
- `src/modules/customer/application/queries/handlers/get-customer-timeline.handler.spec.ts`
- `src/modules/customer/application/queries/handlers/get-related-accounts.handler.spec.ts`
- `src/modules/customer/application/commands/handlers/update-customer-profile.handler.spec.ts`
- `src/modules/customer/infrastructure/http/customer.controller.spec.ts`
- `test/integration/customer-profile.spec.ts` — Integration: QueryBus → Handler → PortRegistry → MockAdapter → JSON

**Modified Files:**
- `src/app.module.ts` — Added CustomerModule import after AuthModule
