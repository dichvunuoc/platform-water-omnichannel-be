# Story 7.3: Webhook Security Guards

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **platform security officer**,
I want every inbound webhook to be cryptographically verified before processing,
so that no unauthorized party can inject fake payment confirmations or ticket updates.

## Acceptance Criteria

### AC1: Zalo Webhook HMAC Verification (FR71)

**Given** a Zalo webhook arrives at `POST /webhooks/zalo/callback`
**When** the `ZaloSignatureGuard` processes the request
**Then** it computes HMAC SHA-256 of the **raw body** using `ZALOA_SECRET_KEY` env var
**And** compares the result with the `X-ZECA-Signature` header value using **timing-safe comparison** (`crypto.timingSafeEqual`)
**And** if mismatch → returns 403 Forbidden immediately with a security audit log entry
**And** if match → allows the request to proceed to the Zalo handler.

### AC2: Internal Webhook API Key Verification (FR72)

**Given** an internal webhook arrives (Payment IPN, Ticket status, Notification delivery)
**When** the `InterServiceApiKeyGuard` processes the request
**Then** it validates the `x-api-key` header against `INTER_SERVICE_API_KEY` env var
**And** this is a **static shared secret** — NOT JWT (per FR72: internal webhooks do not use JWT)
**And** uses **timing-safe comparison** (`crypto.timingSafeEqual`) to prevent timing attacks
**And** if mismatch → returns 403 Forbidden with security audit log
**And** if match → allows the request to proceed.

### AC3: Zero Unauthenticated Webhook Endpoints

**Given** both guards are implemented
**When** the application starts
**Then** every webhook controller (`webhooks/payment/*`, `webhooks/ticket/*`, `webhooks/zalo/*`) has the appropriate guard applied via NestJS `@UseGuards()` decorator
**And** this is enforced at the infrastructure layer — no handler code needs to check security manually.

### AC4: Raw Body Preservation for Zalo Endpoints

**Given** the ZaloSignatureGuard requires HMAC computation on the raw request body
**When** the NestJS + Fastify stack processes the request
**Then** `fastify-raw-body` is registered and configured to preserve `request.rawBody` for `/webhooks/zalo/*` endpoints
**And** the HMAC verification function **must** use `request.rawBody` — NOT the parsed JSON object
**And** this configuration is applied only to webhook endpoints, not globally — normal API endpoints continue using standard JSON parsing.

## Tasks / Subtasks

