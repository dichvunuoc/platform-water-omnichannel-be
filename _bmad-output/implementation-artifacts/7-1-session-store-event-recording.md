# Story 7.1: Session Store & Event Recording

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **customer (Anh Tuấn)**,
I want every interaction I have with the water company to be recorded,
so that when I switch channels, the company remembers everything without me repeating myself.

## Acceptance Criteria

### AC1: Atomic Session Event Recording (FR61)

**Given** an authenticated customer performs any interaction (view invoice, submit ticket, make payment, etc.)
**When** the BFF processes the request
**Then** a session event is recorded in Redis within 1 second: `{ type, timestamp, content, metadata, channel }`
**And** the write uses the **atomic Lua script** (`SESSION_APPEND_LUA`) that performs `ZADD` + `EXPIRE` + `HSET` + `EXPIRE` in a single Redis round-trip — no separate commands.

### AC2: Session Data Structure (FR63)

**Given** a session event is written
**When** the data is stored in Redis
**Then** the session key `session:{userId}` (Hash) stores: sessionId, userId, channel, createdAt, updatedAt, eventCount
**And** the events key `session:{userId}:events` (Sorted Set) stores events with timestamp as score
**And** both keys have TTL 24h (configurable 24-48h via `SESSION_TTL_SECONDS` env var), AOF persistence enabled (NFR-R4: sessions survive restart).

### AC3: Efficient Queries

**Given** a customer has 100+ session events
**When** the BFF queries their session
**Then** the Sorted Set allows O(log N) time-range queries (e.g. "show events from the last 2 hours")
**And** the Hash allows O(1) full session metadata read.

### AC4: Redis Restart Resilience (NFR-R4)

**Given** the Redis instance restarts
**When** it comes back online
**Then** all session data is preserved (AOF persistence)
**And** active customers can continue their sessions without re-authentication.

### AC5: Stub Replacement — Session Event Recording

**Given** modules currently use `[SESSION EVENT STUB]` logger calls
**When** this story is complete
**Then** the following stubs are replaced with `RecordSessionEventCommand` dispatch:
- `dispatch-notification.handler.ts:63` — `notification_sent`
- `handle-payment-webhook.handler.ts:60` — `payment_completed`
- `handle-ticket-webhook.handler.ts:54` — `ticket_status_changed`
**And** corresponding test files are updated to verify session store interaction instead of logger calls.

## Tasks / Subtasks

- [x] Task 1: Create Session Module Scaffold (AC: all)
  - [x] Create `src/modules/session/session.module.ts` — module shell
  - [x] Create `src/modules/session/constants/tokens.ts` — `SESSION_STORE_TOKEN`, `SESSION_TTL_TOKEN`
  - [x] Create `src/modules/session/domain/index.ts` — barrel export
  - [x] Create `src/modules/session/domain/events/session-event.types.ts` — event type definitions
  - [x] Create `src/modules/session/application/index.ts` — barrel export

