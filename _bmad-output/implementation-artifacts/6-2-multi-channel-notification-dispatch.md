# Story 6.2: Multi-Channel Notification Dispatch

Status: review

## Story

As a **customer (Anh Tuấn)**,
I want to receive timely notifications through my preferred channels without being spammed,
so that I stay informed but not annoyed.

## Acceptance Criteria

### AC1: Rate Limiter Funnel (FR55)
**Given** any module dispatches a `DispatchNotificationCommand`
**When** the `DispatchNotificationHandler` evaluates the rate limiter
**Then** it checks: `Redis INCR ratelimit:notification:{userId}:{date}` for the target channel
**And** if `isCritical: true` (payment confirmation, water cutoff, widespread incident) → **Channel Fallback**: Zalo ZNS rate-limited → auto-downgrade to **Push Notification (free)** → Push failed → **In-App Inbox**. Critical notifications are NEVER dropped.
**And** if non-critical (promotional, informational) and all channels hit rate limits → **DROP** with a log entry for audit.
**And** multiple modules triggering notifications for the same customer independently each pass through this rate limiter — no module can bypass the funnel.

### AC2: Channel Dispatch (FR54)
**Given** the rate limiter allows the notification (or fallback succeeds)
**When** the dispatch proceeds
**Then** the handler routes to the appropriate channel dispatcher (Push via FCM/APNs, Zalo OA, SMS, Email) based on the notification type and customer preferences
**And** calls `INotificationPort.dispatchNotification(command)` via PortRegistry.

### AC3: Session Event Recording
**Given** a notification is dispatched via `INotificationPort`
**When** the downstream Notification Service processes it
**Then** the BFF records a session event: `{ type: "notification_sent", channel, notificationType, timestamp }`
(This is a stub — Epic 7 will implement real session event recording.)

### AC4: Concurrent Rate Limiting
**Given** multiple modules trigger notifications for the same customer simultaneously
**When** the rate limiter evaluates each
**Then** the Zalo ZNS channel respects the **2 msg/KH/ticket/day limit** — excess ZNS messages trigger the fallback chain for critical notifications or are dropped for non-critical
**And** other channels (Push, SMS) follow their own rate limits independently.

### AC5: Stub Replacement — Payment Webhook
**Given** a successful or failed payment webhook
**When** the `HandlePaymentWebhookHandler` processes it
**Then** it dispatches `DispatchNotificationCommand` with the correct payload (replacing both `[NOTIFICATION STUB]` markers).

### AC6: Stub Replacement — Ticket Webhook
**Given** a ticket status change webhook
**When** the `HandleTicketWebhookHandler` processes it
**Then** it dispatches `DispatchNotificationCommand` with the correct payload (replacing the `[NOTIFICATION STUB]` marker).

## Tasks / Subtasks