- [x] Task 1: Install and Configure fastify-raw-body (AC: #4)
  - [x] Install `fastify-raw-body` package
  - [x] Register in `src/main.ts` — `app.register(fastifyRawBody, { field: 'rawBody', global: false, encoding: 'utf8' })`
  - [x] Verify `request.rawBody` is available on webhook routes
  - [x] Verify normal API routes are unaffected

- [x] Task 2: Create ZaloSignatureGuard (AC: #1)
  - [x] Create `src/libs/shared/security/zalo-signature.guard.ts`
  - [x] Compute HMAC SHA-256 of `request.rawBody` using `ZALOA_SECRET_KEY`
  - [x] Compare with `X-ZECA-Signature` header using `crypto.timingSafeEqual`
  - [x] Return 403 Forbidden on mismatch with security audit log
  - [x] Handle missing rawBody, missing signature, missing secret edge cases
  - [x] Create `src/libs/shared/security/zalo-signature.guard.spec.ts`

- [x] Task 3: Fix InterServiceApiKeyGuard — Timing-Safe Comparison (AC: #2)
  - [x] Update `src/libs/shared/security/inter-service-api-key.guard.ts`
  - [x] Replace `apiKey !== expectedKey` with `crypto.timingSafeEqual`
  - [x] Add Buffer length check before timingSafeEqual (prevents crash on different-length strings)
  - [x] Update `src/libs/shared/security/inter-service-api-key.guard.spec.ts`

- [x] Task 4: Create Zalo Webhook Controller Stub (AC: #1, #3)
  - [x] Create `src/modules/communication/infrastructure/http/zalo-webhook.controller.ts`
  - [x] `@Controller('webhooks/zalo')` with `@UseGuards(ZaloSignatureGuard)`
  - [x] `@Public()` — bypasses SessionAuthGuard (like payment/ticket webhook controllers)
  - [x] `POST /webhooks/zalo/callback` — returns `{ received: true }` (message processing is Phase 2 input adapters)
  - [x] Validate rawBody is available in the guard context

- [x] Task 5: Register fastify-raw-body Route-Specific Configuration (AC: #4)
  - [x] Configure raw body for Zalo webhook routes ONLY
  - [x] Verify payment/ticket webhook routes continue to work with existing body parsing
  - [x] Update `src/main.ts` bootstrap

- [x] Task 6: Update Security Exports (AC: #3)
  - [x] Update `src/libs/shared/security/index.ts` — export `ZaloSignatureGuard`
  - [x] Update `CommunicationModule` — add `ZaloWebhookController` to controllers

- [x] Task 7: Write Comprehensive Tests (AC: all)
  - [x] `zalo-signature.guard.spec.ts` — valid signature, invalid signature, missing signature, missing rawBody, missing secret, tampered payload
  - [x] `inter-service-api-key.guard.spec.ts` — update existing tests for timing-safe comparison
  - [x] `zalo-webhook.controller.spec.ts` — guard integration, 200 on valid, 403 on invalid
  - [x] HMAC test vectors — verify with known secret + known payload = known HMAC
  - [x] Verify no unauthenticated webhook endpoints exist

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story is about **closing the security perimeter** on all inbound webhook endpoints. The good news: **half the work is already done.**

#### What ALREADY EXISTS — DO NOT RECREATE

| Component | Location | Status |
|-----------|----------|--------|
| **InterServiceApiKeyGuard** | `src/libs/shared/security/inter-service-api-key.guard.ts` | ✅ EXISTS — **FIX** timing-safe comparison |
| **Payment WebhookController** | `src/modules/payment/infrastructure/http/webhook.controller.ts` | ✅ EXISTS — already has `@UseGuards(InterServiceApiKeyGuard)` |
| **Ticket WebhookController** | `src/modules/ticket/infrastructure/http/ticket-webhook.controller.ts` | ✅ EXISTS — already has `@UseGuards(InterServiceApiKeyGuard)` |
| **@Public() decorator** | `src/modules/auth/infrastructure/decorators/public.decorator.ts` | ✅ EXISTS — bypasses SessionAuthGuard for webhooks |
| **Body parser disabled** | `src/main.ts` — `bodyParser: false` | ✅ EXISTS — comment says "webhook signature verification" |
| **Pino + pino-redact** | `src/libs/shared/logging/` | ✅ EXISTS — audit logs will use structured logging |
| **Security barrel export** | `src/libs/shared/security/index.ts` | ✅ EXISTS — UPDATE to add ZaloSignatureGuard |

#### What This Story CREATES

| Component | Purpose |
|-----------|---------|
| `ZaloSignatureGuard` | HMAC SHA-256 verification for Zalo inbound webhooks |
| `ZaloWebhookController` | Stub controller for `/webhooks/zalo/callback` — Phase 2 will add message processing |
| `fastify-raw-body` config | Preserve raw body for HMAC computation on Zalo routes |

#### What This Story FIXES

| Component | Issue | Fix |
|-----------|-------|-----|
| `InterServiceApiKeyGuard` | Uses `!==` comparison — vulnerable to timing attacks | Replace with `crypto.timingSafeEqual` |

### ⚡ Key Architecture Points

1. **Two different guards for two different sources** — Zalo uses HMAC SHA-256 (asymmetric-ish), internal services use static API key. These MUST NOT be mixed.
2. **`fastify-raw-body` is route-specific** — Register with `global: false`, then apply per-route. Normal API endpoints must NOT have rawBody overhead.
3. **Body parser already disabled globally** — `main.ts` has `bodyParser: false`. This means ALL routes get raw body access. `fastify-raw-body` adds structured `request.rawBody` field. The existing webhook controllers parse body manually via `@Body()` which works because NestJS adds its own body parser middleware.
4. **Zalo webhook controller is a STUB** — It verifies the signature and returns 200 OK. Actual message processing (intent resolution, command dispatch) is Phase 2 (input adapters). This story only ensures the endpoint exists and is secured.
5. **`crypto.timingSafeEqual` requires same-length Buffers** — If API key or HMAC signature lengths differ, must check length first and return false immediately (but DON'T reveal which length was expected).
6. **Security audit log entries** — When a guard rejects a request, log: IP, path, timestamp, reason. Use structured Pino logging with correlation ID if available.
7. **`@Public()` is required on ALL webhook controllers** — They receive calls from external services, not browser sessions. Must bypass global SessionAuthGuard.
8. **No changes to payment or ticket webhook handler logic** — Only guard-level changes (timing-safe comparison fix).

### 📁 File Structure — Changes

```
src/libs/shared/security/
├── zalo-signature.guard.ts                        ← NEW (AC#1)
├── zalo-signature.guard.spec.ts                   ← NEW
├── inter-service-api-key.guard.ts                 ← FIX (AC#2)
├── inter-service-api-key.guard.spec.ts            ← UPDATE (AC#2)
└── index.ts                                        ← UPDATE

src/modules/communication/
├── infrastructure/
│   ├── http/
│   │   ├── zalo-webhook.controller.ts             ← NEW (AC#1, #3)
│   │   └── zalo-webhook.controller.spec.ts        ← NEW
│   └── ...
└── communication.module.ts                        ← UPDATE (add ZaloWebhookController)

src/main.ts                                        ← UPDATE (fastify-raw-body registration)
```

### 🔧 Implementation Details

#### ZaloSignatureGuard
```typescript
// src/libs/shared/security/zalo-signature.guard.ts
import { CanActivate, ExecutionContext, Injectable, Logger, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class ZaloSignatureGuard implements CanActivate {
  private readonly logger = new Logger(ZaloSignatureGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // 1. Get raw body — MUST use rawBody, NOT parsed body
    const rawBody = request.rawBody;
    if (!rawBody) {
      this.logger.error('No rawBody — fastify-raw-body not configured for this route');
      throw new ForbiddenException('Request processing error');
    }

    // 2. Get expected secret from env
    const secret = process.env.ZALOA_SECRET_KEY;
    if (!secret) {
      this.logger.error('ZALOA_SECRET_KEY env var not configured — rejecting all Zalo webhooks');
      throw new ForbiddenException('Service configuration error');
    }

    // 3. Get signature from header
    const signature = request.headers['x-zeca-signature'];
    if (!signature || typeof signature !== 'string') {
      this.logger.warn(`Missing X-ZECA-Signature header from ${request.ip || 'unknown'}`);
      throw new ForbiddenException('Missing signature');
    }

    // 4. Compute HMAC SHA-256 on raw body
    const computed = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // 5. Timing-safe comparison
    if (!this.timingSafeEqual(computed, signature)) {
      this.logger.warn(
        `Zalo webhook signature mismatch from ${request.ip || 'unknown'}. Path: ${request.url}`,
      );
      throw new ForbiddenException('Invalid signature');
    }

    return true;
  }

  /**
   * Timing-safe string comparison.
   * Returns false if lengths differ (does NOT reveal which).
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
```

#### InterServiceApiKeyGuard — FIX
```typescript
// src/libs/shared/security/inter-service-api-key.guard.ts — UPDATED
import { CanActivate, ExecutionContext, Injectable, Logger, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class InterServiceApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InterServiceApiKeyGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const expectedKey = process.env.INTER_SERVICE_API_KEY;

    if (!expectedKey) {
      this.logger.error('INTER_SERVICE_API_KEY env var not configured — rejecting all webhook requests');
      throw new ForbiddenException('Service configuration error');
    }

    if (!apiKey || typeof apiKey !== 'string') {
      this.logger.warn(`Missing x-api-key header from ${request.ip || 'unknown'}. Path: ${request.url}`);
      throw new ForbiddenException('Invalid API key');
    }

    // Timing-safe comparison — prevents timing attacks
    if (apiKey.length !== expectedKey.length || !crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(expectedKey))) {
      this.logger.warn(`Invalid API key from ${request.ip || 'unknown'}. Path: ${request.url}`);
      throw new ForbiddenException('Invalid API key');
    }

    return true;
  }
}
```

#### Zalo Webhook Controller
```typescript
// src/modules/communication/infrastructure/http/zalo-webhook.controller.ts
/**
 * Zalo Webhook Controller
 *
 * Receives inbound Zalo OA webhook callbacks.
 * Guarded by ZaloSignatureGuard — HMAC SHA-256 verification (FR71).
 *
 * Phase 2: Input adapters will add message processing, intent resolution, and command dispatch.
 * This story only ensures the endpoint is secured and responds correctly.
 */

import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { ZaloSignatureGuard } from '@shared/security';
import { Public } from '@modules/auth/infrastructure/decorators/public.decorator';

@Public()
@ApiTags('Webhooks — Zalo')
@Controller('webhooks/zalo')
@UseGuards(ZaloSignatureGuard) // AC#1: HMAC SHA-256 verification (FR71)
export class ZaloWebhookController {

  /**
   * POST /webhooks/zalo/callback
   * Zalo OA webhook callback (AC#1)
   *
   * Phase 2: Will process messages, resolve intent, dispatch commands.
   * This story: Verify signature, acknowledge receipt.
   */
  @Post('callback')
  @ApiOperation({ summary: 'Zalo OA webhook callback' })
  @ApiHeader({ name: 'X-ZECA-Signature', description: 'Zalo HMAC SHA-256 signature' })
  async handleZaloCallback(@Body() body: Record<string, unknown>) {
    // Phase 2 input adapter will process the message payload here
    // This story only ensures the endpoint is secured
    return { received: true };
  }
}
```

#### main.ts — fastify-raw-body Registration
```typescript
// In src/main.ts — ADD after app creation:
import fastifyRawBody from 'fastify-raw-body';

// After app = await NestFactory.create(...)
// Register raw body for webhook signature verification
await app.register(fastifyRawBody, {
  field: 'rawBody',
  global: false,
  encoding: 'utf8',
});
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Use `!==` for API key comparison | Use `crypto.timingSafeEqual` — prevents timing attacks |
| Compute HMAC on `request.body` (parsed JSON) | Use `request.rawBody` — parsed JSON may have whitespace/field-order changes |
| Register `fastify-raw-body` globally | Use `global: false` — only webhook routes need raw body |
| Put Zalo HMAC logic in controller handler | Put in guard — NestJS runs guards BEFORE handlers |
| Mix ZaloSignatureGuard with InterServiceApiKeyGuard | Each guard handles ONE authentication method. Controllers use ONE guard. |
| Skip the Zalo webhook controller because it's "just a stub" | Create the secured endpoint now — prevents unauthenticated route gap |
| Log the computed HMAC value | Only log mismatch warnings — never log secrets or signatures in production |
| Apply both guards to a single controller | One guard per controller: Zalo → ZaloSignatureGuard, Internal → InterServiceApiKeyGuard |

### 🧪 Testing Requirements

1. **ZaloSignatureGuard — valid signature** — Compute correct HMAC → guard returns true
2. **ZaloSignatureGuard — invalid signature** — Wrong secret → 403 Forbidden
3. **ZaloSignatureGuard — tampered payload** — Signature valid for original payload, body modified → 403
4. **ZaloSignatureGuard — missing signature header** → 403 Forbidden
5. **ZaloSignatureGuard — missing rawBody** → 403 (configuration error)
6. **ZaloSignatureGuard — missing env var** → 403 (configuration error)
7. **InterServiceApiKeyGuard — valid key** — Correct key → guard returns true
8. **InterServiceApiKeyGuard — invalid key** → 403 Forbidden
9. **InterServiceApiKeyGuard — missing key** → 403 Forbidden
10. **InterServiceApiKeyGuard — different-length key** → 403 (no length leak)
11. **ZaloWebhookController — valid request** → 200 `{ received: true }`
12. **ZaloWebhookController — invalid signature** → 403 (guard blocks before handler)
13. **HMAC test vectors** — Known secret + known payload = expected HMAC (verify with openssl)
14. **Verify all webhook endpoints have guards** — Payment, Ticket, Zalo — no unauthenticated endpoints

### Previous Story Learnings (Stories 1.1–7.2 — MUST Apply)

- **Guard pattern**: NestJS guards implement `CanActivate` — return boolean or throw
- **`@UseGuards()` at controller level** — Applies to ALL routes in the controller
- **`@Public()` on webhook controllers** — Bypasses global SessionAuthGuard
- **`@Shared` barrel exports** — Update `src/libs/shared/security/index.ts`
- **Module registration** — Add `ZaloWebhookController` to `CommunicationModule`
- **Error handling**: Throw `ForbiddenException` — NestJS auto-converts to 403 response
- **Structured logging**: Use Pino `Logger` — not `console.log`
- **`request.headers` is lowercase** in Fastify — `request.headers['x-zeca-signature']` not `request.headers['X-ZECA-Signature']`

### 📋 Cross-Story Context

**Depends on (complete or in-progress):**
- Stories 1.1–1.4 (Auth, @Public decorator, SessionAuthGuard)
- Stories 6.1–6.3 (CommunicationModule — where Zalo webhook controller will live)
- Stories 4.1–4.5 (Payment webhook — already using InterServiceApiKeyGuard)
- Stories 5.1–5.4 (Ticket webhook — already using InterServiceApiKeyGuard)
- Story 7.1 (SessionModule — RecordSessionEventCommand for future Zalo event recording)

**Enables (future stories):**
- Phase 2 Input Adapters — Zalo message processing on secured foundation
- Notification delivery webhook (`POST /webhooks/notification/delivery`) — will use InterServiceApiKeyGuard
- Production deployment — all webhooks cryptographically verified

**This is the LAST story in Epic 7.** After completion, the SM should run `*ER` (Epic Retrospective).

### Project Structure Notes

- `ZaloSignatureGuard` goes in `src/libs/shared/security/` — it's a shared security concern, not communication-module-specific
- `ZaloWebhookController` goes in communication module — it's the entry point for Zalo channel
- `fastify-raw-body` registration in `main.ts` — app-level configuration
- No new ports or adapters — guards are infrastructure-layer security

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3: Webhook Security Guards]
- [Source: _bmad-output/planning-artifacts/architecture.md#Webhook Security section]
- [Source: _bmad-output/planning-artifacts/architecture.md#Webhook Routing]
- [Source: _bmad-output/planning-artifacts/prd.md#FR71-FR72 (Webhook Security)]
- [Source: _bmad-output/project-context.md#Webhook Security Guards]
- [Source: _bmad-output/project-context.md#Session Atomicity (Redis)]
- [Source: _bmad-output/implementation-artifacts/prep-epic7/fastify-raw-body-hmac-setup.md]
- [Source: src/libs/shared/security/inter-service-api-key.guard.ts — existing guard to fix]
- [Source: src/modules/payment/infrastructure/http/webhook.controller.ts — pattern reference]
- [Source: src/modules/ticket/infrastructure/http/ticket-webhook.controller.ts — pattern reference]
- [Source: src/main.ts — bodyParser: false already set]

## Dev Agent Record

### Agent Model Used

Claude (glm-5[1m])

### Debug Log References

- All 7 tasks completed in single session without HALT
- Full test suite: 112 suites, 1072 tests — ALL GREEN
- Zero regressions introduced

### Completion Notes List

- ✅ Task 1: Installed fastify-raw-body@5.0.0 — registered in main.ts with global: false, encoding: utf8
- ✅ Task 2: Created ZaloSignatureGuard — HMAC SHA-256 of rawBody, timing-safe comparison via crypto.timingSafeEqual, security audit logging on all rejection paths
- ✅ Task 3: Fixed InterServiceApiKeyGuard — replaced `!==` with crypto.timingSafeEqual, added Buffer length check to prevent crash on different-length keys
- ✅ Task 4: Created ZaloWebhookController — POST /webhooks/zalo/callback, @UseGuards(ZaloSignatureGuard), @Public(), returns { received: true }
- ✅ Task 5: Registered fastify-raw-body in main.ts — route-specific (global: false), preserves rawBody for Zalo endpoints only
- ✅ Task 6: Updated security barrel export + CommunicationModule — ZaloSignatureGuard exported, ZaloWebhookController registered
- ✅ Task 7: Created 3 test suites (zalo-signature.guard, inter-service-api-key.guard, zalo-webhook.controller) — 24 new tests covering valid/invalid signatures, timing-safe comparison, missing headers/env vars, tampered payloads

### File List

**NEW files:**
- `src/libs/shared/security/zalo-signature.guard.ts`
- `src/libs/shared/security/zalo-signature.guard.spec.ts`
- `src/modules/communication/infrastructure/http/zalo-webhook.controller.ts`
- `src/modules/communication/infrastructure/http/zalo-webhook.controller.spec.ts`

**MODIFIED files:**
- `src/libs/shared/security/inter-service-api-key.guard.ts` — replaced `!==` with crypto.timingSafeEqual + Buffer length check
- `src/libs/shared/security/inter-service-api-key.guard.spec.ts` — added timing-safe comparison tests
- `src/libs/shared/security/index.ts` — added ZaloSignatureGuard export
- `src/modules/communication/communication.module.ts` — added ZaloWebhookController
- `src/main.ts` — registered fastify-raw-body with global: false
