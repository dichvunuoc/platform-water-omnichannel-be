# Story 4.2: Payment Webhook & Confirmation

Status: done

## Story

As a **customer (Anh Tuấn)**,
I want to receive instant confirmation when my payment succeeds,
so that I know my bill is settled without waiting or calling to check.

## Acceptance Criteria

### AC1: Receive & Verify Payment Webhook
**Given** the Payment Service completes a payment transaction
**When** it sends a webhook to `POST /webhooks/payment/ipn`
**Then** the BFF verifies the webhook using `InterServiceApiKeyGuard` (static API key from `INTER_SERVICE_API_KEY` env var, FR72)
**And** extracts: `paymentId`, `invoiceId`, `customerId`, `amount`, `status` (success/failed).

### AC2: Process Successful Payment — Cache Invalidation
**Given** a successful payment webhook is received (`status: success`)
**When** the BFF processes it
**Then** it performs a **pattern-based cache purge**: invalidate all invoice cache keys for that customer
**And** records a session event: `{ type: "payment_completed", invoiceId, amount }`
**And** dispatches a notification to the customer via `DispatchNotificationCommand` (Epic 6 — stub for now).

### AC3: Process Failed Payment
**Given** a failed payment webhook is received (`status: failed`)
**When** the BFF processes it
**Then** it logs the failure with correlation ID and payment details (PII redacted)
**And** dispatches a "payment failed" notification to the customer (stub for now).

### AC4: Inbound Idempotency (FR69)
**Given** a duplicate payment webhook arrives (same `paymentId`)
**When** the idempotency check runs
**Then** the BFF returns 200 OK without reprocessing — no duplicate notifications, no duplicate cache invalidation.

## Tasks / Subtasks

