# Story R.1: Refactor — SessionAuthGuard + @CurrentUser() Decorator

Status: done

## Story

As a **developer maintaining the CSKH BFF**,
I want a reusable `SessionAuthGuard` and `@CurrentUser()` decorator to eliminate duplicated `getAuthenticatedUserId()` across controllers,
so that every new module gets authentication for free without copy-pasting 20 lines of better-auth session extraction.

## Motivation

`getAuthenticatedUserId()` is **identically duplicated** across 4 controllers (13 call sites):

| Controller | Lines | Call Sites |
|-----------|-------|------------|
| `AuthController` | auth.controller.ts:77-99 | 2 |
| `CustomerController` | customer.controller.ts:89-110 | 4 |
| `ContractController` | contract.controller.ts:107-128 | 4 |
| `MeterController` | meter.controller.ts:89-110 | 3 |

Every new module (Consumption, Payment, Ticket, Notification) will copy this pattern again. **Stop the bleeding now.**

## Acceptance Criteria

### AC1: SessionAuthGuard Implementation
**Given** a request arrives at any authenticated endpoint
**When** the `SessionAuthGuard` executes
**Then** it extracts the session via `better-auth api.getSession(request.headers)`
**And** attaches `{ userId, sessionId }` to `request.user`
**And** throws `UnauthorizedException` if no valid session found
**And** handles all edge cases (null session, missing user.id, getSession throws).

### AC2: @CurrentUser() Param Decorator
**Given** a controller method parameter is decorated with `@CurrentUser()`
**When** the handler executes after SessionAuthGuard
**Then** `@CurrentUser()` returns the full user object `{ userId, sessionId }`
**And** `@CurrentUser('id')` returns just the `userId` string
**And** throws `UnauthorizedException` if `request.user` is undefined (guard was skipped).

### AC3: Refactor All Existing Controllers
**Given** all 4 existing controllers
**When** the refactoring is applied
**Then** each controller:
- Removes its private `getAuthenticatedUserId()` method entirely
- Removes `@Inject(BETTER_AUTH_INSTANCE_TOKEN)` injection (except AuthController which uses authInstance for other purposes)
- Removes `@Req() request: FastifyRequest` where only userId extraction was needed
- Adds `@UseGuards(SessionAuthGuard)` at class level
- Uses `@CurrentUser('id') userId: string` in method parameters
**And** all existing tests continue passing with ZERO regressions.

### AC4: AuthModule Exports Guard + Decorator
**Given** other modules need authentication
**When** they import `AuthModule` (already imported transitively)
**Then** `SessionAuthGuard` is available as a `@Global()` provider
**And** `@CurrentUser()` decorator works without any additional module registration.

### AC5: Updated Tests
**Given** all existing controller tests
**When** the refactoring is complete
**Then** each controller test:
- No longer mocks `BETTER_AUTH_INSTANCE_TOKEN`
- Instead creates a mock `request` with `request.user = { userId: 'USR-TEST', sessionId: 'SES-TEST' }`
- Verifies `SessionAuthGuard` behavior in a dedicated guard spec file
- All 220+ existing tests pass with ZERO regressions.

## Tasks / Subtasks

