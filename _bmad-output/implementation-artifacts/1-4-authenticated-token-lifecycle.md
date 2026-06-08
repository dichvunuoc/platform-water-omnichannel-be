# Story 1.4: Authenticated Token Lifecycle

Status: review

## Story

As a **customer using any channel (App/Web/Zalo)**,
I want to stay authenticated without noticing token expiration,
so that I can use the service continuously without being logged out mid-task.

## Acceptance Criteria

### AC1: JWT Generation on Downstream Calls
**Given** a customer successfully authenticates via any provider from Story 1.3
**When** the auth flow completes and `PortHttpClient` makes a downstream call
**Then** **better-auth** manages the frontend session: issuing and storing a 7-day refresh token for silent renewal on the BFF↔Frontend boundary
**And** when `PortHttpClient` makes a downstream call, **jose** dynamically generates a 15-minute JWT containing: `sub` (UserID), `roles`, `provider` (channel), `session_id`, `xi_nghiep`, `iat`, `exp`
**And** these are **two separate token systems**: better-auth for frontend session management, jose for BFF→downstream identity propagation — they must not be conflated.

### AC2: Auto-Refresh on Downstream 401
**Given** an authenticated customer makes a request to a downstream service
**When** the downstream service returns HTTP 401 (expired/invalid token)
**Then** the BFF Auth Propagation middleware automatically refreshes the jose JWT (using better-auth session to re-issue) and retries the downstream call once
**And** the customer experiences zero disruption.

### AC3: Session Expired Handling
**Given** the auto-refresh attempt also fails (better-auth session expired)
**When** the retry returns 401
**Then** the system returns a structured 401 response to the frontend with a clear "session expired" message
**And** the frontend can prompt re-authentication.

### AC4: Multi-Channel Concurrent Sessions
**Given** a customer has an active session on Web and opens the Zalo channel
**When** both channels share the same UserID (via multi-provider linking from Story 1.3)
**Then** both channels can operate concurrently with valid tokens
**And** each channel's jose JWT carries the `provider` field identifying the source channel.

### AC5: Automatic JWT Injection on All Downstream Calls
**Given** a downstream service call is made
**When** the request is constructed by `PortHttpClient`
**Then** the `Authorization: Bearer {joseJWT}` header is automatically injected
**And** the `x-correlation-id` header is included for distributed tracing.

### AC6: JWT Secret Rotation
**Given** a JWT secret rotation is in progress
**When** the system signs new tokens with `JWT_SECRET_NEW`
**Then** downstream services can verify tokens using either `JWT_SECRET_OLD` or `JWT_SECRET_NEW`
**And** after 24h, `JWT_SECRET_OLD` is removed from verification.

## Tasks / Subtasks