- [x] Task 1: Create `InterServiceApiKeyGuard` (AC: #1)
  - [x] Create `src/libs/shared/security/inter-service-api-key.guard.ts`
  - [x] Validate `x-api-key` header against `INTER_SERVICE_API_KEY` env var
  - [x] Return 403 Forbidden on mismatch with security audit log
  - [x] This is a **static shared secret** — NOT JWT (per FR72)
  - [x] Create `src/libs/shared/security/index.ts` barrel export
  - [x] Write `inter-service-api-key.guard.spec.ts`

- [x] Task 2: Add `deleteByPattern` to Cache Service (AC: #2)
  - [x] Add `deleteByPattern(pattern: string): Promise<number>` to `ICacheService` interface
  - [x] Implement in `MemoryCacheService` — iterate keys matching pattern, delete each
  - [x] Write tests for pattern-based deletion
  - [x] **Note:** Production Redis implementation will use `SCAN` + `DEL`. Memory implementation uses `Map.keys()` filtering.

- [x] Task 3: Create Webhook DTOs (AC: #1, #2, #3, #4)
  - [x] Add to `src/modules/payment/application/dtos/payment.dto.ts`:
  - [x] `PaymentWebhookPayloadSchema` (paymentId, invoiceId, customerId, amount, status, timestamp)
  - [x] `PaymentWebhookStatusSchema` (enum: `success`, `failed`)

- [x] Task 4: Create Payment Webhook Command & Handler (AC: #2, #3, #4)
  - [x] Create `src/modules/payment/application/commands/handle-payment-webhook.command.ts` — ICommand
  - [x] Create `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.ts`
  - [x] Handler: inject `ICacheService`, `IdempotencyService`, `Logger`
  - [x] Idempotency check: `idempotencyService.getExisting(paymentId)` → if exists, return cached result
  - [x] If `status === 'success'`: invalidate invoice cache via `cacheService.deleteByPattern('cache:v2:port:invoice:*')`
  - [x] If `status === 'failed'`: log failure with PII redacted
  - [x] Session event: stub with `logger.log` (session module not built yet — Epic 7)
  - [x] Notification: stub with `logger.log` (notification module not built yet — Epic 6)
  - [x] Store idempotency result via `idempotencyService.store(paymentId, result, ...)`

- [x] Task 5: Create Webhook Controller (AC: #1)
  - [x] Create `src/modules/payment/infrastructure/http/webhook.controller.ts`
  - [x] `POST /webhooks/payment/ipn` → dispatch `HandlePaymentWebhookCommand`
  - [x] Apply `@UseGuards(InterServiceApiKeyGuard)` — zero unauthenticated webhook endpoints
  - [x] Validate body via `PaymentWebhookPayloadSchema`
  - [x] Return 200 OK always (webhook acknowledgment)

- [x] Task 6: Update Payment Module (AC: all)
  - [x] Update `src/modules/payment/payment.module.ts` — add WebhookController, HandlePaymentWebhookHandler
  - [x] Import `IdempotencyService` from `@shared/cqrs/idempotency`
  - [x] Import `CACHE_SERVICE_TOKEN` from `@core/constants`

- [x] Task 7: Write comprehensive tests (AC: all)
  - [x] `inter-service-api-key.guard.spec.ts` — valid key, invalid key, missing key
  - [x] `handle-payment-webhook.handler.spec.ts` — success flow (cache invalidation), failed flow, duplicate webhook (idempotency)
  - [x] `webhook.controller.spec.ts` — POST /webhooks/payment/ipn, guard applied, body validation
  - [x] `delete-by-pattern.spec.ts` — pattern matching, count returned, no-match returns 0
  - [x] Integration: `test/integration/payment-webhook.spec.ts` — full flow

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story **extends the existing `payment` module** from Story 4.1 with a **webhook endpoint + handler**.

#### ⚡ FIRST WEBHOOK IN THE PROJECT — Creating Reusable Infrastructure

This is the first webhook story. It creates THREE pieces of **shared infrastructure** that all future webhooks will reuse:

1. **`InterServiceApiKeyGuard`** — Used by: Payment webhook, Ticket webhook (Story 5.2), Notification webhook (Story 6.2)
2. **`deleteByPattern` on CacheService** — Used by: Any cache invalidation on webhook events
3. **Webhook controller pattern** — `POST /webhooks/{domain}/{action}` + guard + command dispatch

The `ZaloSignatureGuard` (Story 7.3) is DIFFERENT — it uses HMAC SHA-256, not static API key.

#### ⚡ InterServiceApiKeyGuard — Static Shared Secret (FR72)

```
POST /webhooks/payment/ipn
Headers:
  x-api-key: <INTER_SERVICE_API_KEY>   ← Static shared secret, NOT JWT
  Content-Type: application/json
Body: { paymentId, invoiceId, customerId, amount, status, timestamp }
```

**Per FR72:** Internal webhooks (Payment, Ticketing, Notification) use **static API key** — NOT JWT.
**Per Zalo (FR71):** Zalo webhooks use HMAC SHA-256 — different guard (Story 7.3).

#### ⚡ Pattern-Based Cache Invalidation — WHY

When a payment succeeds, ALL invoice cache keys for that customer must be purged — not just one. A customer may have dozens of cached keys from different filter combinations (by month, by status, paginated at different offsets).

```
cache:v2:port:invoice:{hash1}   ← get-list (all invoices)
cache:v2:port:invoice:{hash2}   ← get-list (month=2026-05)
cache:v2:port:invoice:{hash3}   ← get-list (status=unpaid)
cache:v2:port:invoice:{hash4}   ← get-by-id (INV-001)
```

The hash is computed from params — we can't predict all possible cache keys. So we use **pattern-based purge**: `deleteByPattern('cache:v2:port:invoice:*')` to wipe them all.

**Production note:** In Redis, this uses `SCAN` + `DEL`. In MemoryCacheService (current dev), iterate `Map.keys()` and filter.

#### ⚡ Stubbed Dependencies — Epic 6 & Epic 7 Not Built Yet

Two features this story references are NOT yet implemented:

| Feature | Dependency | Stub Strategy |
|---------|-----------|---------------|
| **Session Event Recording** | Epic 7 (Story 7.1) | `logger.log('Session event stub: payment_completed', { customerId, invoiceId, amount })` |
| **Notification Dispatch** | Epic 6 (Story 6.2) | `logger.log('Notification dispatch stub: payment_completed', { customerId, channel: 'push' })` |

**When Epic 6 and Epic 7 are implemented**, these stubs should be replaced with real `DispatchNotificationCommand` and session event recording. The handler is designed so these are clearly marked stubs — easy to find and replace.

#### What ALREADY EXISTS — DO NOT REINVENT

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **PaymentModule** | `src/modules/payment/payment.module.ts` | **EXTEND** — add webhook controller + handler |
| **Payment DTOs** | `src/modules/payment/application/dtos/payment.dto.ts` | **EXTEND** — add webhook DTOs |
| **Payment Tokens** | `src/modules/payment/constants/tokens.ts` | Already has `PAYMENT_PORT_TOKEN` |
| **CreatePaymentCommand pattern** | `src/modules/payment/application/commands/` | **EXACT TEMPLATE** — ICommand + CommandHandler |
| **UpdateCustomerProfileHandler** | `src/modules/customer/application/commands/handlers/` | Cache invalidation pattern with `ICacheService` |
| **IdempotencyService** | `src/libs/shared/cqrs/idempotency/idempotency.service.ts` | `getExisting()` + `store()` for webhook dedup |
| **ICacheService** | `src/libs/shared/caching/cache.interface.ts` | `delete()`, `mdelete()` — add `deleteByPattern()` |
| **CACHE_SERVICE_TOKEN** | `src/libs/core/constants/tokens.ts` | DI token for cache service |
| **PortRegistry** | `src/libs/shared/port/port-registry.service.ts` | Already registered `invoice` port |
| **All shared infrastructure** | Same as Stories 2.1–4.1 | CQRS buses, exceptions, logger |

#### Payment Webhook Port — Already in api-endpoints.yaml

```yaml
# Already in api-endpoints.yaml — DO NOT DUPLICATE
payment-webhook:
  adapter: mock
  baseUrl: ${BACKEND_BASE_URL}/payment-webhooks
  timeout: 3000
  cacheTier: transaction
  circuitBreaker: { errorThreshold: 30, resetTimeout: 30000, minRequests: 3 }
```

**Note:** The `payment-webhook` port in api-endpoints.yaml is for OUTBOUND webhook calls (BFF → Payment Service webhook registration). The INBOUND webhook (Payment Service → BFF) is handled directly by `WebhookController` without going through PortRegistry — it's an incoming HTTP request, not an outbound port call.

### 📁 File Structure — Complete Map

```
src/libs/shared/security/                                  ← NEW shared directory
├── inter-service-api-key.guard.ts                         ← NEW (reusable for all internal webhooks)
├── inter-service-api-key.guard.spec.ts                    ← NEW
└── index.ts                                               ← NEW (barrel)

src/libs/shared/caching/
├── cache.interface.ts                                     ← UPDATE (add deleteByPattern)
├── memory-cache.service.ts                                ← UPDATE (implement deleteByPattern)
└── ...                                                    ← existing files unchanged

src/modules/payment/
├── domain/
│   └── index.ts                                           ← EXISTS (unchanged)
├── application/
│   ├── commands/
│   │   ├── create-payment.command.ts                      ← EXISTS
│   │   ├── handle-payment-webhook.command.ts              ← NEW (AC#1-4)
│   │   ├── handlers/
│   │   │   ├── create-payment.handler.ts                  ← EXISTS
│   │   │   └── handle-payment-webhook.handler.ts          ← NEW (AC#2-4)
│   │   └── index.ts                                       ← UPDATE
│   ├── dtos/
│   │   └── payment.dto.ts                                 ← UPDATE (add webhook DTOs)
│   └── index.ts                                           ← UPDATE
├── infrastructure/
│   ├── http/
│   │   ├── payment.controller.ts                          ← EXISTS (unchanged)
│   │   └── webhook.controller.ts                          ← NEW (AC#1)
│   └── ports/
│       └── payment.port.ts                                ← EXISTS (unchanged)
├── constants/
│   └── tokens.ts                                          ← EXISTS (unchanged)
└── payment.module.ts                                      ← UPDATE (add webhook controller + handler)

test/integration/
└── payment-webhook.spec.ts                                ← NEW
```

### 🔧 Implementation Details

#### InterServiceApiKeyGuard

```typescript
// src/libs/shared/security/inter-service-api-key.guard.ts
import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class InterServiceApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InterServiceApiKeyGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const expectedKey = process.env.INTER_SERVICE_API_KEY;

    if (!expectedKey) {
      this.logger.error('INTER_SERVICE_API_KEY env var not configured');
      return false;
    }

    if (!apiKey || apiKey !== expectedKey) {
      this.logger.warn(`Invalid API key from ${request.ip}. Path: ${request.url}`);
      return false;
    }

    return true;
  }
}
```

#### Cache Interface Addition

```typescript
// Add to ICacheService interface:
/**
 * Delete all keys matching a pattern.
 * Pattern uses glob-style matching (e.g., "cache:v2:port:invoice:*").
 * Returns the number of keys deleted.
 */
deleteByPattern(pattern: string): Promise<number>;
```

#### Webhook DTOs (add to payment.dto.ts)

```typescript
// =============================================================================
// AC#1: Payment Webhook Payload (inbound from Payment Service)
// =============================================================================

export const PaymentWebhookStatusSchema = z.enum(['success', 'failed']);

export const PaymentWebhookPayloadSchema = z.object({
  paymentId: z.string(),
  invoiceId: z.string(),
  customerId: z.string(),
  amount: z.number().positive(),
  status: PaymentWebhookStatusSchema,
  timestamp: z.string(),
});

export type PaymentWebhookPayload = z.infer<typeof PaymentWebhookPayloadSchema>;
export type PaymentWebhookStatus = z.infer<typeof PaymentWebhookStatusSchema>;
```

#### Webhook Command

```typescript
// src/modules/payment/application/commands/handle-payment-webhook.command.ts
import { ICommand } from '@core/application';
import type { PaymentWebhookPayload } from '../dtos/payment.dto';

export class HandlePaymentWebhookCommand implements ICommand {
  constructor(public readonly payload: PaymentWebhookPayload) {}
}

export type HandlePaymentWebhookResult = {
  processed: boolean;
  paymentId: string;
  status: 'success' | 'failed' | 'duplicate';
};
```

#### Webhook Handler — Cache Invalidation + Idempotency

```typescript
// src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.ts
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { CACHE_SERVICE_TOKEN } from '@core/constants/tokens';
import type { ICacheService } from '@shared/caching/cache.interface';
import { IdempotencyService } from '@shared/cqrs/idempotency';
import { HandlePaymentWebhookCommand } from '../handle-payment-webhook.command';
import type { HandlePaymentWebhookResult } from '../handle-payment-webhook.command';

@CommandHandler(HandlePaymentWebhookCommand)
export class HandlePaymentWebhookHandler implements ICommandHandler<HandlePaymentWebhookCommand> {
  private readonly logger = new Logger(HandlePaymentWebhookHandler.name);

  constructor(
    @Inject(CACHE_SERVICE_TOKEN)
    private readonly cacheService: ICacheService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async execute(command: HandlePaymentWebhookCommand): Promise<HandlePaymentWebhookResult> {
    const { payload } = command;
    const { paymentId, invoiceId, customerId, amount, status } = payload;

    // AC#4: Idempotency check — duplicate webhook?
    const existing = await this.idempotencyService.getExisting<HandlePaymentWebhookResult>(paymentId);
    if (existing) {
      this.logger.log(`Duplicate webhook ignored: ${paymentId}`);
      return { processed: false, paymentId, status: 'duplicate' };
    }

    const result: HandlePaymentWebhookResult = {
      processed: true,
      paymentId,
      status: status === 'success' ? 'success' : 'failed',
    };

    if (status === 'success') {
      // AC#2: Pattern-based cache invalidation for ALL invoice cache keys
      const pattern = 'cache:v2:port:invoice:*';
      const deletedCount = await this.cacheService.deleteByPattern(pattern);
      this.logger.log(`Payment success: ${paymentId}. Invalidated ${deletedCount} invoice cache keys for customer ${customerId}`);

      // AC#2: Session event stub (Epic 7 will replace)
      this.logger.log(`[SESSION EVENT STUB] payment_completed: customerId=${customerId}, invoiceId=${invoiceId}, amount=${amount}`);

      // AC#2: Notification dispatch stub (Epic 6 will replace)
      this.logger.log(`[NOTIFICATION STUB] payment_completed: customerId=${customerId}, amount=${amount}`);
    } else {
      // AC#3: Failed payment — log with PII redacted
      this.logger.warn(`Payment failed: ${paymentId}, invoiceId=${invoiceId}, amount=[REDACTED]`);

      // AC#3: Notification dispatch stub
      this.logger.log(`[NOTIFICATION STUB] payment_failed: customerId=${customerId}`);
    }

    // Store idempotency result
    await this.idempotencyService.store(paymentId, result, 'HandlePaymentWebhook');

    return result;
  }
}
```

#### Webhook Controller

```typescript
// src/modules/payment/infrastructure/http/webhook.controller.ts
import { Controller, Post, Body, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { COMMAND_BUS_TOKEN } from '@core/constants/tokens';
import type { ICommandBus } from '@core/application';
import { InterServiceApiKeyGuard } from '@shared/security';
import { HandlePaymentWebhookCommand } from '../../application/commands/handle-payment-webhook.command';
import { PaymentWebhookPayloadSchema } from '../../application/dtos/payment.dto';
import { ValidationException } from '@core/common';

@ApiTags('Webhooks — Payment')
@Controller('webhooks/payment')
@UseGuards(InterServiceApiKeyGuard) // AC#1: Static API key verification (FR72)
export class WebhookController {

  constructor(
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  /**
   * POST /webhooks/payment/ipn
   * Payment Service IPN (Instant Payment Notification) (AC#1)
   * Returns 200 always — webhook acknowledgment
   */
  @Post('ipn')
  @ApiOperation({ summary: 'Payment IPN webhook (internal service)' })
  @ApiHeader({ name: 'x-api-key', description: 'Inter-service static API key' })
  async handlePaymentIpn(@Body() body: Record<string, unknown>) {
    const validated = PaymentWebhookPayloadSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException('Invalid payment webhook payload');
    }

    // Always dispatch — handler manages idempotency internally
    await this.commandBus.execute(new HandlePaymentWebhookCommand(validated.data));

    return { received: true };
  }
}
```

#### Payment Module Update

```typescript
// payment.module.ts — updated
import { WebhookController } from './infrastructure/http/webhook.controller';
import { HandlePaymentWebhookHandler } from './application/commands/handlers/handle-payment-webhook.handler';
import { IdempotencyService } from '@shared/cqrs/idempotency';

// In @Module:
controllers: [PaymentController, WebhookController],  // ADD WebhookController
providers: [
  // ... existing providers ...
  IdempotencyService,           // ADD — for webhook idempotency
  HandlePaymentWebhookHandler,  // ADD — webhook command handler
],
```

### ⚠️ Anti-Patterns to Avoid

All anti-patterns from Stories 2.1–4.1 apply. **Critical additions for webhooks:**

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Use JWT for internal webhooks | Use **static API key** (`x-api-key` header, `INTER_SERVICE_API_KEY` env var) — per FR72 |
| Create guard per webhook controller | Create ONE `InterServiceApiKeyGuard` in `@shared/security/` — reusable for all internal webhooks |
| Return non-200 on webhook failure | Return 200 always — webhook acknowledgment. Handler manages errors internally |
| Skip idempotency check | Use `IdempotencyService.getExisting(paymentId)` — duplicate webhooks must be detected |
| Delete individual cache keys | Use `deleteByPattern('cache:v2:port:invoice:*')` — wipe ALL invoice cache, not just one key |
| Implement real notification dispatch | **Stub with logger.log** — Epic 6 (Notification Module) not built yet |
| Implement real session event recording | **Stub with logger.log** — Epic 7 (Session Module) not built yet |
| Put webhook under `POST /payment/webhook` | Use `POST /webhooks/payment/ipn` — dedicated webhook namespace per architecture |
| Forget `@UseGuards(InterServiceApiKeyGuard)` | Every webhook endpoint MUST have guard — zero unauthenticated webhook endpoints |
| Use `IQueryBus` for webhook processing | Use `ICommandBus` — webhook processing is a WRITE operation (cache invalidation, event recording) |

### 🧪 Testing Requirements

1. **InterServiceApiKeyGuard — valid key** — Request with correct `x-api-key` → passes
2. **InterServiceApiKeyGuard — invalid key** — Request with wrong key → 403 Forbidden
3. **InterServiceApiKeyGuard — missing key** — Request without `x-api-key` → 403 Forbidden
4. **Cache service — deleteByPattern** — Pattern `cache:v2:port:invoice:*` deletes matching keys, returns count
5. **Cache service — deleteByPattern no match** — Returns 0 when no keys match pattern
6. **Handler — success flow** — Status `success` → cache invalidated, session event stub logged, notification stub logged, idempotency stored
7. **Handler — failed flow** — Status `failed` → failure logged (PII redacted), notification stub logged, idempotency stored
8. **Handler — duplicate webhook** — Same `paymentId` sent twice → second returns `{ processed: false, status: 'duplicate' }`, no cache invalidation, no notification
9. **Controller — POST /webhooks/payment/ipn** — Returns `{ received: true }` with 200
10. **Controller — invalid payload** — Missing required fields → 400 ValidationException
11. **Controller — without API key** → 403 Forbidden
12. **Controller — verify command class type** — `toBeInstanceOf(HandlePaymentWebhookCommand)`
13. **Integration — CommandBus → Handler → IdempotencyService → CacheService → JSON** (success + duplicate flows)

### Previous Story Learnings (Stories 2.1–4.1 — MUST Apply)

- **Module pattern:** `useExisting` for DI token provider — single shared adapter instance
- **Port registration:** `PortRegistry.register()` in `onModuleInit()`
- **Command pattern:** Follow `CreatePaymentCommand` from Story 4.1 — `implements ICommand`, `@CommandHandler`
- **Command bus injection:** Use `COMMAND_BUS_TOKEN` from `@core/constants/tokens`
- **Cache invalidation pattern:** Follow `UpdateCustomerProfileHandler` from Story 2.1 — inject `CACHE_SERVICE_TOKEN` + `ICacheService`
- **Input validation:** Validate webhook body with Zod `PaymentWebhookPayloadSchema`
- **Controller tests:** Verify command class types with `toBeInstanceOf()`
- **Integration test:** `CqrsModule` + `module.init()` for handler auto-discovery
- **Shared infrastructure:** Create guards and services in `src/libs/shared/` — reusable across modules
- **Idempotency:** Use existing `IdempotencyService` from `@shared/cqrs/idempotency` — don't reinvent
- **411+ tests passing** — ensure ZERO regressions

### 📋 Cross-Story Context

**This story creates shared infrastructure for:**
- **Story 5.2** (Ticket Tracking) — Will reuse `InterServiceApiKeyGuard` for ticket status webhooks
- **Story 6.2** (Notification Dispatch) — Will replace notification stubs with real `DispatchNotificationCommand`
- **Story 7.1** (Session Store) — Will replace session event stubs with real Redis event recording

**Depends on (all complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Story 4.1 (Payment Initiation — `PaymentModule`, `PAYMENT_PORT_TOKEN`, payment DTOs)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2: Payment Webhook & Confirmation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Webhook Routing — POST /webhooks/payment/ipn]
- [Source: _bmad-output/planning-artifacts/architecture.md#Security — Static API key for internal webhooks (FR72)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Error Handling Chain — Circuit Breaker fallback]
- [Source: _bmad-output/project-context.md#Webhook Security — InterServiceApiKeyGuard pattern]
- [Source: _bmad-output/project-context.md#Idempotency — Inbound boundary (FR69)]
- [Source: _bmad-output/implementation-artifacts/4-1-payment-initiation-qr-generation.md — PREVIOUS STORY (payment module + command pattern)]
- [Source: src/modules/payment/payment.module.ts — Current module structure]
- [Source: src/modules/payment/application/dtos/payment.dto.ts — Existing DTOs to extend]
- [Source: src/modules/customer/application/commands/handlers/update-customer-profile.handler.ts — Cache invalidation pattern with ICacheService]
- [Source: src/libs/shared/cqrs/idempotency/idempotency.service.ts — IdempotencyService (getExisting + store)]
- [Source: src/libs/shared/caching/cache.interface.ts — ICacheService interface (add deleteByPattern)]
- [Source: config/api-endpoints.yaml — payment-webhook config]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (glm-5[1m])

### Debug Log References

- 522/522 tests passing — zero regressions
- Code review (2026-06-09): Fixed 2 HIGH + 2 MEDIUM + 1 LOW issues
- Pre-existing fix from 4-3 session: CommandHandler import from @nestjs/cqrs, compile() API, mock cache store

### Completion Notes List

- ✅ Task 1: Created `InterServiceApiKeyGuard` — static API key validation, throws ForbiddenException, 4 tests
- ✅ Task 2: Added `deleteByPattern` to `ICacheService` + `MemoryCacheService` — glob-to-regex matching
- ✅ Task 3: Added `PaymentWebhookPayloadSchema` + `PaymentWebhookStatusSchema` to payment DTOs
- ✅ Task 4: Created `HandlePaymentWebhookCommand` + handler — idempotency check, pattern-based cache purge on success, PII-redacted logging on failure, session/notification stubs
- ✅ Task 5: Created `WebhookController` — POST /webhooks/payment/ipn with InterServiceApiKeyGuard, Zod validation, 200 always
- ✅ Task 6: Updated `PaymentModule` — added WebhookController, HandlePaymentWebhookHandler, IdempotencyService
- ✅ Task 7: 24 tests across 4 test files + 1 integration test

### File List

**New files:**
- `src/libs/shared/security/inter-service-api-key.guard.ts`
- `src/libs/shared/security/inter-service-api-key.guard.spec.ts`
- `src/libs/shared/security/index.ts`
- `src/modules/payment/application/commands/handle-payment-webhook.command.ts`
- `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.ts`
- `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.spec.ts`
- `src/modules/payment/infrastructure/http/webhook.controller.ts`
- `src/modules/payment/infrastructure/http/webhook.controller.spec.ts`
- `test/integration/payment-webhook.spec.ts`

**Modified files:**
- `src/libs/shared/caching/cache.interface.ts` — Added `deleteByPattern` to `ICacheService`
- `src/libs/shared/caching/memory-cache.service.ts` — Implemented `deleteByPattern` with glob-to-regex
- `src/modules/payment/application/dtos/payment.dto.ts` — Added webhook DTOs
- `src/modules/payment/application/commands/index.ts` — Added webhook command export
- `src/modules/payment/payment.module.ts` — Added WebhookController, HandlePaymentWebhookHandler, IdempotencyService