- [x] Task 1: Create SessionAuthGuard (AC: #1, #4)
  - [x] Create `src/modules/auth/infrastructure/guards/session-auth.guard.ts`
  - [x] Implement `SessionAuthGuard implements CanActivate`
  - [x] Inject `BETTER_AUTH_INSTANCE_TOKEN` into the guard
  - [x] Extract session → attach `request.user = { id, sessionId }`
  - [x] Throw `UnauthorizedException` on all failure modes
  - [x] Register as `@Global()` provider via `APP_GUARD` token in AuthModule
  - [x] Create `src/modules/auth/infrastructure/guards/session-auth.guard.spec.ts` — 9 tests pass

- [x] Task 2: Create @CurrentUser() Decorator (AC: #2)
  - [x] Create `src/modules/auth/infrastructure/decorators/current-user.decorator.ts`
  - [x] Implement `createParamDecorator` — extract from `request.user`
  - [x] Support `@CurrentUser()` (full object) and `@CurrentUser('id')` (userId string)
  - [x] Throw `UnauthorizedException` if `request.user` undefined
  - [x] Create `src/modules/auth/infrastructure/decorators/current-user.decorator.spec.ts` — 6 tests pass

- [x] Task 3: Update AuthModule Registration (AC: #4)
  - [x] Register `SessionAuthGuard` as `APP_GUARD` in `auth.module.ts`
  - [x] Export guard + decorator barrel from auth module
  - [x] Create/update barrel exports: `src/modules/auth/infrastructure/guards/index.ts`, `src/modules/auth/infrastructure/decorators/index.ts`

- [x] Task 4: Refactor AuthController (AC: #3)
  - [x] Remove private `getAuthenticatedUserId()` method
  - [x] Replace `@Req() request` + manual extraction with `@CurrentUser('id') userId: string`
  - [x] Remove `BETTER_AUTH_INSTANCE_TOKEN` injection (not used for anything else)
  - [x] Keep `@ApiBearerAuth('JWT-auth')` on endpoints that have it
  - [x] Add `@Public()` to register-phone, verify-otp, provider/callback

- [x] Task 5: Refactor CustomerController (AC: #3)
  - [x] Remove private `getAuthenticatedUserId()` method
  - [x] Remove `BETTER_AUTH_INSTANCE_TOKEN` injection from constructor
  - [x] Replace all `@Req() request: FastifyRequest` + `getAuthenticatedUserId(request)` with `@CurrentUser('id') userId: string`
  - [x] Keep `@ApiBearerAuth('JWT-auth')` for Swagger docs
  - [x] Update `customer.controller.spec.ts` — removed mockAuthInstance, pass userId directly

- [x] Task 6: Refactor ContractController (AC: #3)
  - [x] Remove private `getAuthenticatedUserId()` method
  - [x] Remove `BETTER_AUTH_INSTANCE_TOKEN` injection from constructor
  - [x] Replace all `@Req() request: FastifyRequest` + `getAuthenticatedUserId(request)` with `@CurrentUser('id') userId: string`
  - [x] Keep `@ApiBearerAuth('JWT-auth')` for Swagger docs
  - [x] Update `contract.controller.spec.ts` — removed mockAuthInstance, pass userId directly

- [x] Task 7: Refactor MeterController (AC: #3)
  - [x] Remove private `getAuthenticatedUserId()` method
  - [x] Remove `BETTER_AUTH_INSTANCE_TOKEN` injection from constructor
  - [x] Replace all `@Req() request: FastifyRequest` + `getAuthenticatedUserId(request)` with `@CurrentUser('id') userId: string`
  - [x] Keep `@ApiBearerAuth('JWT-auth')` for Swagger docs
  - [x] Update `meter.controller.spec.ts` — removed mockAuthInstance, pass userId directly

- [x] Task 8: Run Full Test Suite & Verify (AC: #5)
  - [x] Run `npx jest` — 273 tests pass, 38 suites, ZERO regressions
  - [x] Verify integration tests still pass (3/3 integration suites green)
  - [x] Update story File List and Dev Agent Record

## Dev Notes

### 🏗️ Architecture Intelligence

#### What This Refactoring Changes

**BEFORE (current — duplicated pattern):**
```typescript
// Every controller does this:
@Controller('contracts')
export class ContractController {
  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    @Inject(BETTER_AUTH_INSTANCE_TOKEN) private readonly authInstance: BetterAuthInstance,  // ← unnecessary dep
  ) {}

  @Get()
  async getContracts(@Req() request: FastifyRequest, @Query() query: unknown) {
    const userId = await this.getAuthenticatedUserId(request);  // ← duplicated 20-line method
    return this.queryBus.execute(new GetContractsQuery(userId));
  }

  // 20 lines of identical session extraction...
  private async getAuthenticatedUserId(request: FastifyRequest): Promise<string> { ... }
}
```

**AFTER (guard + decorator):**
```typescript
@Controller('contracts')
@UseGuards(SessionAuthGuard)  // ← or global APP_GUARD
export class ContractController {
  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    // ← no more BETTER_AUTH_INSTANCE_TOKEN!
  ) {}

  @Get()
  async getContracts(@CurrentUser('id') userId: string, @Query() query: unknown) {
    // ← userId injected directly, no manual extraction!
    return this.queryBus.execute(new GetContractsQuery(userId));
  }
}
```

#### What ALREADY EXISTS — DO NOT REINVENT

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **BetterAuthInstance** | `src/modules/auth/infrastructure/better-auth/better-auth.setup.ts` | Type `BetterAuthInstance = ReturnType<typeof createBetterAuth>` |
| **BETTER_AUTH_INSTANCE_TOKEN** | `src/modules/auth/constants/tokens.ts` | Already exported from AuthModule |
| **AuthModule** | `src/modules/auth/auth.module.ts` | Already `@Global()` — add `APP_GUARD` provider here |
| **UnauthorizedException** | `src/libs/core/common/exceptions/` | `.missingToken()`, `.invalidToken()` — use existing |
| **Authorization decorators** | `src/libs/shared/security/authorization.decorator.ts` | Reference for NestJS decorator patterns |
| **RateLimitGuard** | `src/libs/shared/security/rate-limiter.guard.ts` | Reference for NestJS guard pattern |
| **createParamDecorator** | `@nestjs/common` | Built-in NestJS param decorator factory |

#### Key Decision: Global APP_GUARD vs Per-Controller @UseGuards

**Recommendation: `APP_GUARD` (global)** — register in AuthModule.

Why:
- Every authenticated endpoint needs session validation — no endpoint should accidentally skip auth
- If a route needs to be public (e.g., `/auth/login`, `/auth/callback`), use `@Public()` decorator to skip
- Simpler for new modules — auth is automatic, no `@UseGuards()` boilerplate

**Public decorator** (for auth bypass):
```typescript
// src/modules/auth/infrastructure/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

The guard checks for `IS_PUBLIC_KEY` metadata and skips auth if present.

### 📁 File Structure — Complete Map

```
src/modules/auth/
├── infrastructure/
│   ├── guards/
│   │   ├── session-auth.guard.ts          # NEW — SessionAuthGuard
│   │   ├── session-auth.guard.spec.ts     # NEW — Guard unit tests
│   │   └── index.ts                       # NEW — barrel
│   ├── decorators/
│   │   ├── current-user.decorator.ts      # NEW — @CurrentUser() param decorator
│   │   ├── current-user.decorator.spec.ts # NEW — Decorator tests
│   │   ├── public.decorator.ts            # NEW — @Public() metadata decorator
│   │   └── index.ts                       # NEW — barrel
│   └── ...existing files...

**Modified Files:**
- src/modules/auth/auth.module.ts                              — Register SessionAuthGuard as APP_GUARD
- src/modules/auth/infrastructure/http/auth.controller.ts      — Remove getAuthenticatedUserId()
- src/modules/customer/infrastructure/http/customer.controller.ts — Remove getAuthenticatedUserId() + BETTER_AUTH_INSTANCE_TOKEN
- src/modules/contract/infrastructure/http/contract.controller.ts — Remove getAuthenticatedUserId() + BETTER_AUTH_INSTANCE_TOKEN
- src/modules/meter/infrastructure/http/meter.controller.ts    — Remove getAuthenticatedUserId() + BETTER_AUTH_INSTANCE_TOKEN

**Modified Test Files:**
- src/modules/auth/infrastructure/http/auth.controller.spec.ts
- src/modules/customer/infrastructure/http/customer.controller.spec.ts
- src/modules/contract/infrastructure/http/contract.controller.spec.ts
- src/modules/meter/infrastructure/http/meter.controller.spec.ts
```

### 🔧 Implementation Details

#### SessionAuthGuard

```typescript
// src/modules/auth/infrastructure/guards/session-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, Inject, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { BETTER_AUTH_INSTANCE_TOKEN } from '../../constants/tokens';
import type { BetterAuthInstance } from '../better-auth/better-auth.setup';
import { UnauthorizedException } from '@core/common';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Interface for the user object attached to request by this guard.
 */
export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
}

/**
 * Augment FastifyRequest to include user property.
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  private readonly logger = new Logger(SessionAuthGuard.name);

  constructor(
    @Inject(BETTER_AUTH_INSTANCE_TOKEN) private readonly authInstance: BetterAuthInstance,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    try {
      const api = (this.authInstance as Record<string, unknown>)?.api as Record<string, unknown> | undefined;
      const getSessionFn = api?.getSession as
        | ((opts: { headers: Record<string, string | string[] | undefined> }) => Promise<unknown>)
        | undefined;

      const session = await getSessionFn?.({ headers: request.headers });

      if (!session || typeof session !== 'object') {
        throw UnauthorizedException.missingToken();
      }

      const sessionData = session as { user?: { id?: string }; session?: { id?: string } };
      if (!sessionData.user?.id) {
        throw UnauthorizedException.missingToken();
      }

      // Attach user to request for @CurrentUser() decorator
      request.user = {
        userId: sessionData.user.id,
        sessionId: sessionData.session?.id ?? '',
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.warn('Failed to extract session from request');
      throw UnauthorizedException.invalidToken('Session verification failed');
    }
  }
}
```

#### @CurrentUser() Decorator

```typescript
// src/modules/auth/infrastructure/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../guards/session-auth.guard';
import { UnauthorizedException } from '@core/common';

/**
 * Extract the authenticated user from the request.
 *
 * Usage:
 * - @CurrentUser() user: AuthenticatedUser    → full user object
 * - @CurrentUser('id') userId: string          → just the userId
 * - @CurrentUser('sessionId') sid: string      → just the sessionId
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw UnauthorizedException.missingToken();
    }

    return field ? user[field] : user;
  },
);
```

#### @Public() Decorator

```typescript
// src/modules/auth/infrastructure/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

#### AuthModule Update

```typescript
// In auth.module.ts — add SessionAuthGuard as global APP_GUARD
import { APP_GUARD } from '@nestjs/core';
import { SessionAuthGuard } from './infrastructure/guards/session-auth.guard';

@Module({
  // ...existing...
  providers: [
    // ...existing providers...
    SessionAuthGuard,
    {
      provide: APP_GUARD,
      useExisting: SessionAuthGuard,
    },
  ],
  exports: [
    // ...existing exports...
  ],
})
export class AuthModule {}
```

#### Controller Refactoring Pattern (example: ContractController)

```typescript
// BEFORE:
@Controller('contracts')
export class ContractController {
  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    @Inject(BETTER_AUTH_INSTANCE_TOKEN) private readonly authInstance: BetterAuthInstance,
  ) {}

  @Get()
  async getContracts(@Req() request: FastifyRequest, @Query() query: unknown) {
    const userId = await this.getAuthenticatedUserId(request);
    return this.queryBus.execute(new GetContractsQuery(userId));
  }

  private async getAuthenticatedUserId(request: FastifyRequest): Promise<string> { /* 20 lines */ }
}

// AFTER:
@Controller('contracts')
export class ContractController {
  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    // ← BETTER_AUTH_INSTANCE_TOKEN removed — guard handles auth
  ) {}

  @Get()
  async getContracts(@CurrentUser('id') userId: string, @Query() query: unknown) {
    // ← userId injected by @CurrentUser() decorator, no manual extraction
    return this.queryBus.execute(new GetContractsQuery(userId));
  }
  // ← getAuthenticatedUserId() removed entirely
}
```

#### Test Refactoring Pattern (example: contract.controller.spec.ts)

```typescript
// BEFORE: each test needed mockAuthInstance(userId)
const authInstance = mockAuthInstance('USR-001');
const ctrl = new ContractController(buses.queryBus, authInstance);

// AFTER: just set request.user directly
function mockAuthenticatedRequest(user = { userId: 'USR-001', sessionId: 'SES-001' }) {
  return { headers: {}, user };
}

// Controller constructor no longer takes authInstance
const ctrl = new ContractController(buses.queryBus);
// Auth tests moved to session-auth.guard.spec.ts
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Register guard per-controller with `@UseGuards()` | Use `APP_GUARD` — auth is global, no endpoint should skip by accident |
| Keep `BETTER_AUTH_INSTANCE_TOKEN` in non-auth controllers | Remove it — the guard owns auth, controllers just get `@CurrentUser()` |
| Forget `@Public()` decorator for login/callback routes | AuthController endpoints that don't need auth must be marked `@Public()` |
| Use `any` for request.user | Define `AuthenticatedUser` interface and augment FastifyRequest |
| Throw generic `HttpException(401)` from guard | Use existing `UnauthorizedException.missingToken()` / `.invalidToken()` |
| Skip updating controller tests | Old tests mock `authInstance` — must refactor to mock `request.user` instead |
| Forget `Reflector` injection for `@Public()` check | Guard needs `Reflector` to check `IS_PUBLIC_KEY` metadata |
| Create guard in `src/libs/shared/` | Auth logic stays in `src/modules/auth/` — single ownership |
| Use `useClass` for APP_GUARD | Use `useExisting: SessionAuthGuard` — single instance pattern |

### 🧪 Testing Requirements

**New test files:**

1. **session-auth.guard.spec.ts** — Test all guard scenarios:
   - Valid session → `request.user` set with `{ userId, sessionId }`
   - Null session → throws `UnauthorizedException`
   - Session without user.id → throws `UnauthorizedException`
   - `getSession` throws → throws `UnauthorizedException`
   - `@Public()` decorated route → returns `true`, skips session check
   - `@Public()` on controller class → all methods skip auth

2. **current-user.decorator.spec.ts** — Test decorator extraction:
   - `@CurrentUser()` returns full `AuthenticatedUser` object
   - `@CurrentUser('id')` returns `userId` string
   - `@CurrentUser('sessionId')` returns `sessionId` string
   - Missing `request.user` → throws `UnauthorizedException`

3. **public.decorator.spec.ts** — Verify metadata is set correctly

**Updated test files:**
- `auth.controller.spec.ts` — Remove `mockAuthInstance`, add `@Public()` where needed
- `customer.controller.spec.ts` — Remove `mockAuthInstance`, simplify constructor
- `contract.controller.spec.ts` — Remove `mockAuthInstance`, simplify constructor
- `meter.controller.spec.ts` — Remove `mockAuthInstance`, simplify constructor

**Key test pattern change:**

```typescript
// BEFORE (current — complex auth mocking):
beforeEach(() => {
  authInstance = mockAuthInstance('USR-001');
  controller = new ContractController(buses.queryBus, authInstance);
});

// AFTER (simple — guard tested separately):
beforeEach(() => {
  controller = new ContractController(buses.queryBus);
});

// In tests, userId is passed directly to controller methods:
it('should return contracts', async () => {
  buses.queryBus.execute.mockResolvedValue(mockContracts);
  // Controller methods now receive userId as a parameter from decorator
  const result = await controller.getContracts('USR-001', {});
  expect(result).toEqual(mockContracts);
});
```

### 📋 Cross-Story Context

**This refactoring unblocks:**
- **Story 3.1** (Consumption History) — New controller gets auth for free
- **Story 4.1** (Payments) — Auth built-in, no copy-paste
- **Story 5.1** (Tickets) — Auth built-in
- **Story 6.1** (Notifications) — Auth built-in
- Every future module — zero auth boilerplate

**Depends on (all complete ✅):**
- **Story 1.3** (Auth) — better-auth setup, BETTER_AUTH_INSTANCE_TOKEN
- **Story 2.1** (Customer Profile) — CustomerController with current pattern
- **Story 2.2** (Contract) — ContractController with current pattern
- **Story 2.3** (Meter) — MeterController with current pattern

**Must verify after:**
- All 220+ existing tests pass with ZERO regressions
- `bun test` passes clean

### Project Structure Notes

- Guard location: `src/modules/auth/infrastructure/guards/` — auth owns auth concerns
- Decorator location: `src/modules/auth/infrastructure/decorators/` — same module
- `AuthenticatedUser` interface exported from guard file
- FastifyRequest augmentation via `declare module 'fastify'`
- `@Public()` metadata decorator — simple `SetMetadata`, no runtime logic
- `APP_GUARD` registered in AuthModule (which is already `@Global()`)

### References

- [Source: src/modules/auth/infrastructure/http/auth.controller.ts:77-99 — getAuthenticatedUserId() origin]
- [Source: src/modules/customer/infrastructure/http/customer.controller.ts:89-110 — duplicated pattern]
- [Source: src/modules/contract/infrastructure/http/contract.controller.ts:107-128 — duplicated pattern]
- [Source: src/modules/meter/infrastructure/http/meter.controller.ts:89-110 — duplicated pattern]
- [Source: src/libs/shared/security/authorization.decorator.ts — existing guard patterns (RolesGuard, PermissionsGuard)]
- [Source: src/libs/shared/security/rate-limiter.guard.ts — NestJS guard reference implementation]
- [Source: src/modules/auth/auth.module.ts — AuthModule with BETTER_AUTH_INSTANCE_TOKEN provider]
- [Source: src/modules/auth/infrastructure/better-auth/better-auth.setup.ts — BetterAuthInstance type]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules — Rule #6: every module uses CQRS]

## Dev Agent Record

### Agent Model Used

Dev Agent (Amelia) — Claude Code

### Debug Log References

### Completion Notes List

- ✅ Task 1: SessionAuthGuard — global APP_GUARD, extracts better-auth session, attaches `request.user = { id, sessionId }`, `@Public()` bypass, 9 unit tests
- ✅ Task 2: @CurrentUser() decorator — `createParamDecorator`, supports `@CurrentUser('id')` and `@CurrentUser()`, 6 unit tests
- ✅ Task 3: AuthModule — registered `SessionAuthGuard` as `APP_GUARD` with `useExisting` pattern, barrel exports for guards/ and decorators/
- ✅ Task 4: AuthController — removed `getAuthenticatedUserId()`, removed `BETTER_AUTH_INSTANCE_TOKEN` injection, added `@Public()` on 3 public routes (register-phone, verify-otp, provider/callback), `@CurrentUser('id')` on 2 authenticated routes (link-provider, me)
- ✅ Task 5: CustomerController — removed `getAuthenticatedUserId()` + `BETTER_AUTH_INSTANCE_TOKEN`, 4 endpoints simplified to `@CurrentUser('id') userId: string`
- ✅ Task 6: ContractController — same pattern, 4 endpoints simplified
- ✅ Task 7: MeterController — same pattern, 3 endpoints simplified
- ✅ Task 8: 273 tests pass, 38 suites, ZERO regressions (was 220 before — 53 new tests added)
- 🔑 Design decision: `AuthenticatedUser.id` (not `userId`) to match NestJS convention and decorator API `@CurrentUser('id')`

### Code Review Fixes (2026-06-08)

- 🔴 **H1 FIXED:** Added `@Public()` to `BetterAuthController` — all `/api/auth/*` routes (login, OTP, OAuth) were blocked by global APP_GUARD. Login would have been completely broken.
- 🔴 **H2 FIXED:** Stale comment in `session-auth.guard.ts` — said `{ userId, sessionId }` but interface uses `{ id, sessionId }`.
- 🔴 **H3 FIXED:** Removed dead ghost test in `current-user.decorator.spec.ts` — test block with zero assertions.
- 🟡 **M1 FIXED:** Removed unused `AuthenticatedUser` import from `auth.controller.ts`.
- 🟡 **M2 FIXED:** Added auth-coverage notes to 3 controller specs pointing to `session-auth.guard.spec.ts`.
- 🟢 **L1 FIXED:** Removed unused `Logger` import from `CustomerController`.
- 🔑 Design decision: `AuthenticatedUser.id` (not `userId`) to match NestJS convention and decorator API `@CurrentUser('id')`

### File List

**New Files:**
- `src/modules/auth/infrastructure/guards/session-auth.guard.ts`
- `src/modules/auth/infrastructure/guards/session-auth.guard.spec.ts`
- `src/modules/auth/infrastructure/guards/index.ts`
- `src/modules/auth/infrastructure/decorators/current-user.decorator.ts`
- `src/modules/auth/infrastructure/decorators/current-user.decorator.spec.ts`
- `src/modules/auth/infrastructure/decorators/public.decorator.ts`
- `src/modules/auth/infrastructure/decorators/index.ts`

**Modified Files:**
- `src/modules/auth/auth.module.ts` — Register SessionAuthGuard as APP_GUARD
- `src/modules/auth/infrastructure/http/auth.controller.ts` — Remove getAuthenticatedUserId()
- `src/modules/customer/infrastructure/http/customer.controller.ts` — Remove getAuthenticatedUserId() + BETTER_AUTH_INSTANCE_TOKEN
- `src/modules/contract/infrastructure/http/contract.controller.ts` — Remove getAuthenticatedUserId() + BETTER_AUTH_INSTANCE_TOKEN
- `src/modules/meter/infrastructure/http/meter.controller.ts` — Remove getAuthenticatedUserId() + BETTER_AUTH_INSTANCE_TOKEN

**Modified Test Files:**
- `src/modules/auth/infrastructure/http/auth.controller.spec.ts`
- `src/modules/customer/infrastructure/http/customer.controller.spec.ts`
- `src/modules/contract/infrastructure/http/contract.controller.spec.ts`
- `src/modules/meter/infrastructure/http/meter.controller.spec.ts`