- [x] Task 1: Create Notification Dispatch DTOs & Command (AC: #1, #2, #3)
  - [x] Create `src/modules/communication/application/dtos/notification.dto.ts`
  - [x] `NotificationChannelSchema` — `z.enum(['zns', 'push', 'sms', 'email', 'in_app'])`
  - [x] `NotificationTypeSchema` — `z.enum(['payment_completed', 'payment_failed', 'ticket_status_changed', 'alert_outage', 'alert_maintenance', 'alert_quality', 'debt_reminder'])`
  - [x] `DispatchNotificationPayloadSchema` — `{ customerId, type, channel?, isCritical, ticketId?, invoiceId?, amount?, trackingId?, oldStatus?, newStatus?, metadata? }`
  - [x] `DispatchNotificationResultSchema` — `{ dispatched: boolean, channel: NotificationChannel, rateLimited: boolean, fallbackChain?: NotificationChannel[] }`
  - [x] Create `src/modules/communication/application/commands/dispatch-notification.command.ts` — `DispatchNotificationCommand extends ICommand`
  - [x] Export all types

- [x] Task 2: Create Notification Port & Mock Adapter (AC: #2)
  - [x] Create `src/modules/communication/infrastructure/ports/notification.port.ts`
  - [x] `INotificationPort` interface extending `IPortAdapter`
  - [x] `MockNotificationAdapter` extending `MockAdapterBase` with schema for `dispatch-notification`
  - [x] Create `mocks/notification/dispatch-notification.json` — mock dispatch response
  - [x] Add `NOTIFICATION_PORT_TOKEN` to `src/modules/communication/constants/tokens.ts`

- [x] Task 3: Create Redis Rate Limiter Service (AC: #1, #4)
  - [x] Create `src/modules/communication/infrastructure/rate-limiter/redis-rate-limiter.service.ts`
  - [x] `check(userId, channel, ticketId?)` — `Redis INCR ratelimit:notification:{userId}:{date}`, returns `{ allowed: boolean, currentCount: number, limit: number }`
  - [x] ZNS limit: 2 per KH per ticket per day
  - [x] Other channels: configurable limits (default: 50/day for push, 10/day for SMS)
  - [x] Uses `ICacheService.incr()` for atomic increment

- [x] Task 4: Create Dispatch Notification Handler (AC: #1, #2, #3)
  - [x] Create `src/modules/communication/application/commands/handlers/dispatch-notification.handler.ts`
  - [x] Inject `PortRegistry`, `RedisRateLimiterService`
  - [x] Flow: rate limit check → if allowed → `portRegistry.execute('notification', 'dispatch-notification', payload)` → session event stub → return result
  - [x] If critical + rate limited → fallback chain (ZNS → push → in_app) → try next channel
  - [x] If non-critical + rate limited → drop with audit log
  - [x] Return `DispatchNotificationResult` with `dispatched`, `channel`, `rateLimited`, `fallbackChain`

- [x] Task 5: Update Payment Webhook Handler — Replace Stubs (AC: #5)
  - [x] Update `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.ts`
  - [x] Inject `CommandBus` (from `@nestjs/cqrs`)
  - [x] Replace success stub: `this.commandBus.execute(new DispatchNotificationCommand({ customerId, type: 'payment_completed', isCritical: true, invoiceId, amount, ... }))`
  - [x] Replace failure stub: `this.commandBus.execute(new DispatchNotificationCommand({ customerId, type: 'payment_failed', isCritical: true, paymentId, ... }))`

- [x] Task 6: Update Ticket Webhook Handler — Replace Stub (AC: #6)
  - [x] Update `src/modules/ticket/application/commands/handlers/handle-ticket-webhook.handler.ts`
  - [x] Inject `CommandBus`
  - [x] Replace stub: `this.commandBus.execute(new DispatchNotificationCommand({ customerId, type: 'ticket_status_changed', isCritical: false, ticketId, trackingId, oldStatus, newStatus, ... }))`

- [x] Task 7: Update CommunicationModule (AC: all)
  - [x] Add `MockNotificationAdapter` with `useExisting` for `NOTIFICATION_PORT_TOKEN`
  - [x] Add `DispatchNotificationHandler` to providers
  - [x] Add `RedisRateLimiterService` to providers
  - [x] Register `notification` port in `onModuleInit`
  - [x] Update barrel exports

- [x] Task 8: Write comprehensive tests (AC: all)
  - [x] `notification.port.spec.ts` — mock adapter validates dispatch-response JSON
  - [x] `redis-rate-limiter.service.spec.ts` — rate limit check for ZNS (limit 2), push (limit 50), SMS (limit 10), allowed/blocked scenarios
  - [x] `dispatch-notification.handler.spec.ts` — success dispatch, rate-limited ZNS → fallback to push, critical notification fallback chain, non-critical drop, session event stub
  - [x] Updated `handle-payment-webhook.handler.spec.ts` — verify `DispatchNotificationCommand` dispatched on success + failure
  - [x] Updated `handle-ticket-webhook.handler.spec.ts` — verify `DispatchNotificationCommand` dispatched on status change

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story is the **notification backbone** of the entire platform. Every module that needs to notify a customer routes through this single funnel:

```
Any Module → DispatchNotificationCommand → DispatchNotificationHandler
  → RedisRateLimiterService.check(userId, channel, ticketId)
    → Allowed → INotificationPort.dispatchNotification(payload)
      → Session event stub: { type: "notification_sent", channel, notificationType, timestamp }
    → Critical + Rate Limited → Channel Fallback: ZNS → Push → In-App Inbox
    → Non-Critical + Rate Limited → DROP + audit log
```

**This is a CROSS-MODULE concern** — payment and ticket modules dispatch the command, communication module handles it.

#### What ALREADY EXISTS — DO NOT RECREATE

| Component | Location | Status |
|-----------|----------|--------|
| **CommunicationModule** (Story 6-1) | `src/modules/communication/communication.module.ts` | ✅ EXTEND — add notification port + rate limiter + dispatch handler |
| **PortRegistry** | `src/libs/shared/port/port-registry.service.ts` | ✅ USE — `register('notification', ...)` + `execute('notification', ...)` |
| **ICacheService.incr()** | `src/libs/shared/caching/cache.interface.ts` | ✅ USE — atomic Redis INCR for rate limiting |
| **CommandBus** | `@nestjs/cqrs` | ✅ USE — cross-module command dispatch |
| **IdempotencyService** | `src/libs/shared/cqrs/idempotency/` | ✅ EXISTS — webhook handlers already use it |
| **api-endpoints.yaml `notification` config** | `config/api-endpoints.yaml` | ✅ Already defined — dynamic tier, 300s TTL |
| **PortFallbackException** | `src/libs/shared/port/port-exceptions.ts` | ✅ USE for null guards |

#### What This Story CREATES

| Component | Purpose |
|-----------|---------|
| `DispatchNotificationCommand` | Cross-module command — any module dispatches this |
| `DispatchNotificationHandler` | Central funnel — rate limit + dispatch + fallback |
| `RedisRateLimiterService` | Atomic Redis INCR rate limiting per channel |
| `INotificationPort` + `MockNotificationAdapter` | Port for downstream Notification Service |
| `NOTIFICATION_PORT_TOKEN` | DI token for notification port |
| `DispatchNotificationPayload` DTO | Unified payload schema for all notification types |

#### What This Story REPLACES

| Stub Location | Current Code | Replacement |
|-------------|-------------|-------------|
| Payment webhook (success) | `this.logger.log('[NOTIFICATION STUB] payment_completed...')` | `this.commandBus.execute(new DispatchNotificationCommand({...}))` |
| Payment webhook (failure) | `this.logger.log('[NOTIFICATION STUB] payment_failed...')` | `this.commandBus.execute(new DispatchNotificationCommand({...}))` |
| Ticket webhook | `this.logger.log('[NOTIFICATION STUB] ticket_status_changed...')` | `this.commandBus.execute(new DispatchNotificationCommand({...}))` |

### ⚡ Key Architecture Points

1. **`DispatchNotificationCommand` is cross-module** — it's defined in communication module but dispatched FROM payment and ticket modules. Both modules inject `CommandBus` to dispatch it.
2. **Rate limiter is atomic** — uses `ICacheService.incr()` (Redis INCR) to atomically increment the count. Key format: `ratelimit:notification:{userId}:{date}`.
3. **Channel fallback is ONLY for critical notifications** — `isCritical: true` means the system will try ZNS → Push → In-App Inbox in sequence. Non-critical just gets dropped.
4. **Session event is still a stub** — Epic 7 will replace `logger.log('[SESSION EVENT STUB]')` with real Redis session writes.
5. **`notification` port config in api-endpoints.yaml** uses `cacheTtl: 300` (5 min) — shorter than `proactive-notification` (900s) because notification dispatch responses are more transient.
6. **`DispatchNotificationHandler` does NOT inject `CommandBus`** — it receives the command directly from the CQRS bus. It injects `PortRegistry` and `RedisRateLimiterService`.

### 📁 File Structure — Changes

```
src/modules/communication/
├── application/
│   ├── commands/
│   │   ├── dispatch-notification.command.ts           ← NEW (cross-module command)
│   │   ├── handlers/
│   │   │   ├── dispatch-notification.handler.ts      ← NEW (AC#1, #2, #3)
│   │   │   └── dispatch-notification.handler.spec.ts  ← NEW
│   │   └── index.ts                                  ← UPDATE
│   ├── dtos/
│   │   ├── notification.dto.ts                       ← NEW
│   │   └── proactive-notification.dto.ts             ← EXISTS (unchanged)
│   └── index.ts                                      ← UPDATE
├── infrastructure/
│   ├── ports/
│   │   ├── notification.port.ts                      ← NEW
│   │   ├── notification.port.spec.ts                 ← NEW
│   │   └── proactive-notification.port.ts            ← EXISTS (unchanged)
│   └── rate-limiter/
│       ├── redis-rate-limiter.service.ts             ← NEW (AC#1, #4)
│       └── redis-rate-limiter.service.spec.ts        ← NEW
├── constants/
│   └── tokens.ts                                     ← UPDATE (add NOTIFICATION_PORT_TOKEN)
└── communication.module.ts                          ← UPDATE

mocks/notification/                                   ← NEW directory
└── dispatch-notification.json                        ← NEW
```

**MODIFIED files (cross-module):**
- `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.ts` — Replace 2 stubs + inject CommandBus
- `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.spec.ts` — Add dispatch verification tests
- `src/modules/ticket/application/commands/handlers/handle-ticket-webhook.handler.ts` — Replace 1 stub + inject CommandBus
- `src/modules/ticket/application/commands/handlers/handle-ticket-webhook.handler.spec.ts` — Add dispatch verification tests

### 🔧 Implementation Details

#### Notification Dispatch DTOs
```typescript
// src/modules/communication/application/dtos/notification.dto.ts
import { z } from 'zod';

export const NotificationChannelSchema = z.enum(['zns', 'push', 'sms', 'email', 'in_app']);

export const NotificationTypeSchema = z.enum([
  'payment_completed',
  'payment_failed',
  'ticket_status_changed',
  'alert_outage',
  'alert_maintenance',
  'alert_quality',
  'debt_reminder',
]);

export const DispatchNotificationPayloadSchema = z.object({
  customerId: z.string().min(1),
  type: NotificationTypeSchema,
  channel: NotificationChannelSchema.optional(),
  isCritical: z.boolean().default(false),
  ticketId: z.string().optional(),
  invoiceId: z.string().optional(),
  amount: z.number().optional(),
  trackingId: z.string().optional(),
  oldStatus: z.string().optional(),
  newStatus: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const DispatchNotificationResultSchema = z.object({
  dispatched: z.boolean(),
  channel: NotificationChannelSchema,
  rateLimited: z.boolean(),
  fallbackChain: z.array(NotificationChannelSchema).optional(),
});

export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;
export type NotificationType = z.infer<typeof NotificationTypeSchema>;
export type DispatchNotificationPayload = z.infer<typeof DispatchNotificationPayloadSchema>;
export type DispatchNotificationResult = z.infer<typeof DispatchNotificationResultSchema>;
```

#### Dispatch Notification Command
```typescript
// src/modules/communication/application/commands/dispatch-notification.command.ts
import { ICommand } from '@core/application';
import type { DispatchNotificationPayload, DispatchNotificationResult } from '../dtos/notification.dto';

export class DispatchNotificationCommand implements ICommand {
  constructor(public readonly payload: DispatchNotificationPayload) {}
}

export type DispatchNotificationCommandResult = DispatchNotificationResult;
```

#### Notification Port
```typescript
// src/modules/communication/infrastructure/ports/notification.port.ts
import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { DispatchNotificationResultSchema } from '../../application/dtos/notification.dto';

export interface INotificationPort extends IPortAdapter {}

@Injectable()
export class MockNotificationAdapter extends MockAdapterBase implements INotificationPort {
  constructor() {
    super(
      'notification',
      {
        'dispatch-notification': DispatchNotificationResultSchema,
      },
      new Logger('notification-mock-adapter'),
    );
  }
}
```

#### Redis Rate Limiter Service
```typescript
// src/modules/communication/infrastructure/rate-limiter/redis-rate-limiter.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_SERVICE_TOKEN } from '@core/constants/tokens';
import type { ICacheService } from '@shared/caching/cache.interface';
import type { NotificationChannel } from '../../application/dtos/notification.dto';

const CHANNEL_LIMITS: Record<NotificationChannel, number> = {
  zns: 2,    // 2 ZNS messages per KH per ticket per day (FR55)
  push: 50,  // 50 push notifications per day
  sms: 10,   // 10 SMS per day
  email: 20, // 20 emails per day
  in_app: Infinity, // In-app has no limit
};

const FALLBACK_CHAIN: NotificationChannel[] = ['zns', 'push', 'in_app'];

@Injectable()
export class RedisRateLimiterService {
  private readonly logger = new Logger(RedisRateLimiterService.name);

  constructor(
    @Inject(CACHE_SERVICE_TOKEN) private readonly cacheService: ICacheService,
  ) {}

  /**
   * Check if a notification is allowed for the given channel.
   * Uses atomic Redis INCR for concurrent safety.
   */
  async check(
    userId: string,
    channel: NotificationChannel,
  ): Promise<{ allowed: boolean; currentCount: number; limit: number }> {
    const limit = CHANNEL_LIMITS[channel];
    if (limit === Infinity) {
      return { allowed: true, currentCount: 0, limit: Infinity };
    }

    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `ratelimit:notification:${userId}:${date}`;
    const currentCount = await this.cacheService.incr(key);
    // Set TTL on first increment (24h)
    if (currentCount === 1) {
      await this.cacheService.set(key + ':ttl', 1, 86400);
    }
    const allowed = currentCount <= limit;

    if (!allowed) {
      this.logger.log(`Rate limited: ${channel} for ${userId} (${currentCount}/${limit})`);
    }

    return { allowed, currentCount, limit };
  }

  /**
   * Get the fallback chain for critical notifications.
   * Returns channels in priority order: ZNS → Push → In-App Inbox.
   */
  getFallbackChain(): NotificationChannel[] {
    return [...FALLBACK_CHAIN];
  }
}
```

#### Dispatch Notification Handler
```typescript
// src/modules/communication/application/commands/handlers/dispatch-notification.handler.ts
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { DispatchNotificationCommand } from '../dispatch-notification.command';
import type { DispatchNotificationResult, NotificationChannel } from '../../dtos/notification.dto';
import { RedisRateLimiterService } from '../../../infrastructure/rate-limiter/redis-rate-limiter.service';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { Logger } from '@nestjs/common';

@CommandHandler(DispatchNotificationCommand)
export class DispatchNotificationHandler
  implements ICommandHandler<DispatchNotificationCommand>
{
  private readonly logger = new Logger(DispatchNotificationHandler.name);

  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly rateLimiterService: RedisRateLimiterService,
  ) {}

  async execute(command: DispatchNotificationCommand): Promise<DispatchNotificationResult> {
    const { customerId, type, isCritical, channel } = command.payload;

    // Determine target channel(s)
    const targetChannel = channel ?? 'zns'; // Default to ZNS
    const fallbackChain = isCritical ? this.rateLimiterService.getFallbackChain() : [targetChannel];

    // Try each channel in the fallback chain
    const attemptedChannels: NotificationChannel[] = [];

    for (const ch of fallbackChain) {
      const rateCheck = await this.rateLimiterService.check(customerId, ch);

      if (rateCheck.allowed) {
        // Dispatch via notification port
        const result = await this.portRegistry.execute<DispatchNotificationResult>(
          'notification',
          'dispatch-notification',
          { ...command.payload, channel: ch, useCache: false },
        );

        if (!result?.data) {
          this.logger.warn(`Notification port returned null for channel ${ch}`);
          attemptedChannels.push(ch);
          continue;
        }

        // Session event stub (Epic 7 will replace)
        this.logger.log(
          `[SESSION EVENT STUB] notification_sent: channel=${ch}, type=${type}, customerId=${customerId}`,
        );

        this.logger.log(`Notification dispatched: ${type} via ${ch} to ${customerId}`);

        return {
          dispatched: true,
          channel: ch,
          rateLimited: false,
          fallbackChain: attemptedChannels.length > 0 ? attemptedChannels : undefined,
        };
      }

      // Rate limited — try next channel in fallback
      attemptedChannels.push(ch);
      this.logger.log(`Rate limited on ${ch}, trying next fallback (attempted: ${attemptedChannels.join(' → ')})`);
    }

    // All channels exhausted
    if (isCritical) {
      // This should NOT happen — in_app has no limit
      this.logger.error(
        `CRITICAL notification dropped: ${type} to ${customerId}. All channels exhausted!`,
      );
      return {
        dispatched: false,
        channel: targetChannel,
        rateLimited: true,
        fallbackChain: attemptedChannels,
      };
    }

    // Non-critical — drop with audit log
    this.logger.log(
      `[AUDIT] Non-critical notification dropped: ${type} to ${customerId}. Rate limited on: ${attemptedChannels.join(', ')}`,
    );

    return {
      dispatched: false,
      channel: targetChannel,
      rateLimited: true,
      fallbackChain: attemptedChannels,
    };
  }
}
```

#### Payment Webhook Handler Update
```typescript
// In HandlePaymentWebhookHandler — changes only:
// 1. Add CommandBus import and injection
import { CommandBus } from '@nestjs/cqrs';

constructor(
  @Inject(CACHE_SERVICE_TOKEN) private readonly cacheService: ICacheService,
  private readonly idempotencyService: IdempotencyService,
  private readonly commandBus: CommandBus, // NEW
) {}

// 2. Replace success stub (line ~66):
// OLD: this.logger.log(`[NOTIFICATION STUB] payment_completed: amount=[REDACTED]`);
// NEW:
await this.commandBus.execute(
  new DispatchNotificationCommand({
    customerId,
    type: 'payment_completed',
    isCritical: true,
    invoiceId,
    amount,
    metadata: { paymentId },
  }),
);

// 3. Replace failure stub (line ~77):
// OLD: this.logger.log(`[NOTIFICATION STUB] payment_failed: paymentId=${paymentId}`);
// NEW:
await this.commandBus.execute(
  new DispatchNotificationCommand({
    customerId,
    type: 'payment_failed',
    isCritical: true,
    paymentId,
    invoiceId,
    metadata: { status },
  }),
);
```

**⚠️ IMPORTANT:** The `DispatchNotificationCommand` import must come from the communication module:
```typescript
import { DispatchNotificationCommand } from '@modules/communication/application/commands/dispatch-notification.command';
```

#### Ticket Webhook Handler Update
```typescript
// In HandleTicketWebhookHandler — changes only:
// 1. Add CommandBus import and injection
import { CommandBus } from '@nestjs/cqrs';

constructor(
  @Inject(CACHE_SERVICE_TOKEN) private readonly cacheService: ICacheService,
  private readonly idempotencyService: IdempotencyService,
  private readonly commandBus: CommandBus, // NEW
) {}

// 2. Replace stub (line ~56):
// OLD:
//   this.logger.log(`[NOTIFICATION STUB] ticket_status_changed: trackingId=${trackingId} (Epic 6)`);
// NEW:
await this.commandBus.execute(
  new DispatchNotificationCommand({
    customerId,
    type: 'ticket_status_changed',
    isCritical: false,
    ticketId,
    trackingId,
    oldStatus,
    newStatus,
  }),
);
```

#### Mock JSON
```json
// mocks/notification/dispatch-notification.json
{
  "dispatched": true,
  "channel": "zns",
  "rateLimited": false
}
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Call Zalo/Push API directly from handlers | Route through `DispatchNotificationCommand` → rate limiter → `INotificationPort` |
| Bypass the rate limiter for "important" notifications | Use `isCritical: true` + fallback chain instead |
| Use `ICacheService.get/set` for rate counting | Use `ICacheService.incr()` — atomic increment prevents race conditions |
| Put rate limiter in each module | `RedisRateLimiterService` lives in communication module only |
| Create a separate notification module | Notification is part of `communication` module per architecture |
| Dispatch `DispatchNotificationCommand` synchronously (await) and block webhook response | Use `await` — but webhook handlers already return `{ received: true }` immediately after command dispatch |
| Throw if notification dispatch fails | Log the failure and continue — webhooks must always return 200 OK |
| Cache notification dispatch results | `useCache: false` — every dispatch must hit downstream live |

### 🧪 Testing Requirements

1. **MockAdapter — dispatch-notification** — Read JSON, validate `DispatchNotificationResultSchema`
2. **Rate Limiter — ZNS allowed** — First 2 calls return `allowed: true`, 3rd returns `allowed: false`
3. **Rate Limiter — Push/SMS limits** — Verify 50 push, 10 SMS daily limits
4. **Rate Limiter — in_app no limit** — Always returns `allowed: true`
5. **Dispatch Handler — success dispatch** — ZNS allowed → dispatch via port → session event stub
6. **Dispatch Handler — critical + ZNS rate limited → fallback to push** — Verify `fallbackChain: ['zns']`, `channel: 'push'`
7. **Dispatch Handler — critical + all channels exhausted** — Returns `dispatched: false` with error log
8. **Dispatch Handler — non-critical + rate limited** — Returns `dispatched: false` with audit log
9. **Payment webhook — success dispatches `DispatchNotificationCommand`** — Verify `type: 'payment_completed'`, `isCritical: true`
10. **Payment webhook — failure dispatches `DispatchNotificationCommand`** — Verify `type: 'payment_failed'`, `isCritical: true`
11. **Ticket webhook — dispatches `DispatchNotificationCommand`** — Verify `type: 'ticket_status_changed'`, `isCritical: false`

### Previous Story Learnings (Stories 1.1–6.1 — MUST Apply)

- **Handler null guard**: Always `!result?.data` — throw `PortFallbackException`
- **Controller validation**: `Schema.safeParse()` → `throw new ValidationException(validated.error.message)`
- **`useCache: false`** goes inside the `params` object (3rd arg), NOT as a separate argument
- **`useExisting`** for DI token providers — single shared adapter instance
- **Module barrel exports** — update `commands/index.ts`, `application/index.ts`
- **Port registration** in `onModuleInit` — separate call for each port
- **Webhook handlers always return 200** — notification dispatch failure should NOT affect webhook response

### 📋 Cross-Story Context

**Depends on (all complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Story 4.2 (Payment webhook — has 2 notification stubs to replace)
- Story 5.2 (Ticket webhook — has 1 notification stub to replace)
- Story 6.1 (Communication module scaffold + proactive-notification port)

**Enables (future stories):**
- Story 6.3 (Notification Preferences & History) — will add `getNotificationPreferences` + `updateNotificationPreferences` to `INotificationPort`
- Epic 7 (Session Events) — will replace session event stubs with real Redis writes

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2: Multi-Channel Notification Dispatch]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Module Structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#Rate Limiter — 2 msg ZNS/KH/ticket/day]
- [Source: _bmad-output/planning-artifacts/prd.md#FR54-FR55 (Notification Dispatch)]
- [Source: _bmad-output/project-context.md#Notification Module — DispatchNotificationCommand]
- [Source: config/api-endpoints.yaml#notification — port config already defined]
- [Source: src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.ts — stubs to replace]
- [Source: src/modules/ticket/application/commands/handlers/handle-ticket-webhook.handler.ts — stub to replace]
- [Source: src/modules/communication/communication.module.ts — module to extend]

## Dev Agent Record

### Agent Model Used

Claude (glm-5[1m])

### Debug Log References

- 96 test suites, 858 tests — zero regressions

### Completion Notes List

- ✅ Task 1: Created `notification.dto.ts` — NotificationChannel (5), NotificationType (7), DispatchNotificationPayload, DispatchNotificationResult + types. Created `dispatch-notification.command.ts`.
- ✅ Task 2: Created `MockNotificationAdapter` with `dispatch-notification` schema. Created `mocks/notification/dispatch-notification.json`. Added `NOTIFICATION_PORT_TOKEN`.
- ✅ Task 3: Created `RedisRateLimiterService` — atomic INCR via `ICacheService.incr()`, ZNS limit 2, push 50, SMS 10, email 20, in_app ∞. TTL 24h on first increment. `getFallbackChain()` returns ZNS → Push → In-App.
- ✅ Task 4: Created `DispatchNotificationHandler` — rate limit check → fallback chain for critical (ZNS → Push → In-App) → DROP for non-critical. Port null guard. Session event stub.
- ✅ Task 5: Updated `HandlePaymentWebhookHandler` — injected `CommandBus`, replaced both `[NOTIFICATION STUB]` markers with `DispatchNotificationCommand` (success: `payment_completed`/critical, failure: `payment_failed`/critical).
- ✅ Task 6: Updated `HandleTicketWebhookHandler` — injected `CommandBus`, replaced `[NOTIFICATION STUB]` marker with `DispatchNotificationCommand` (`ticket_status_changed`/non-critical).
- ✅ Task 7: Updated `CommunicationModule` — two ports pattern (proactive-notification + notification), added `MockNotificationAdapter`, `DispatchNotificationHandler`, `RedisRateLimiterService`. Updated barrel exports.
- ✅ Task 8: 5 test files created/updated — port spec (3 tests), rate limiter spec (8 tests), dispatch handler spec (7 tests), payment webhook spec updated (+5 tests, stub checks replaced with dispatch verification), ticket webhook spec updated (+3 tests, stub checks replaced). Integration test updated with mock dispatch handler.

### File List

**NEW files:**
- `src/modules/communication/application/dtos/notification.dto.ts`
- `src/modules/communication/application/commands/dispatch-notification.command.ts`
- `src/modules/communication/application/commands/handlers/dispatch-notification.handler.ts`
- `src/modules/communication/application/commands/handlers/dispatch-notification.handler.spec.ts`
- `src/modules/communication/infrastructure/ports/notification.port.ts`
- `src/modules/communication/infrastructure/ports/notification.port.spec.ts`
- `src/modules/communication/infrastructure/rate-limiter/redis-rate-limiter.service.ts`
- `src/modules/communication/infrastructure/rate-limiter/redis-rate-limiter.service.spec.ts`
- `mocks/notification/dispatch-notification.json`

**MODIFIED files:**
- `src/modules/communication/communication.module.ts` — added notification port + DispatchNotificationHandler + RedisRateLimiterService
- `src/modules/communication/constants/tokens.ts` — added NOTIFICATION_PORT_TOKEN
- `src/modules/communication/application/commands/index.ts` — added dispatch-notification export
- `src/modules/communication/application/index.ts` — added notification.dto + dispatch-notification exports
- `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.ts` — replaced 2 notification stubs with DispatchNotificationCommand, injected CommandBus
- `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.spec.ts` — added CommandBus mock, replaced stub checks with dispatch verification (+5 tests)
- `src/modules/ticket/application/commands/handlers/handle-ticket-webhook.handler.ts` — replaced notification stub with DispatchNotificationCommand, injected CommandBus
- `src/modules/ticket/application/commands/handlers/handle-ticket-webhook.handler.spec.ts` — added CommandBus mock, replaced stub checks with dispatch verification (+3 tests)
- `test/integration/payment-webhook.spec.ts` — added MockDispatchNotificationHandler for cross-module command resolution