- [x] Task 2: Create Session Event Types & DTOs (AC: #1, #2)
  - [x] Create `src/modules/session/application/dtos/session-event.dto.ts`
  - [x] `SessionEventTypeSchema` — z.enum with all event types
  - [x] `ChannelTypeSchema` — z.enum(['zalo', 'web', 'hotline', 'counter'])
  - [x] `SessionEventSchema` — `{ id, type, channel, timestamp, content }`
  - [x] `SessionMetadataSchema` — `{ sessionId, userId, channel, createdAt, updatedAt, eventCount }`
  - [x] `RecordSessionEventPayloadSchema` — `{ userId, eventType, channel, content }`
  - [x] Export all types

- [x] Task 3: Create Lua Script Artifact (AC: #1)
  - [x] Create `src/modules/session/infrastructure/redis/scripts/session-append.lua`
  - [x] `SESSION_APPEND_LUA` script — atomic ZADD + EXPIRE + HSET + EXPIRE
  - [x] KEYS[1] = `session:{userId}`, KEYS[2] = `session:{userId}:events`
  - [x] ARGV[1] = event JSON, ARGV[2] = TTL, ARGV[3] = score (timestamp ms), ARGV[4] = updatedAt string
  - [x] Returns 1 on success

- [x] Task 4: Create ISessionStore Interface + Redis Implementation (AC: #1, #2, #3, #4)
  - [x] Create `src/modules/session/domain/repositories/session-store.interface.ts`
  - [x] `ISessionStore` interface: `appendEvent()`, `getSession()`, `getEvents()`, `sessionExists()`
  - [x] Create `src/modules/session/infrastructure/redis/redis-session.store.ts`
  - [x] Inject `CACHE_SERVICE_TOKEN` — access raw Redis via `getClient()`
  - [x] Load Lua script on init → store SHA → use `EVALSHA` with `EVAL` fallback
  - [x] `appendEvent()` — calls SESSION_APPEND_LUA
  - [x] `getSession()` — `HGETALL session:{userId}`
  - [x] `getEvents(from?, to?)` — `ZRANGEBYSCORE session:{userId}:events`
  - [x] `sessionExists()` — `EXISTS session:{userId}`

- [x] Task 5: Create Record Session Event Command + Handler (AC: #1, #5)
  - [x] Create `src/modules/communication/application/commands/record-session-event.command.ts`
  - [x] `RecordSessionEventCommand implements ICommand` — `{ userId, eventType, channel, content }`
  - [x] Create `src/modules/session/application/commands/handlers/record-session-event.handler.ts`
  - [x] Inject `ISessionStore` via `SESSION_STORE_TOKEN`
  - [x] Generate event ID (UUID), timestamp, build event JSON
  - [x] Call `sessionStore.appendEvent()`
  - [x] Log success/failure

- [x] Task 6: Create Session Query Handlers (AC: #3)
  - [x] Create `src/modules/session/application/queries/get-session.query.ts`
  - [x] Create `src/modules/session/application/queries/handlers/get-session.handler.ts`
  - [x] Inject `ISessionStore` — call `getSession(userId)` → return metadata or null
  - [x] Create `src/modules/session/application/queries/get-session-events.query.ts`
  - [x] Create `src/modules/session/application/queries/handlers/get-session-events.handler.ts`
  - [x] Inject `ISessionStore` — call `getEvents(userId, from, to)` → return events
  - [x] Create barrel exports: `queries/index.ts`, `commands/index.ts`

- [x] Task 7: Register SessionModule (AC: all)
  - [x] Update `src/modules/session/session.module.ts`
  - [x] `RedisSessionStore` with `useExisting` for `SESSION_STORE_TOKEN`
  - [x] `RecordSessionEventHandler` in providers
  - [x] `GetSessionHandler`, `GetSessionEventsHandler` in providers
  - [x] TTL value provider: `SESSION_TTL_TOKEN` from env var `SESSION_TTL_SECONDS` (default 86400)
  - [x] Export `SESSION_STORE_TOKEN` for cross-module use
  - [x] Update `src/app.module.ts` — add `SessionModule` after `CommunicationModule`
  - [x] Update barrel exports

- [x] Task 8: Replace Session Event Stubs — Cross-Module (AC: #5)
  - [x] Update `src/modules/communication/application/commands/handlers/dispatch-notification.handler.ts`
    - [x] Inject `CommandBus`
    - [x] Replace `[SESSION EVENT STUB] notification_sent` with `RecordSessionEventCommand`
  - [x] Update `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.ts`
    - [x] Replace `[SESSION EVENT STUB] payment_completed` with `RecordSessionEventCommand`
  - [x] Update `src/modules/ticket/application/commands/handlers/handle-ticket-webhook.handler.ts`
    - [x] Replace `[SESSION EVENT STUB] ticket_status_changed` with `RecordSessionEventCommand`

- [x] Task 9: Update Tests — Stub Replacement (AC: #5)
  - [x] Update `dispatch-notification.handler.spec.ts` — replace SESSION EVENT STUB assertions with RecordSessionEventCommand verification
  - [x] Update `handle-payment-webhook.handler.spec.ts` — replace SESSION EVENT STUB assertions
  - [x] Update `handle-ticket-webhook.handler.spec.ts` — replace SESSION EVENT STUB assertions
  - [x] Update integration tests if they mock session event stubs

- [x] Task 10: Write Comprehensive Session Module Tests (AC: all)
  - [x] `redis-session.store.spec.ts` — appendEvent, getSession, getEvents, sessionExists, TTL refresh, EVALSHA fallback
  - [x] `record-session-event.handler.spec.ts` — success recording, store failure handling
  - [x] `get-session.handler.spec.ts` — session found, session not found
  - [x] `get-session-events.handler.spec.ts` — events found with time range, no events
  - [x] `session-event.dto.spec.ts` — schema validation with valid/invalid payloads

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story is a **paradigm shift**. Every story from Epic 1 through Epic 6 used the PortRegistry pattern (DTO → Port → Handler → PortRegistry → Adapter). Story 7.1 introduces **direct Redis operations** — no PortRegistry, no mock adapter, no `api-endpoints.yaml` config.

**This is NOT a port module.** The session store is BFF-internal infrastructure. It talks to Redis directly, not to a downstream service.

**Flow:**
```
Any Module → RecordSessionEventCommand → RecordSessionEventHandler
  → ISessionStore.appendEvent()
    → Redis EVALSHA SESSION_APPEND_LUA (atomic ZADD + HSET + EXPIRE)
      → session:{userId} (Hash) — metadata
      → session:{userId}:events (Sorted Set) — events
```

#### What ALREADY EXISTS — DO NOT RECREATE

| Component | Location | Status |
|-----------|----------|--------|
| **RedisCacheService** | `src/libs/shared/caching/redis-cache.service.ts` | ✅ USE — `getClient()` returns raw `RedisClientType` |
| **CACHE_SERVICE_TOKEN** | `src/libs/shared/caching/` | ✅ USE — inject for Redis access |
| **ICacheService interface** | `src/libs/shared/caching/cache.interface.ts` | ✅ USE — but NOT for Lua scripts (see below) |
| **CommandBus** | `@nestjs/cqrs` | ✅ USE — cross-module command dispatch |
| **CommunicationModule** | Story 6.1-6.3 | ✅ EXISTS — will dispatch `RecordSessionEventCommand` |
| **PaymentModule** | Stories 4.1-4.5 | ✅ EXISTS — will dispatch `RecordSessionEventCommand` |
| **TicketModule** | Stories 5.1-5.4 | ✅ EXISTS — will dispatch `RecordSessionEventCommand` |
| **Session event stubs** | 3 handler files | ✅ REPLACE — with real Redis writes |

#### What This Story CREATES

| Component | Purpose |
|-----------|---------|
| `SessionModule` | New NestJS module — internal Redis session store |
| `ISessionStore` | Interface for session read/write operations |
| `RedisSessionStore` | Redis implementation — Hash + Sorted Set + Lua script |
| `SESSION_APPEND_LUA` | Atomic Lua script — single round-trip session event write |
| `RecordSessionEventCommand` + Handler | Cross-module command — any module dispatches this to record events |
| `GetSessionQuery` + Handler | Read session metadata |
| `GetSessionEventsQuery` + Handler | Read session events with time-range filtering |
| `SessionEventType` types | 12 event types defined as Zod enum |

#### What This Story REPLACES

| File | Line | Current (STUB) | Replacement |
|------|------|----------------|-------------|
| `dispatch-notification.handler.ts` | :63 | `logger.log('[SESSION EVENT STUB] notification_sent...')` | `commandBus.execute(new RecordSessionEventCommand({...}))` |
| `handle-payment-webhook.handler.ts` | :60 | `logger.log('[SESSION EVENT STUB] payment_completed...')` | `commandBus.execute(new RecordSessionEventCommand({...}))` |
| `handle-ticket-webhook.handler.ts` | :54 | `logger.log('[SESSION EVENT STUB] ticket_status_changed...')` | `commandBus.execute(new RecordSessionEventCommand({...}))` |

### ⚡ Key Architecture Points

1. **ISessionStore is NOT ICacheService** — Cache is for port response caching. Session store is for event sourcing. Separate interfaces, separate concerns. Do NOT add `eval()` to ICacheService.
2. **Access raw Redis via `getClient()`** — `RedisCacheService` exposes `getClient(): RedisClientType`. This is the supported way to run Lua scripts. Cast to `RedisCacheService` when needed (the DI token resolves to it in production).
3. **EVALSHA with EVAL fallback** — Load script on module init → store SHA → use EVALSHA for performance. If Redis returns NOSCRIPT error → fall back to EVAL with full script text.
4. **Cross-module command dispatch** — `RecordSessionEventCommand` is defined in the session module but dispatched FROM payment, ticket, and communication modules. All three inject `CommandBus` to dispatch it.
5. **No controller needed** — Session store has no REST API in this story. It's purely an internal service consumed via CQRS. Story 7.2 may add session query endpoints.
6. **No `api-endpoints.yaml` changes** — The `session` port config in api-endpoints.yaml is for a future external session service. This story uses internal Redis directly.
7. **No mock adapter** — Unlike all previous stories, there's no PortRegistry mock. The session store talks directly to Redis. Tests mock `ISessionStore` interface.
8. **TTL from env var** — `SESSION_TTL_SECONDS` env var (default 86400 = 24h). Add to `.env` and `project-context.md` Environment Variables section.
9. **Session events are JSON strings** — Stored as members in the Sorted Set. Each event is `JSON.stringify({ id, type, channel, timestamp, content })`.
10. **Event ID is UUID** — Use `crypto.randomUUID()` (available in Bun natively).

### 📁 File Structure — Changes

```
src/modules/session/                              ← NEW MODULE
├── domain/
│   ├── events/
│   │   └── session-event.types.ts               ← NEW (event type definitions)
│   ├── repositories/
│   │   └── session-store.interface.ts            ← NEW (ISessionStore)
│   └── index.ts                                  ← NEW
├── application/
│   ├── commands/
│   │   ├── record-session-event.command.ts       ← NEW (cross-module command)
│   │   ├── handlers/
│   │   │   ├── record-session-event.handler.ts   ← NEW
│   │   │   └── record-session-event.handler.spec.ts ← NEW
│   │   └── index.ts                              ← NEW
│   ├── queries/
│   │   ├── get-session.query.ts                  ← NEW
│   │   ├── get-session-events.query.ts           ← NEW
│   │   ├── handlers/
│   │   │   ├── get-session.handler.ts            ← NEW
│   │   │   ├── get-session.handler.spec.ts       ← NEW
│   │   │   ├── get-session-events.handler.ts     ← NEW
│   │   │   └── get-session-events.handler.spec.ts ← NEW
│   │   └── index.ts                              ← NEW
│   ├── dtos/
│   │   ├── session-event.dto.ts                  ← NEW
│   │   └── session-event.dto.spec.ts             ← NEW
│   └── index.ts                                  ← NEW
├── infrastructure/
│   └── redis/
│       ├── scripts/
│       │   └── session-append.lua                ← NEW (atomic Lua script)
│       ├── redis-session.store.ts                ← NEW (ISessionStore implementation)
│       └── redis-session.store.spec.ts           ← NEW
├── constants/
│   └── tokens.ts                                 ← NEW
└── session.module.ts                             ← NEW
```

**MODIFIED files (cross-module stub replacement):**
- `src/modules/communication/application/commands/handlers/dispatch-notification.handler.ts` — Replace stub + inject CommandBus
- `src/modules/communication/application/commands/handlers/dispatch-notification.handler.spec.ts` — Update stub assertions
- `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.ts` — Replace stub
- `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.spec.ts` — Update stub assertions
- `src/modules/ticket/application/commands/handlers/handle-ticket-webhook.handler.ts` — Replace stub
- `src/modules/ticket/application/commands/handlers/handle-ticket-webhook.handler.spec.ts` — Update stub assertions
- `src/app.module.ts` — Add SessionModule

### 🔧 Implementation Details

#### Session Event Types
```typescript
// src/modules/session/domain/events/session-event.types.ts
export const SessionEventTypeSchema = z.enum([
  'zalo_message_received',
  'call_started',
  'call_completed',
  'ticket_created',
  'ticket_status_changed',
  'payment_completed',
  'payment_failed',
  'notification_sent',
  'invoice_viewed',
  'alert_acknowledged',
  'session_started',
  'session_continued',
]);
export type SessionEventType = z.infer<typeof SessionEventTypeSchema>;

export const ChannelTypeSchema = z.enum(['zalo', 'web', 'hotline', 'counter']);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;
```

#### Session Event DTO
```typescript
// src/modules/session/application/dtos/session-event.dto.ts
export const SessionEventSchema = z.object({
  id: z.string().uuid(),
  type: SessionEventTypeSchema,
  channel: ChannelTypeSchema,
  timestamp: z.string(),
  content: z.record(z.string(), z.unknown()),
});
export type SessionEvent = z.infer<typeof SessionEventSchema>;

export const SessionMetadataSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().min(1),
  channel: ChannelTypeSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  eventCount: z.number().int().nonnegative(),
});
export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;

export const RecordSessionEventPayloadSchema = z.object({
  userId: z.string().min(1),
  eventType: SessionEventTypeSchema,
  channel: ChannelTypeSchema,
  content: z.record(z.string(), z.unknown()),
});
export type RecordSessionEventPayload = z.infer<typeof RecordSessionEventPayloadSchema>;
```

#### ISessionStore Interface
```typescript
// src/modules/session/domain/repositories/session-store.interface.ts
import type { SessionEvent, SessionMetadata } from '../../application/dtos/session-event.dto';

export interface ISessionStore {
  /**
   * Atomically append a session event.
   * Uses Lua script for atomic ZADD + EXPIRE + HSET + EXPIRE.
   */
  appendEvent(userId: string, event: SessionEvent, ttl: number): Promise<void>;

  /**
   * Get session metadata. Returns null if session doesn't exist.
   */
  getSession(userId: string): Promise<SessionMetadata | null>;

  /**
   * Get session events within a time range.
   * @param from Unix timestamp ms (default: 0)
   * @param to Unix timestamp ms (default: +Infinity)
   */
  getEvents(userId: string, from?: number, to?: number): Promise<SessionEvent[]>;

  /**
   * Check if a session exists.
   */
  sessionExists(userId: string): Promise<boolean>;
}
```

#### Lua Script — SESSION_APPEND_LUA
```lua
-- src/modules/session/infrastructure/redis/scripts/session-append.lua
-- Atomic session event append + metadata update + TTL refresh
--
-- KEYS[1] = session:{userId}           (Hash — session metadata)
-- KEYS[2] = session:{userId}:events    (Sorted Set — session events)
--
-- ARGV[1] = event JSON string
-- ARGV[2] = TTL in seconds (e.g. 86400)
-- ARGV[3] = score (timestamp in milliseconds)
-- ARGV[4] = current ISO 8601 timestamp string
--
-- Returns: 1 on success

local sessionKey = KEYS[1]
local eventsKey = KEYS[2]
local event = ARGV[1]
local ttl = tonumber(ARGV[2])
local score = ARGV[3]
local updatedAt = ARGV[4]

-- 1. Append event to sorted set
redis.call('ZADD', eventsKey, score, event)

-- 2. Refresh TTL on events key
redis.call('EXPIRE', eventsKey, ttl)

-- 3. Get current event count (or default to 0 if new session)
local currentCount = tonumber(redis.call('HGET', sessionKey, 'eventCount') or '0')

-- 4. Update session metadata
redis.call('HSET', sessionKey, 'updatedAt', updatedAt, 'eventCount', tostring(currentCount + 1))

-- 5. Refresh TTL on session metadata key
redis.call('EXPIRE', sessionKey, ttl)

return 1
```

#### Redis Session Store (Partial)
```typescript
// src/modules/session/infrastructure/redis/redis-session.store.ts
import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { CACHE_SERVICE_TOKEN } from '@core/constants/tokens';
import type { ICacheService } from '@shared/caching/cache.interface';
import { RedisCacheService } from '@shared/caching/redis-cache.service';
import { SESSION_TTL_TOKEN } from '../../constants/tokens';
import type { ISessionStore } from '../../domain/repositories/session-store.interface';
import type { SessionEvent, SessionMetadata } from '../../application/dtos/session-event.dto';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class RedisSessionStore implements ISessionStore, OnModuleInit {
  private readonly logger = new Logger(RedisSessionStore.name);
  private scriptSha: string | null = null;
  private readonly luaScript: string;

  constructor(
    @Inject(CACHE_SERVICE_TOKEN) private readonly cacheService: ICacheService,
    @Inject(SESSION_TTL_TOKEN) private readonly defaultTtl: number,
  ) {
    // Load Lua script from file
    this.luaScript = readFileSync(
      join(__dirname, 'scripts', 'session-append.lua'),
      'utf8',
    );
  }

  async onModuleInit(): Promise<void> {
    // Load script into Redis → store SHA for EVALSHA
    const client = this.getRawClient();
    this.scriptSha = await client.scriptLoad(this.luaScript);
    this.logger.log(`Session Lua script loaded: SHA=${this.scriptSha}`);
  }

  async appendEvent(userId: string, event: SessionEvent, ttl?: number): Promise<void> {
    const client = this.getRawClient();
    const sessionKey = `session:${userId}`;
    const eventsKey = `session:${userId}:events`;
    const effectiveTtl = ttl ?? this.defaultTtl;
    const score = String(new Date(event.timestamp).getTime());
    const updatedAt = new Date().toISOString();

    try {
      // Try EVALSHA first (performance)
      await client.evalSha(this.scriptSha!, {
        keys: [sessionKey, eventsKey],
        arguments: [JSON.stringify(event), String(effectiveTtl), score, updatedAt],
      });
    } catch (error) {
      // Fallback to EVAL if script not loaded (NOSCRIPT error)
      if (String(error).includes('NOSCRIPT')) {
        this.logger.warn('EVALSHA NOSCRIPT — falling back to EVAL');
        await client.eval(this.luaScript, {
          keys: [sessionKey, eventsKey],
          arguments: [JSON.stringify(event), String(effectiveTtl), score, updatedAt],
        });
        // Re-load SHA
        this.scriptSha = await client.scriptLoad(this.luaScript);
      } else {
        throw error;
      }
    }
  }

  async getSession(userId: string): Promise<SessionMetadata | null> {
    const client = this.getRawClient();
    const data = await client.hGetAll(`session:${userId}`);
    if (!data || Object.keys(data).length === 0) return null;
    return {
      sessionId: data.sessionId,
      userId: data.userId,
      channel: data.channel,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      eventCount: parseInt(data.eventCount || '0', 10),
    };
  }

  async getEvents(userId: string, from = 0, to = Infinity): Promise<SessionEvent[]> {
    const client = this.getRawClient();
    const rawEvents = await client.zRange(`session:${userId}:events`, from, to, { byScore: true });
    return rawEvents.map((e: string) => JSON.parse(e) as SessionEvent);
  }

  async sessionExists(userId: string): Promise<boolean> {
    const client = this.getRawClient();
    return (await client.exists(`session:${userId}`)) > 0;
  }

  private getRawClient() {
    return (this.cacheService as RedisCacheService).getClient();
  }
}
```

#### Record Session Event Command
```typescript
// src/modules/session/application/commands/record-session-event.command.ts
import { ICommand } from '@core/application';
import type { RecordSessionEventPayload } from '../dtos/session-event.dto';

export class RecordSessionEventCommand implements ICommand {
  constructor(public readonly payload: RecordSessionEventPayload) {}
}
```

#### Record Session Event Handler
```typescript
// src/modules/session/application/commands/handlers/record-session-event.handler.ts
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { RecordSessionEventCommand } from '../record-session-event.command';
import { SESSION_STORE_TOKEN } from '../../../constants/tokens';
import type { ISessionStore } from '../../../domain/repositories/session-store.interface';
import type { SessionEvent } from '../../dtos/session-event.dto';
import { randomUUID } from 'crypto';

@CommandHandler(RecordSessionEventCommand)
export class RecordSessionEventHandler implements ICommandHandler<RecordSessionEventCommand> {
  private readonly logger = new Logger(RecordSessionEventHandler.name);

  constructor(
    @Inject(SESSION_STORE_TOKEN) private readonly sessionStore: ISessionStore,
  ) {}

  async execute(command: RecordSessionEventCommand): Promise<void> {
    const { userId, eventType, channel, content } = command.payload;

    const event: SessionEvent = {
      id: randomUUID(),
      type: eventType,
      channel,
      timestamp: new Date().toISOString(),
      content,
    };

    try {
      await this.sessionStore.appendEvent(userId, event);
      this.logger.log(`Session event recorded: ${eventType} for ${userId}`);
    } catch (error) {
      // Session event recording failure should NOT break the caller
      // Log and continue — the interaction itself must still succeed
      this.logger.error(`Failed to record session event: ${eventType} for ${userId}`, error);
    }
  }
}
```

#### Stub Replacement — Dispatch Notification Handler
```typescript
// In dispatch-notification.handler.ts — changes only:
// 1. Add CommandBus import and injection
import { CommandBus } from '@nestjs/cqrs';
import { RecordSessionEventCommand } from '@modules/session/application/commands/record-session-event.command';

constructor(
  private readonly portRegistry: PortRegistry,
  private readonly rateLimiterService: RedisRateLimiterService,
  private readonly commandBus: CommandBus, // NEW
) {}

// 2. Replace session event stub (line ~63):
// OLD: this.logger.log(`[SESSION EVENT STUB] notification_sent: channel=${ch}, type=${type}, customerId=${customerId}`);
// NEW:
await this.commandBus.execute(
  new RecordSessionEventCommand({
    userId: customerId,
    eventType: 'notification_sent',
    channel: ch === 'zns' ? 'zalo' : ch === 'in_app' ? 'web' : ch,
    content: { channel: ch, notificationType: type },
  }),
);
```

**⚠️ IMPORTANT:** Session event recording failure MUST NOT break notification dispatch. The `try/catch` in `RecordSessionEventHandler` handles this. Additionally, the handler uses `await` but the caller should consider `void` pattern if latency is critical (optional optimization).

#### Stub Replacement — Payment Webhook Handler
```typescript
// In handle-payment-webhook.handler.ts — changes only:
import { RecordSessionEventCommand } from '@modules/session/application/commands/record-session-event.command';

// Replace session event stub (line ~60):
// OLD: this.logger.log(`[SESSION EVENT STUB] payment_completed: invoiceId=${invoiceId}, amount=[REDACTED]`);
// NEW:
await this.commandBus.execute(
  new RecordSessionEventCommand({
    userId: customerId,
    eventType: 'payment_completed',
    channel: 'web',
    content: { invoiceId, amount },
  }),
);
```

#### Stub Replacement — Ticket Webhook Handler
```typescript
// In handle-ticket-webhook.handler.ts — changes only:
import { RecordSessionEventCommand } from '@modules/session/application/commands/record-session-event.command';

// Replace session event stub (line ~54):
// OLD: this.logger.log(`[SESSION EVENT STUB] ticket_status_changed: ticketId=${ticketId}, trackingId=${trackingId}, ${oldStatus} → ${newStatus}`);
// NEW:
await this.commandBus.execute(
  new RecordSessionEventCommand({
    userId: customerId,
    eventType: 'ticket_status_changed',
    channel: 'web',
    content: { ticketId, trackingId, oldStatus, newStatus },
  }),
);
```

#### SessionModule
```typescript
// src/modules/session/session.module.ts
import { Module } from '@nestjs/common';
import { RedisSessionStore } from './infrastructure/redis/redis-session.store';
import { SESSION_STORE_TOKEN, SESSION_TTL_TOKEN } from './constants/tokens';
import { RecordSessionEventHandler } from './application/commands/handlers/record-session-event.handler';
import { GetSessionHandler } from './application/queries/handlers/get-session.handler';
import { GetSessionEventsHandler } from './application/queries/handlers/get-session-events.handler';

@Module({
  providers: [
    // TTL configuration from env
    {
      provide: SESSION_TTL_TOKEN,
      useFactory: () => parseInt(process.env.SESSION_TTL_SECONDS || '86400', 10),
    },
    // Session Store
    RedisSessionStore,
    {
      provide: SESSION_STORE_TOKEN,
      useExisting: RedisSessionStore,
    },
    // Command Handlers
    RecordSessionEventHandler,
    // Query Handlers
    GetSessionHandler,
    GetSessionEventsHandler,
  ],
  exports: [SESSION_STORE_TOKEN],
})
export class SessionModule {}
```

#### DI Tokens
```typescript
// src/modules/session/constants/tokens.ts
export const SESSION_STORE_TOKEN = Symbol('ISessionStore');
export const SESSION_TTL_TOKEN = Symbol('SESSION_TTL');
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Add `eval()` to `ICacheService` | Create separate `ISessionStore` interface — session is a domain concern, not cache |
| Use separate Redis commands for ZADD + EXPIRE + HSET | Use `SESSION_APPEND_LUA` Lua script — atomic single round-trip |
| Always use `EVAL` (sends full script every time) | Use `EVALSHA` with `EVAL` fallback — saves bandwidth |
| Put session store logic in controllers | Session store is consumed via CQRS commands — no REST API in this story |
| Break caller if session recording fails | `try/catch` in handler — log error, don't throw. Interaction must succeed regardless |
| Create a `session` port in PortRegistry | Session store is BFF-internal Redis — not a downstream service call |
| Forget to add `SessionModule` to `app.module.ts` | Add after `CommunicationModule`, before `PortModule` |
| Use `any` for event content | `z.record(z.string(), z.unknown())` — flexible but typed |
| Store PII in session events | Use `[REDACTED]` for amounts and other PII — pino-redact handles log PII, but Redis is persistent |

### 🧪 Testing Requirements

1. **RedisSessionStore — appendEvent** — Verify EVALSHA called with correct keys/args; TTL refreshed; metadata updated
2. **RedisSessionStore — appendEvent NOSCRIPT fallback** — EVALSHA fails → EVAL succeeds → SHA re-loaded
3. **RedisSessionStore — getSession** — Returns metadata for existing session; null for non-existent
4. **RedisSessionStore — getEvents with time range** — Returns events in range; empty for no match
5. **RedisSessionStore — sessionExists** — True for existing, false for non-existent
6. **RecordSessionEventHandler — success** — Builds event with UUID + timestamp, calls appendEvent
7. **RecordSessionEventHandler — store failure** — Logs error, does NOT throw (caller unaffected)
8. **GetSessionHandler — found** — Returns session metadata
9. **GetSessionHandler — not found** — Returns null
10. **GetSessionEventsHandler — with range** — Returns filtered events
11. **Dispatch Notification Handler — stub replaced** — Dispatches `RecordSessionEventCommand` instead of logger
12. **Payment Webhook Handler — stub replaced** — Dispatches `RecordSessionEventCommand` for payment_completed
13. **Ticket Webhook Handler — stub replaced** — Dispatches `RecordSessionEventCommand` for ticket_status_changed
14. **Schema validation** — Valid payloads pass, invalid event types/channels rejected

### Previous Story Learnings (Stories 1.1–6.3 — MUST Apply)

- **Handler null guard**: `!result?.data` → `PortFallbackException` (for PortRegistry handlers — NOT applicable to session store handlers)
- **Controller validation**: `Schema.safeParse()` → `throw new ValidationException()` (no controllers in this story)
- **`useCache: false`** inside params object (NOT applicable — no PortRegistry in this story)
- **`useExisting`** for DI token providers — single shared instance
- **Module barrel exports** — update `commands/index.ts`, `queries/index.ts`, `application/index.ts`
- **Cross-module command dispatch** — `RecordSessionEventCommand` is imported from session module by other modules
- **Session event recording MUST NOT break caller** — try/catch in handler, log error, continue
- **CommandBus injection** — already injected in payment and ticket webhook handlers (from Story 6.2)

### 📋 Cross-Story Context

**Depends on (all complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Stories 6.1–6.3 (Communication module + session event stubs to replace)
- Stories 4.1–4.5 (Payment module + session event stub to replace)
- Stories 5.1–5.4 (Ticket module + session event stub to replace)
- Preparation artifacts (session schema design, Lua script spike)

**Enables (future stories):**
- Story 7.2 (Cross-Channel Session Continuation) — reads session events for context transfer
- Story 7.3 (Webhook Security Guards) — independent, but both are in Epic 7
- Future analytics (session event aggregation for KH behavior insights)

### Project Structure Notes

- New module `src/modules/session/` follows DDD structure with domain/application/infrastructure layers
- `domain/` has repositories (ISessionStore) and events (types) — no entities since BFF doesn't own session data in PostgreSQL
- `infrastructure/redis/` replaces the typical `infrastructure/ports/` — this is direct Redis, not a port adapter
- Lua script stored as `.lua` file and loaded via `readFileSync` — keeps script versioned and reviewable
- No `api-endpoints.yaml` changes — session store is internal, not a downstream port

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1: Session Store & Event Recording]
- [Source: _bmad-output/planning-artifacts/architecture.md#Session Event Schema (Redis)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Session Write Atomicity (Lua script)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision D4: Redis Hash + Sorted Set]
- [Source: _bmad-output/planning-artifacts/architecture.md#Session Module (modules/session/)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Session Event Types — EXPANDED]
- [Source: _bmad-output/planning-artifacts/prd.md#FR61-FR64 (Session & Context Preservation)]
- [Source: _bmad-output/project-context.md#Session Write Atomicity (Redis)]
- [Source: _bmad-output/project-context.md#Session Event Types]
- [Source: _bmad-output/implementation-artifacts/prep-epic7/session-store-schema-design.md]
- [Source: _bmad-output/implementation-artifacts/prep-epic7/lua-session-append-spike.md]
- [Source: src/libs/shared/caching/redis-cache.service.ts — getClient() for raw Redis access]
- [Source: src/modules/communication/application/commands/handlers/dispatch-notification.handler.ts:63 — stub to replace]
- [Source: src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.ts:60 — stub to replace]
- [Source: src/modules/ticket/application/commands/handlers/handle-ticket-webhook.handler.ts:54 — stub to replace]

## Dev Agent Record

### Agent Model Used

Claude (glm-5[1m])

### Debug Log References

- All 10 tasks completed in single session without HALT
- Full test suite: 106 suites, 1018 tests — ALL GREEN
- Zero regressions introduced
- Code review: 8 issues found (2 HIGH, 4 MEDIUM, 2 LOW) — all HIGH and MEDIUM fixed
- Post-review test suite: 106 suites, 1023 tests — ALL GREEN

### Completion Notes List

- ✅ Task 1: Created session module scaffold with DDD structure (domain/application/infrastructure/constants)
- ✅ Task 2: Created Zod schemas for all DTOs — SessionEvent, SessionMetadata, RecordSessionEventPayload, SessionEventType, ChannelType
- ✅ Task 3: Created atomic Lua script (SESSION_APPEND_LUA) — ZADD + EXPIRE + HSET + EXPIRE in single round-trip
- ✅ Task 4: Created ISessionStore interface + RedisSessionStore with EVALSHA/EVAL fallback, HGETALL, ZRANGEBYSCORE, EXISTS
- ✅ Task 5: Created RecordSessionEventCommand + Handler with UUID generation, timestamp, try/catch for resilience
- ✅ Task 6: Created GetSessionQuery/Handler + GetSessionEventsQuery/Handler with time-range filtering
- ✅ Task 7: Registered SessionModule with DI providers, useExisting pattern, TTL from env var, added to AppModule
- ✅ Task 8: Replaced all 3 session event stubs with RecordSessionEventCommand dispatch (dispatch-notification, payment-webhook, ticket-webhook)
- ✅ Task 9: Updated all 3 spec files — replaced SESSION EVENT STUB assertions with RecordSessionEventCommand verification
- ✅ Task 10: Created 5 comprehensive test files — RedisSessionStore (EVALSHA, fallback, getSession, getEvents, sessionExists), RecordSessionEventHandler (success + failure), GetSessionHandler (found + not found), GetSessionEventsHandler (range + empty), DTO schemas (valid/invalid payloads)
- ✅ Review Fix H1: Lua script now initializes sessionId, userId, channel, createdAt via HSETNX on first write
- ✅ Review Fix H2: Added RecordSessionEventPayloadSchema Zod validation in RecordSessionEventHandler
- ✅ Review Fix M1: Added try/catch for JSON.parse in getEvents() to handle corrupted entries gracefully
- ✅ Review Fix M2: Added scriptSha null guard in appendEvent() — throws clear error if not initialized
- ✅ Review Fix M3+M4: Fixed stale JSDoc comments in dispatch-notification and ticket-webhook handlers
- ✅ Review Fix L1: Removed unused Logger from GetSessionHandler and GetSessionEventsHandler

### File List

**NEW files (Session Module):**
- `src/modules/session/session.module.ts`
- `src/modules/session/constants/tokens.ts`
- `src/modules/session/domain/index.ts`
- `src/modules/session/domain/events/session-event.types.ts`
- `src/modules/session/domain/repositories/session-store.interface.ts`
- `src/modules/session/application/index.ts`
- `src/modules/session/application/dtos/session-event.dto.ts`
- `src/modules/session/application/dtos/session-event.dto.spec.ts`
- `src/modules/session/application/commands/record-session-event.command.ts`
- `src/modules/session/application/commands/index.ts`
- `src/modules/session/application/commands/handlers/record-session-event.handler.ts`
- `src/modules/session/application/commands/handlers/record-session-event.handler.spec.ts`
- `src/modules/session/application/queries/get-session.query.ts`
- `src/modules/session/application/queries/get-session-events.query.ts`
- `src/modules/session/application/queries/index.ts`
- `src/modules/session/application/queries/handlers/get-session.handler.ts`
- `src/modules/session/application/queries/handlers/get-session.handler.spec.ts`
- `src/modules/session/application/queries/handlers/get-session-events.handler.ts`
- `src/modules/session/application/queries/handlers/get-session-events.handler.spec.ts`
- `src/modules/session/infrastructure/redis/scripts/session-append.lua`
- `src/modules/session/infrastructure/redis/redis-session.store.ts`
- `src/modules/session/infrastructure/redis/redis-session.store.spec.ts`

**MODIFIED files (cross-module stub replacement + registration):**
- `src/app.module.ts` — added SessionModule import
- `src/modules/communication/application/commands/handlers/dispatch-notification.handler.ts` — replaced stub, injected CommandBus
- `src/modules/communication/application/commands/handlers/dispatch-notification.handler.spec.ts` — updated for RecordSessionEventCommand
- `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.ts` — replaced stub with RecordSessionEventCommand
- `src/modules/payment/application/commands/handlers/handle-payment-webhook.handler.spec.ts` — updated for RecordSessionEventCommand
- `src/modules/ticket/application/commands/handlers/handle-ticket-webhook.handler.ts` — replaced stub with RecordSessionEventCommand
- `src/modules/ticket/application/commands/handlers/handle-ticket-webhook.handler.spec.ts` — updated for RecordSessionEventCommand