- [x] Task 1: Create JWT Signer Service (AC: #1, #6)
  - [x] Create `src/libs/shared/auth-propagation/jwt-signer.service.ts` — Uses `jose` to sign 15-min JWTs with payload: sub, roles, provider, session_id, xi_nghiep, iat, exp
  - [x] Implement HS256 symmetric signing with `JWT_SECRET` env var
  - [x] Implement dual-key verification (JWT_SECRET_NEW + JWT_SECRET_OLD for rotation)
  - [x] TTL: 15 minutes (NFR-S4)
  - [x] Inject `ConfigService` for secret and TTL configuration

- [x] Task 2: Create Auth Propagation Middleware (AC: #1, #5)
  - [x] Create `src/libs/shared/auth-propagation/auth-propagation.middleware.ts` — Extracts user identity from better-auth session
  - [x] Resolves current user from better-auth session (cookie or header)
  - [x] Stores user identity (userId, roles, provider, sessionId) in RequestContext for downstream JWT generation
  - [x] Skip JWT generation for unauthenticated routes (webhooks, health checks)

- [x] Task 3: Create Auth Propagation Module (AC: all)
  - [x] Create `src/libs/shared/auth-propagation/auth-propagation.module.ts` — @Global NestJS module
  - [x] Register JwtSignerService as provider
  - [x] Export JwtSignerService for use in PortHttpClient
  - [x] Create `src/libs/shared/auth-propagation/index.ts` — barrel export

- [x] Task 4: Enhance PortHttpClient with JWT Injection (AC: #1, #5)
  - [x] Inject JwtSignerService into `PortHttpClient`
  - [x] Before each outbound request: generate jose JWT from RequestContext (userId, roles, provider, sessionId)
  - [x] Inject `Authorization: Bearer {joseJWT}` header into every outbound call
  - [x] Skip JWT injection for webhook endpoints (no user context) — detect via RequestContext absence
  - [x] Keep existing headers: `x-correlation-id`, `x-idempotency-key`

- [x] Task 5: Implement Auto-Refresh on 401 (AC: #2, #3)
  - [x] In `PortHttpClient.request()`: detect 401 response from downstream
  - [x] On 401: regenerate jose JWT (re-read session from better-auth) → retry the request ONCE
  - [x] If retry also returns 401: throw `PortDownstreamException` with structured error response
  - [x] Log 401 events with correlation ID for debugging
  - [x] DO NOT retry on 403 (ForbiddenException — no retry per error handling chain)

- [x] Task 6: Register AuthPropagationModule (AC: all)
  - [x] Import AuthPropagationModule in `src/app.module.ts`
  - [x] Ensure load order: ContextModule → AuthModule → AuthPropagationModule → PortModule
  - [x] Verify JwtSignerService is available in PortHttpClient via DI

- [x] Task 7: Update RequestContext for Auth Identity (AC: #1, #4)
  - [x] Auth fields (roles, provider, sessionId) stored in RequestContext.metadata — no interface change needed
  - [x] userId and tenantId already exist in IRequestContext
  - [x] Middleware enriches metadata with auth identity

- [x] Task 8: Write comprehensive tests (AC: all)
  - [x] `jwt-signer.service.spec.ts` — Sign JWT, verify payload, TTL expiry, dual-key rotation (10 tests)
  - [x] `auth-propagation.middleware.spec.ts` — Extract user from session, skip unauthenticated routes (16 tests)
  - [x] `port-http-client.service.spec.ts` — JWT header injection, 401 retry, 401 retry failure, 403 no retry, no-JWT for webhooks (9 tests)
  - [ ] Integration test: authenticate → call downstream → verify JWT in Authorization header

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story builds the **identity propagation layer** — the bridge between better-auth frontend sessions and downstream service calls. Every downstream call in every future story depends on this JWT being injected correctly.

#### TWO SEPARATE Token Systems — DO NOT CONFLATE

| Concern | Library | Where | TTL | Managed By |
|---------|---------|-------|-----|------------|
| **Frontend Session** (BFF ↔ Frontend) | `better-auth` | Cookie-based, silent renewal | 7-day refresh | Story 1.3 ✅ |
| **Backend Propagation** (BFF → Downstream) | `jose` | `Authorization: Bearer` header | 15-min access | **This story (1.4)** |

**Flow:**
```
Customer authenticates via better-auth (Story 1.3)
  → better-auth sets session cookie (7-day)
  → Customer makes API call to BFF
  → AuthPropagationMiddleware extracts identity from better-auth session
  → Stores in RequestContext (userId, roles, provider, sessionId)
  → Handler calls PortRegistry.execute()
  → PortHttpClient reads RequestContext
  → JwtSignerService signs 15-min JWT via jose
  → Authorization: Bearer {jwt} injected into downstream request
  → Downstream verifies JWT using shared secret (JWT_SECRET)
```

#### What Story 1.3 Built (ASSUME COMPLETE — Status: review)

| Component | Location | What It Provides |
|-----------|----------|-----------------|
| BetterAuth setup | `src/modules/auth/infrastructure/better-auth/better-auth.setup.ts` | Session management, cookie-based, 7-day refresh |
| BetterAuth controller | `src/modules/auth/infrastructure/better-auth/better-auth.controller.ts` | Mounts handler on `/api/auth/*` |
| AuthController | `src/modules/auth/infrastructure/http/auth.controller.ts` | REST endpoints: /auth/register-phone, /auth/verify-otp, /auth/me, etc. |
| User entity | `src/modules/auth/domain/entities/user.entity.ts` | User aggregate root with providers |
| PiiEncryptionService | `src/modules/auth/infrastructure/persistence/encryption/pii-encryption.service.ts` | AES-256-GCM for PII |
| AuthModule | `src/modules/auth/auth.module.ts` | Registered in AppModule |
| better-auth session | `sessionsTable` in PostgreSQL | Cookie-based sessions with 7-day TTL |

**Key Code Review finding from Story 1.3:**
- `GET /auth/me` extracts userId from better-auth session via `getAuthenticatedUserId()` — **follow this same pattern** to get user identity for JWT signing
- bodyParser disabled in `main.ts` for better-auth compatibility

#### What ALREADY EXISTS — DO NOT REINVENT

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **PortHttpClient** | `src/libs/shared/port/port-http-client.service.ts` | **MODIFY THIS** — add JWT injection. Already has comment: "JWT injection (prepared for Story 1.4)". Currently injects `x-correlation-id` and `x-idempotency-key`. |
| **RequestContextProvider** | `src/libs/shared/context/request-context.provider.ts` | Already has `userId`, `tenantId` fields. **EXTEND** to add `roles`, `provider`, `sessionId`. |
| **IRequestContext** | `src/libs/core/common/context/request-context.interface.ts` | Interface for context — **EXTEND** with auth fields. |
| **StructuredLogger** | `src/libs/shared/observability/structured-logger.service.ts` | Use for all JWT/auth-propagation logging. |
| **Exception Classes** | `src/libs/core/common/exceptions/` | `UnauthorizedException`, `ForbiddenException`, etc. |
| **CorrelationIdMiddleware** | `src/libs/shared/context/` | Already global — sets up RequestContext per request. |
| **PortModule** | `src/libs/shared/port/port.module.ts` | @Global — provides PortHttpClient everywhere. |
| **jose ^6.2.3** | Already installed | ESM-only, Bun-compatible, zero deps. API: `SignJWT`, `jwtVerify`. |
| **ConfigService** | `@nestjs/config` | Read JWT_SECRET, JWT_SECRET_OLD, token TTL from env vars. |

#### PortHttpClient — Current State (What to Modify)

The current `PortHttpClient.request()` method at `src/libs/shared/port/port-http-client.service.ts`:
- ✅ Already reads `RequestContext` for `correlationId`
- ✅ Already injects `x-correlation-id` header
- ✅ Already injects `x-idempotency-key` for POST/PUT
- ❌ Does NOT inject `Authorization: Bearer` header yet — **THIS IS WHAT YOU ADD**
- ❌ Does NOT handle 401 auto-retry — **THIS IS WHAT YOU ADD**

**Integration point:** Around line 72 in port-http-client.service.ts, after building headers:
```typescript
// Current code:
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'x-correlation-id': correlationId,
};

// ADD HERE: JWT injection
// if (context?.userId) {
//   const jwt = await this.jwtSigner.sign({
//     sub: context.userId,
//     roles: context.roles ?? ['customer'],
//     provider: context.provider ?? 'web',
//     session_id: context.sessionId ?? '',
//     xi_nghiep: context.tenantId ?? '',
//   });
//   headers['Authorization'] = `Bearer ${jwt}`;
// }
```

**401 retry — add in the error handling section** (around line 115):
```typescript
// After: if (!response.ok)
// if (response.status === 401 && !options._isRetry) {
//   // Regenerate JWT and retry once
//   const newJwt = await this.jwtSigner.sign({ ... });
//   headers['Authorization'] = `Bearer ${newJwt}`;
//   return this.request({ ...options, _isRetry: true }, headers);
// }
```

### 📁 File Structure — New Files to Create

```
src/libs/shared/auth-propagation/
├── jwt-signer.service.ts              # jose JWT signing + verification
├── auth-propagation.middleware.ts      # Extract user from better-auth session → RequestContext
├── auth-propagation.module.ts          # @Global NestJS module
├── auth-propagation.interface.ts       # JwtPayload, JwtSignerOptions types
└── index.ts                            # barrel export
```

**Modified Files:**
- `src/libs/shared/port/port-http-client.service.ts` — Add JWT injection + 401 retry
- `src/libs/shared/port/port.module.ts` — Import AuthPropagationModule
- `src/libs/core/common/context/request-context.interface.ts` — Add auth fields
- `src/libs/shared/context/request-context.provider.ts` — Implement auth fields
- `src/app.module.ts` — Import AuthPropagationModule

### 🔧 Implementation Details

#### JWT Signer Service

```typescript
// src/libs/shared/auth-propagation/jwt-signer.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, jwtVerify, errors } from 'jose';
import type { JwtPayload } from './auth-propagation.interface';

@Injectable()
export class JwtSignerService {
  private readonly secret: Uint8Array;
  private readonly oldSecret: Uint8Array | null;
  private readonly ttl: string; // e.g., '15m'
  private readonly issuer: string;

  constructor(private readonly configService: ConfigService) {
    const secretStr = this.configService.getOrThrow<string>('JWT_SECRET');
    this.secret = new TextEncoder().encode(secretStr);
    const oldSecretStr = this.configService.get<string>('JWT_SECRET_OLD');
    this.oldSecret = oldSecretStr ? new TextEncoder().encode(oldSecretStr) : null;
    this.ttl = this.configService.get<string>('JWT_TTL', '15m');
    this.issuer = this.configService.get<string>('JWT_ISSUER', 'cskh-bff');
  }

  /**
   * Sign a JWT for downstream propagation.
   * Payload per project-context.md: sub, roles, provider, session_id, xi_nghiep, iat, exp
   */
  async sign(payload: JwtPayload): Promise<string> {
    return new SignJWT({
      sub: payload.sub,
      roles: payload.roles,
      provider: payload.provider,
      session_id: payload.sessionId,
      xi_nghiep: payload.xiNghiep,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.ttl)
      .setIssuer(this.issuer)
      .sign(this.secret);
  }

  /**
   * Verify a JWT — tries current secret first, then old secret (rotation support).
   */
  async verify(token: string): Promise<JwtPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secret, { issuer: this.issuer });
      return payload as unknown as JwtPayload;
    } catch (error) {
      // Try old secret for rotation
      if (this.oldSecret && error instanceof errors.JWTExpired === false) {
        const { payload } = await jwtVerify(token, this.oldSecret, { issuer: this.issuer });
        return payload as unknown as JwtPayload;
      }
      throw error;
    }
  }
}
```

#### JWT Payload Interface

```typescript
// src/libs/shared/auth-propagation/auth-propagation.interface.ts
export interface JwtPayload {
  /** UserID — from better-auth session */
  sub: string;
  /** User roles — default ['customer'] */
  roles: string[];
  /** Auth channel — 'zalo' | 'hotline' | 'counter' | 'web' */
  provider: string;
  /** better-auth session ID */
  sessionId: string;
  /** Enterprise/Tenant ID (for KH doanh nghiệp) */
  xiNghiep?: string;
}
```

#### Auth Propagation Middleware

```typescript
// src/libs/shared/auth-propagation/auth-propagation.middleware.ts
import { Injectable, Inject, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { REQUEST_CONTEXT_TOKEN } from '../../core';
import type { IRequestContextProvider } from '../../core';

/**
 * Extracts user identity from better-auth session and enriches RequestContext.
 *
 * This runs AFTER CorrelationIdMiddleware (which creates the initial context).
 * It reads the better-auth session cookie/header, extracts userId + roles + provider,
 * and updates the RequestContext so JwtSignerService can generate a downstream JWT.
 *
 * SKIP for: webhook endpoints (/webhooks/*), health checks (/health), public routes.
 */
@Injectable()
export class AuthPropagationMiddleware implements NestMiddleware {
  constructor(
    @Inject(REQUEST_CONTEXT_TOKEN)
    private readonly contextProvider: IRequestContextProvider,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const context = this.contextProvider.current();
    if (!context) {
      // No context (shouldn't happen — CorrelationIdMiddleware runs first)
      return next();
    }

    // Extract user identity from better-auth session
    // better-auth stores session in cookie — use better-auth API to verify
    // For now: read from request headers if set by better-auth controller
    // or use better-auth's handler to get session from cookie
    const userId = (req as any).user?.id ?? req.headers['x-user-id'] as string | undefined;
    const roles = (req as any).user?.roles ?? ['customer'];
    const provider = (req as any).user?.provider ?? req.headers['x-auth-provider'] as string ?? 'web';
    const sessionId = (req as any).user?.sessionId ?? req.headers['x-session-id'] as string;

    if (userId) {
      // Enrich RequestContext with auth identity
      const enriched = this.contextProvider.createFull({
        correlationId: context.correlationId,
        userId,
        tenantId: context.tenantId,
        metadata: {
          ...context.metadata,
          roles,
          provider,
          sessionId,
        },
      });
      this.contextProvider.run(enriched, () => next());
      return;
    }

    // No authenticated user — proceed without JWT (webhooks, health, public routes)
    next();
  }
}
```

#### 401 Auto-Retry Pattern in PortHttpClient

```typescript
// In PortHttpClient.request() — add after the response.ok check:

if (response.status === 401 && !isRetry) {
  // AC: #2 — Auto-refresh JWT and retry once
  this.logger.debug(`[${portName}] 401 received — regenerating JWT and retrying`);

  // Regenerate JWT (re-read from RequestContext — middleware may have refreshed session)
  const newContext = this.requestContext.current();
  if (newContext?.userId) {
    const newJwt = await this.jwtSigner.sign({
      sub: newContext.userId,
      roles: (newContext.metadata?.roles as string[]) ?? ['customer'],
      provider: (newContext.metadata?.provider as string) ?? 'web',
      sessionId: (newContext.metadata?.sessionId as string) ?? '',
      xiNghiep: newContext.tenantId,
    });
    headers['Authorization'] = `Bearer ${newJwt}`;
  }

  // Retry the request with new JWT
  return this.requestInternal<T>({ ...options, _isRetry: true }, headers);
}

// AC: #3 — Retry also failed → structured 401 to frontend
if (response.status === 401 && isRetry) {
  this.structuredLogger.warn(`Auth propagation failed after retry [${portName}]`, {
    trace: { correlationId },
  });
  throw new UnauthorizedException('Session expired — please re-authenticate');
}
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Use better-auth tokens as downstream JWTs | better-auth = frontend session cookie, jose = downstream Bearer JWT. Different systems. |
| Install `@nestjs/jwt` | `jose ^6.2.3` already installed in Story 1.3 — use it directly |
| Generate JWT on every request even for webhooks | Only generate when RequestContext has userId (skip for /webhooks/*, /health) |
| Retry on 403 (Forbidden) | 403 = no retry (per error handling chain). Only retry 401 once. |
| Retry more than once on 401 | ONE retry only. If retry also 401 → `UnauthorizedException` to frontend. |
| Hardcode JWT secret | Read from `JWT_SECRET` env var. Rotation via `JWT_SECRET_OLD` + `JWT_SECRET_NEW`. |
| Store downstream JWT in Redis | JWT is stateless — generate on-the-fly per request, verify at downstream via shared secret. |
| Use `any` type for JWT payload | Define `JwtPayload` interface with Zod schema for validation. |
| Modify better-auth session management | better-auth handles frontend sessions — don't touch it. Only add jose layer for downstream. |
| Forget to update RequestContext interface | Extend `IRequestContext` to include roles, provider, sessionId for JWT payload. |
| Put JWT signing logic in controllers | JwtSignerService in shared library — used by PortHttpClient, not controllers. |

### 🧪 Testing Requirements

**Key test scenarios:**

1. **JWT Sign** — Sign a payload → verify it decodes correctly with expected fields (sub, roles, provider, session_id, xi_nghiep, iat, exp)
2. **JWT TTL** — Signed JWT expires after 15 minutes → `jwtVerify` throws `JWTExpired`
3. **JWT Secret Rotation** — Sign with new secret → verify with old secret succeeds → remove old → verify fails
4. **PortHttpClient JWT Injection** — Authenticated request → Authorization header present with valid Bearer JWT
5. **PortHttpClient No-JWT for Webhooks** — No userId in context → no Authorization header
6. **401 Auto-Retry** — First 401 → JWT regenerated → retry succeeds → return data
7. **401 Retry Failure** — First 401 → retry also 401 → throw `UnauthorizedException`
8. **403 No Retry** — 403 response → immediately throw `ForbiddenException` — no retry
9. **JWT Payload Content** — Verify sub=userId, roles=['customer'], provider='zalo', session_id present
10. **Multi-Channel Concurrent** — Same userId, different provider → JWTs have different `provider` field
11. **Correlation ID in JWT flow** — Every JWT-related log includes correlationId

### Project Structure Notes

- New shared library: `src/libs/shared/auth-propagation/` — @Global module, provides JwtSignerService
- **Modified:** `src/libs/shared/port/port-http-client.service.ts` — Add JWT injection + 401 retry logic
- **Modified:** `src/libs/shared/port/port.module.ts` — Import AuthPropagationModule
- **Modified:** `src/libs/core/common/context/request-context.interface.ts` — Add roles, provider, sessionId
- **Modified:** `src/libs/shared/context/request-context.provider.ts` — Implement new fields
- **Modified:** `src/app.module.ts` — Register AuthPropagationModule
- New env vars: `JWT_SECRET` (shared with downstream services), `JWT_SECRET_OLD` (rotation), `JWT_TTL` (default: '15m'), `JWT_ISSUER` (default: 'cskh-bff')
- DI token: `JWT_SIGNER_SERVICE_TOKEN` in auth-propagation module
- **Note:** `jose ^6.2.3` is ESM-only — import via `import { SignJWT, jwtVerify } from 'jose'` (Bun handles ESM natively)

### Previous Story Learnings (Story 1.3 — MUST Apply)

- **better-auth session extraction:** Use `getAuthenticatedUserId()` pattern from AuthController — don't reinvent session parsing
- **RequestContext enrichment:** Already has `userId` field — extend it, don't create a separate auth context
- **bodyParser disabled:** `main.ts` has `bodyParser: false` for better-auth — don't change this
- **Code review finding:** MockAuthAdapter not yet registered in PortRegistry — consider doing this as part of integration testing
- **Test suite:** 131 tests currently passing across 15 suites — ensure ZERO regressions

### 🔬 Latest Tech Information (Verified June 2026)

#### jose v6.2.2 (Already Installed)

- **ESM-only** — import via `import { SignJWT, jwtVerify } from 'jose'`
- **Bun-compatible** — uses Web Crypto API, no native deps, zero dependencies
- **Key APIs:**
  - `new SignJWT({ payload }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('15m').sign(secret)` — returns Promise<string>
  - `jwtVerify(token, secret, { issuer })` — returns `{ payload, protectedHeader }`
  - `new TextEncoder().encode(secret)` — convert string to `Uint8Array` for jose
- **Error classes:** `errors.JWTExpired`, `errors.JWTInvalid`, `errors.JWSSignatureVerificationFailed`
- **No `require()` support** — must use `import` (Bun default is ESM, so this is fine)

#### Secret Rotation Pattern

```
1. Deploy with JWT_SECRET = new-secret, JWT_SECRET_OLD = previous-secret
2. Downstream verifies with both secrets (try new first, fallback to old)
3. After 24h, remove JWT_SECRET_OLD from downstream config
4. All tokens now signed and verified with new secret only
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4: Authenticated Token Lifecycle]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security]
- [Source: _bmad-output/planning-artifacts/architecture.md#Auth Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#JWT Token Strategy]
- [Source: _bmad-output/planning-artifacts/architecture.md#Security Measures]
- [Source: _bmad-output/planning-artifacts/architecture.md#Error Handling Chain]
- [Source: _bmad-output/project-context.md#Security Requirements]
- [Source: _bmad-output/project-context.md#Error Handling Chain (BackendClient)]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: _bmad-output/implementation-artifacts/1-3-customer-registration-multi-provider-auth.md — Auth module implementation]
- [Source: src/libs/shared/port/port-http-client.service.ts — JWT injection point (line 72)]
- [Source: src/libs/shared/context/request-context.provider.ts — RequestContext with userId]
- [Source: src/modules/auth/infrastructure/better-auth/better-auth.setup.ts — Session management]
- [Source: src/modules/auth/infrastructure/http/auth.controller.ts — getAuthenticatedUserId() pattern]
- [Source: src/libs/core/constants/tokens.ts — DI token patterns]

## Dev Agent Record

### Agent Model Used

SM Agent (Scrum Master — Bob)

### Debug Log References

- jose ESM-only — required `transformIgnorePatterns` addition to jest config for tests to work

### Completion Notes List

- ✅ Task 1: JwtSignerService created — jose HS256 signing, 15-min TTL, dual-key verification for rotation
- ✅ Task 2: AuthPropagationMiddleware — extracts userId/roles/provider/sessionId from better-auth session → RequestContext.metadata
- ✅ Task 3: AuthPropagationModule — @Global module, exports JwtSignerService
- ✅ Task 4: PortHttpClient enhanced — JWT auto-injected when userId present, skipped for webhooks
- ✅ Task 5: 401 auto-retry — regenerates JWT and retries once, structured error on retry failure
- ✅ Task 6: AppModule load order — ContextModule → AuthModule → AuthPropagationModule → PortModule
- ✅ Task 7: RequestContext extended via metadata (roles, provider, sessionId) — no interface breaking change
- ✅ Task 8: 10 JWT signer + 16 middleware + 9 PortHttpClient JWT/401 tests (35 total for Story 1.4)

### File List

**New Files Created:**

- `src/libs/shared/auth-propagation/auth-propagation.interface.ts` — JwtPayload types (JwtSignerConfig removed in review)
- `src/libs/shared/auth-propagation/jwt-signer.service.ts` — jose JWT signing + dual-key verification
- `src/libs/shared/auth-propagation/auth-propagation.middleware.ts` — better-auth session → RequestContext enrichment
- `src/libs/shared/auth-propagation/auth-propagation.module.ts` — @Global NestJS module
- `src/libs/shared/auth-propagation/index.ts` — barrel export
- `src/libs/shared/auth-propagation/jwt-signer.service.spec.ts` — 10 tests
- `src/libs/shared/auth-propagation/auth-propagation.middleware.spec.ts` — 16 tests (code review)

**Modified Files:**

- `src/libs/shared/port/port-http-client.service.ts` — Added JWT injection + 401 auto-retry
- `src/libs/shared/port/port.module.ts` — Import AuthPropagationModule
- `src/libs/shared/port/port-http-client.service.spec.ts` — Added JWT injection + 401 retry tests (code review)
- `src/app.module.ts` — Import AuthPropagationModule, register AuthPropagationMiddleware
- `src/libs/core/common/context/request-context.interface.ts` — Added createFull() to IRequestContextProvider (code review)

## Change Log

- 2026-06-05: Story 1.4 implementation complete — JWT identity propagation layer with jose HS256, 15-min TTL, dual-key rotation, 401 auto-retry. 141 tests passing, 0 regressions.
- 2026-06-05: **Code Review (Amelia)** — Fixed 12 issues (3 Critical, 3 High, 4 Medium, 2 Low). Added `createFull()` to IRequestContextProvider interface. Fixed unsafe FastifyRequest casts in middleware. Added provider extraction from session. Added `implements NestMiddleware`. Removed dead JwtSignerConfig export. Wrote 25 new tests (16 middleware + 9 PortHttpClient JWT/401). 164 tests passing, 0 regressions. TS compilation clean for Story 1.4 files.
