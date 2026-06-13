# Story 6.3: Notification Preferences & History

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **customer (Anh Tuấn)**,
I want to choose which notifications I receive and through which channels, and view my notification history,
so that I get only the information I care about, how I want it.

## Acceptance Criteria

### AC1: Get Notification Preferences (FR56)

**Given** an authenticated customer navigates to "Notification Settings"
**When** the BFF receives the request
**Then** it calls `INotificationPort.getNotificationPreferences(customerId)` via PortRegistry
**And** returns current preferences with a clear distinction: **Optional** channels (Zalo, SMS, marketing) can be toggled by the customer, but **Critical** notification types (water cutoff, payment status, widespread incident) are always enabled and cannot be disabled — the UI shows these as locked/read-only with a tooltip explaining why.

### AC2: Update Notification Preferences (FR56)

**Given** an authenticated customer updates their notification preferences
**When** they save changes
**Then** the BFF calls `INotificationPort.updateNotificationPreferences(customerId, preferences)` via PortRegistry with `useCache: false`
**And** notifications with `isCritical: true` **bypass** customer preferences entirely — they are always dispatched regardless of opt-out settings
**And** critical notifications prefer non-intrusive channels (Push, In-App Inbox) to respect customer experience while ensuring delivery.

### AC3: Get Notification History (FR57)

**Given** an authenticated customer navigates to "Notification History"
**When** the BFF receives the request with pagination
**Then** it calls `INotificationPort.getNotificationHistory(customerId)` via PortRegistry
**And** returns a paginated list: notification type, channel, content summary, timestamp, delivery status (sent/delivered/failed).

### AC4: Cache Strategy

**Given** notification data is fetched successfully
**When** the response is cached
**Then** the cache key follows `cache:port:notification:{hash}` with TTL 300s (dynamic tier, 5 min — same as `dispatch-notification` in api-endpoints.yaml).

## Tasks / Subtasks

- [x] Task 1: Create Notification Preferences DTOs (AC: #1, #2, #4)
  - [x] Create `src/modules/communication/application/dtos/notification-preferences.dto.ts`
  - [x] `NotificationChannelPreferenceSchema` — per-channel toggle: `{ channel: NotificationChannel, enabled: boolean, isCritical: boolean }`
  - [x] `NotificationPreferencesResponseSchema` — `{ customerId, channels: NotificationChannelPreference[], updatedAt }`
  - [x] `UpdateNotificationPreferencesPayloadSchema` — `{ channels: { channel: NotificationChannel, enabled: boolean }[] }`
  - [x] `UpdateNotificationPreferencesResponseSchema` — `{ customerId, channels: NotificationChannelPreference[], updatedAt }`
  - [x] `NotificationHistoryQuerySchema` — `{ page, pageSize, startDate?, endDate?, channel?, type? }` with pagination defaults
  - [x] `NotificationHistoryItemSchema` — `{ id, type, channel, contentSummary, timestamp, deliveryStatus }`
  - [x] `NotificationHistoryResponseSchema` — `{ notifications: NotificationHistoryItem[], totalCount, page, pageSize }`
  - [x] Export all types

- [x] Task 2: Update MockNotificationAdapter — add new schemas (AC: #1, #2, #3)
  - [x] Update `src/modules/communication/infrastructure/ports/notification.port.ts`
  - [x] Add `'get-notification-preferences'` → `NotificationPreferencesResponseSchema`
  - [x] Add `'update-notification-preferences'` → `UpdateNotificationPreferencesResponseSchema`
  - [x] Add `'get-notification-history'` → `NotificationHistoryResponseSchema`
  - [x] Create `mocks/notification/get-notification-preferences.json`
  - [x] Create `mocks/notification/update-notification-preferences.json`
  - [x] Create `mocks/notification/get-notification-history.json`

- [x] Task 3: Create Get Notification Preferences Query + Handler (AC: #1)
  - [x] Create `src/modules/communication/application/queries/get-notification-preferences.query.ts`
  - [x] Create `src/modules/communication/application/queries/handlers/get-notification-preferences.handler.ts`
  - [x] Inject `PortRegistry`
  - [x] Call `portRegistry.execute('notification', 'get-notification-preferences', { customerId })`
  - [x] Null guard → `PortFallbackException`
  - [x] Returns cached data (dynamic tier — 300s TTL)

- [x] Task 4: Create Update Notification Preferences Command + Handler (AC: #2)
  - [x] Create `src/modules/communication/application/commands/update-notification-preferences.command.ts`
  - [x] Create `src/modules/communication/application/commands/handlers/update-notification-preferences.handler.ts`
  - [x] Inject `PortRegistry`
  - [x] Call `portRegistry.execute('notification', 'update-notification-preferences', { customerId, channels, useCache: false })`
  - [x] Null guard → `PortFallbackException`

- [x] Task 5: Create Get Notification History Query + Handler (AC: #3)
  - [x] Create `src/modules/communication/application/queries/get-notification-history.query.ts`
  - [x] Create `src/modules/communication/application/queries/handlers/get-notification-history.handler.ts`
  - [x] Inject `PortRegistry`
  - [x] Call `portRegistry.execute('notification', 'get-notification-history', { customerId, ...filters })`
  - [x] Null guard → `PortFallbackException`

- [x] Task 6: Create Notification Controller (AC: #1, #2, #3)
  - [x] Create `src/modules/communication/infrastructure/http/notification.controller.ts`
  - [x] `GET /notifications/preferences` → `GetNotificationPreferencesQuery`
  - [x] `PATCH /notifications/preferences` → `UpdateNotificationPreferencesCommand`
  - [x] `GET /notifications/history` → `GetNotificationHistoryQuery` with `NotificationHistoryQuerySchema` validation
  - [x] Use `@ApiTags('Notifications')`, `@ApiBearerAuth('JWT-auth')`, `@Controller('notifications')`
  - [x] Inject `QUERY_BUS_TOKEN` and `COMMAND_BUS_TOKEN`
  - [x] Use `@CurrentUser('id')` for customerId

- [x] Task 7: Update CommunicationModule (AC: all)
  - [x] Add `NotificationController` to controllers
  - [x] Add `GetNotificationPreferencesHandler` to providers
  - [x] Add `GetNotificationHistoryHandler` to providers
  - [x] Add `UpdateNotificationPreferencesHandler` to providers
  - [x] Update barrel exports: `queries/index.ts`, `commands/index.ts`, `application/index.ts`

- [x] Task 8: Write comprehensive tests (AC: all)
  - [x] `get-notification-preferences.handler.spec.ts` — success returns preferences, null port throws PortFallbackException
  - [x] `get-notification-history.handler.spec.ts` — success returns paginated history, null port throws PortFallbackException
  - [x] `update-notification-preferences.handler.spec.ts` — success updates preferences with useCache: false, null port throws PortFallbackException
  - [x] `notification.controller.spec.ts` — GET /preferences, PATCH /preferences validates input, GET /history with query validation
  - [x] `notification.port.spec.ts` — verify new mock schemas validate against get-preferences, update-preferences, get-history JSON files
  - [x] Update `notification-preferences.dto.spec.ts` — validate schemas with valid/invalid payloads

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story completes the **Notification** half of the communication module (FR56-FR57). It adds the **read/write preferences** and **history query** features to the existing `notification` port that was scaffolded in Story 6.2.

**Flow:**
```
GET  /notifications/preferences    → GetNotificationPreferencesQuery → PortRegistry('notification', 'get-notification-preferences')
PATCH /notifications/preferences   → UpdateNotificationPreferencesCommand → PortRegistry('notification', 'update-notification-preferences')
GET  /notifications/history        → GetNotificationHistoryQuery → PortRegistry('notification', 'get-notification-history')
```

All three endpoints use the **existing** `notification` port (same `MockNotificationAdapter` from Story 6.2). We EXTEND the adapter with new method schemas — we do NOT create a new port.

#### What ALREADY EXISTS — DO NOT RECREATE

| Component | Location | Status |
|-----------|----------|--------|
| **CommunicationModule** | `src/modules/communication/communication.module.ts` | ✅ EXTEND — add NotificationController + 3 handlers |
| **MockNotificationAdapter** | `src/modules/communication/infrastructure/ports/notification.port.ts` | ✅ EXTEND — add 3 new method schemas |
| **NOTIFICATION_PORT_TOKEN** | `src/modules/communication/constants/tokens.ts` | ✅ EXISTS — reuse |
| **notification port config** | `config/api-endpoints.yaml` lines 212-223 | ✅ EXISTS — methods already defined: `["send", "get-history", "get-preferences", "update-preferences"]` |
| **PortRegistry** | `src/libs/shared/port/` | ✅ USE — `execute('notification', method, params)` |
| **NotificationChannelSchema** | `src/modules/communication/application/dtos/notification.dto.ts` | ✅ REUSE — `'zns' \| 'push' \| 'sms' \| 'email' \| 'in_app'` |
| **NotificationTypeSchema** | `src/modules/communication/application/dtos/notification.dto.ts` | ✅ REUSE — 7 notification types |
| **DispatchNotificationCommand** | Story 6.2 | ✅ EXISTS — no changes needed |
| **RedisRateLimiterService** | Story 6.2 | ✅ EXISTS — no changes needed |
| **DispatchNotificationHandler** | Story 6.2 | ✅ EXISTS — `isCritical` bypass logic already implemented |
| **ProactiveNotificationController** | Story 6.1 | ✅ EXISTS — separate controller, no changes |
| **dispatch-notification.json** | `mocks/notification/` | ✅ EXISTS — no changes |

#### What This Story CREATES

| Component | Purpose |
|-----------|---------|
| `notification-preferences.dto.ts` | Preference schemas + history query/response schemas |
| `GetNotificationPreferencesQuery` + Handler | Read customer notification preferences |
| `UpdateNotificationPreferencesCommand` + Handler | Write customer notification preferences |
| `GetNotificationHistoryQuery` + Handler | Read notification history with pagination |
| `NotificationController` | REST endpoints: GET/PATCH preferences, GET history |
| 3 mock JSON files | `get-notification-preferences.json`, `update-notification-preferences.json`, `get-notification-history.json` |

#### Critical Notification Bypass — ARCHITECTURE ENFORCEMENT

The epics state: **`isCritical: true` notifications bypass customer preferences entirely**. This enforcement ALREADY EXISTS in `DispatchNotificationHandler` (Story 6.2) — it does NOT check preferences before dispatching. The preferences in this story are for **optional/non-critical** channel preferences only.

The mock data for preferences MUST reflect this: critical channels should have `isCritical: true` and `enabled: true` as immutable fields. The update handler should NOT allow disabling critical channels — the mock response should mirror this.

### ⚡ Key Architecture Points

1. **Separate controller from ProactiveNotificationController** — `NotificationController` handles `/notifications/*` while `ProactiveNotificationController` handles `/proactive-notifications/*`. Two distinct route groups, same module.
2. **PATCH not PUT for preferences** — partial update semantics. Customer toggles one channel at a time, not full replacement.
3. **History uses dynamic cache (300s TTL)** — same as the `notification` port config in api-endpoints.yaml. Preferences could use longer cache but the port is already configured as dynamic tier.
4. **Preferences update uses `useCache: false`** — write operation, must hit downstream live. Same pattern as `AcknowledgeAlertHandler`.
5. **NotificationChannelSchema reuse** — import from `notification.dto.ts`, don't duplicate the enum.
6. **NotificationTypeSchema reuse** — the `type` filter in history query uses the same 7 types from `notification.dto.ts`.
7. **Controller route ordering** — `GET /preferences` and `GET /history` before any parameterized routes.
8. **Port method names in api-endpoints.yaml** — `get-preferences`, `update-preferences`, `get-history`. The adapter method map keys MUST match exactly for PortRegistry resolution.

### 📁 File Structure — Changes

```
src/modules/communication/
├── application/
│   ├── commands/
│   │   ├── dispatch-notification.command.ts                 ← EXISTS (unchanged)
│   │   ├── acknowledge-alert.command.ts                     ← EXISTS (unchanged)
│   │   ├── update-notification-preferences.command.ts      ← NEW (AC#2)
│   │   ├── handlers/
│   │   │   ├── dispatch-notification.handler.ts             ← EXISTS (unchanged)
│   │   │   ├── acknowledge-alert.handler.ts                 ← EXISTS (unchanged)
│   │   │   ├── update-notification-preferences.handler.ts  ← NEW (AC#2)
│   │   │   └── update-notification-preferences.handler.spec.ts ← NEW
│   │   └── index.ts                                         ← UPDATE
│   ├── dtos/
│   │   ├── notification.dto.ts                              ← EXISTS (unchanged — reuse NotificationChannelSchema)
│   │   ├── notification-preferences.dto.ts                  ← NEW
│   │   └── proactive-notification.dto.ts                    ← EXISTS (unchanged)
│   ├── queries/
│   │   ├── get-active-alerts.query.ts                       ← EXISTS (unchanged)
│   │   ├── get-alert-history.query.ts                       ← EXISTS (unchanged)
│   │   ├── get-notification-preferences.query.ts            ← NEW (AC#1)
│   │   ├── get-notification-history.query.ts                ← NEW (AC#3)
│   │   ├── handlers/
│   │   │   ├── get-active-alerts.handler.ts                 ← EXISTS (unchanged)
│   │   │   ├── get-alert-history.handler.ts                 ← EXISTS (unchanged)
│   │   │   ├── get-notification-preferences.handler.ts      ← NEW (AC#1)
│   │   │   ├── get-notification-history.handler.ts          ← NEW (AC#3)
│   │   │   ├── get-notification-preferences.handler.spec.ts ← NEW
│   │   │   └── get-notification-history.handler.spec.ts     ← NEW
│   │   └── index.ts                                         ← UPDATE
│   └── index.ts                                              ← UPDATE
├── infrastructure/
│   ├── http/
│   │   ├── proactive-notification.controller.ts             ← EXISTS (unchanged)
│   │   ├── proactive-notification.controller.spec.ts        ← EXISTS (unchanged)
│   │   ├── notification.controller.ts                       ← NEW (AC#1, #2, #3)
│   │   └── notification.controller.spec.ts                  ← NEW
│   ├── ports/
│   │   ├── notification.port.ts                             ← UPDATE (add 3 method schemas)
│   │   ├── notification.port.spec.ts                        ← UPDATE (add 3 mock validations)
│   │   └── proactive-notification.port.ts                   ← EXISTS (unchanged)
│   └── rate-limiter/                                        ← EXISTS (unchanged)
├── constants/
│   └── tokens.ts                                             ← EXISTS (unchanged — NOTIFICATION_PORT_TOKEN already there)
└── communication.module.ts                                  ← UPDATE (add controller + handlers)

mocks/notification/
├── dispatch-notification.json                                ← EXISTS (unchanged)
├── get-notification-preferences.json                         ← NEW
├── update-notification-preferences.json                      ← NEW
└── get-notification-history.json                             ← NEW
```

### 🔧 Implementation Details

#### Notification Preferences DTOs
```typescript
// src/modules/communication/application/dtos/notification-preferences.dto.ts
import { z } from 'zod';
import { NotificationChannelSchema, NotificationTypeSchema } from './notification.dto';

// =============================================================================
// AC#1: Notification Preferences
// =============================================================================

export const NotificationChannelPreferenceSchema = z.object({
  channel: NotificationChannelSchema,
  enabled: z.boolean(),
  isCritical: z.boolean().describe('If true, this channel cannot be disabled by the customer'),
});
export type NotificationChannelPreference = z.infer<typeof NotificationChannelPreferenceSchema>;

export const NotificationPreferencesResponseSchema = z.object({
  customerId: z.string().min(1),
  channels: z.array(NotificationChannelPreferenceSchema),
  updatedAt: z.string(),
});
export type NotificationPreferencesResponse = z.infer<typeof NotificationPreferencesResponseSchema>;

// =============================================================================
// AC#2: Update Notification Preferences
// =============================================================================

export const UpdateNotificationPreferencesPayloadSchema = z.object({
  channels: z.array(z.object({
    channel: NotificationChannelSchema,
    enabled: z.boolean(),
  })).min(1),
});
export type UpdateNotificationPreferencesPayload = z.infer<typeof UpdateNotificationPreferencesPayloadSchema>;

export const UpdateNotificationPreferencesResponseSchema = NotificationPreferencesResponseSchema;
export type UpdateNotificationPreferencesResponse = z.infer<typeof UpdateNotificationPreferencesResponseSchema>;

// =============================================================================
// AC#3: Notification History
// =============================================================================

export const NotificationDeliveryStatusSchema = z.enum(['sent', 'delivered', 'failed']);
export type NotificationDeliveryStatus = z.infer<typeof NotificationDeliveryStatusSchema>;

export const NotificationHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  channel: NotificationChannelSchema.optional(),
  type: NotificationTypeSchema.optional(),
});
export type NotificationHistoryQuery = z.infer<typeof NotificationHistoryQuerySchema>;

export const NotificationHistoryItemSchema = z.object({
  id: z.string().min(1),
  type: NotificationTypeSchema,
  channel: NotificationChannelSchema,
  contentSummary: z.string().min(1),
  timestamp: z.string(),
  deliveryStatus: NotificationDeliveryStatusSchema,
});
export type NotificationHistoryItem = z.infer<typeof NotificationHistoryItemSchema>;

export const NotificationHistoryResponseSchema = z.object({
  notifications: z.array(NotificationHistoryItemSchema),
  totalCount: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type NotificationHistoryResponse = z.infer<typeof NotificationHistoryResponseSchema>;

// =============================================================================
// Shared Validation
// =============================================================================

export const UpdatePreferencesBodySchema = UpdateNotificationPreferencesPayloadSchema;
```

#### Get Notification Preferences Query
```typescript
// src/modules/communication/application/queries/get-notification-preferences.query.ts
import { IQuery } from '@core/application';

export class GetNotificationPreferencesQuery implements IQuery {
  constructor(public readonly customerId: string) {}
}
```

#### Get Notification Preferences Handler
```typescript
// src/modules/communication/application/queries/handlers/get-notification-preferences.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetNotificationPreferencesQuery } from '../get-notification-preferences.query';
import type { NotificationPreferencesResponse } from '../../dtos/notification-preferences.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

@QueryHandler(GetNotificationPreferencesQuery)
export class GetNotificationPreferencesHandler
  implements IQueryHandler<GetNotificationPreferencesQuery>
{
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetNotificationPreferencesQuery): Promise<NotificationPreferencesResponse> {
    const result = await this.portRegistry.execute<NotificationPreferencesResponse>(
      'notification',
      'get-notification-preferences',
      { customerId: query.customerId },
    );

    if (!result?.data) {
      throw new PortFallbackException('notification');
    }

    return result.data;
  }
}
```

#### Update Notification Preferences Command
```typescript
// src/modules/communication/application/commands/update-notification-preferences.command.ts
import { ICommand } from '@core/application';
import type { UpdateNotificationPreferencesPayload, UpdateNotificationPreferencesResponse } from '../dtos/notification-preferences.dto';

export class UpdateNotificationPreferencesCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly payload: UpdateNotificationPreferencesPayload,
  ) {}
}

export type UpdateNotificationPreferencesCommandResult = UpdateNotificationPreferencesResponse;
```

#### Update Notification Preferences Handler
```typescript
// src/modules/communication/application/commands/handlers/update-notification-preferences.handler.ts
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { UpdateNotificationPreferencesCommand } from '../update-notification-preferences.command';
import type { UpdateNotificationPreferencesResponse } from '../../dtos/notification-preferences.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

@CommandHandler(UpdateNotificationPreferencesCommand)
export class UpdateNotificationPreferencesHandler
  implements ICommandHandler<UpdateNotificationPreferencesCommand>
{
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: UpdateNotificationPreferencesCommand): Promise<UpdateNotificationPreferencesResponse> {
    const result = await this.portRegistry.execute<UpdateNotificationPreferencesResponse>(
      'notification',
      'update-notification-preferences',
      {
        customerId: command.customerId,
        channels: command.payload.channels,
        useCache: false,
      },
    );

    if (!result?.data) {
      throw new PortFallbackException('notification');
    }

    return result.data;
  }
}
```

#### Get Notification History Query
```typescript
// src/modules/communication/application/queries/get-notification-history.query.ts
import { IQuery } from '@core/application';
import type { NotificationHistoryQuery } from '../dtos/notification-preferences.dto';

export class GetNotificationHistoryQuery implements IQuery {
  constructor(
    public readonly customerId: string,
    public readonly filters: NotificationHistoryQuery,
  ) {}
}
```

#### Get Notification History Handler
```typescript
// src/modules/communication/application/queries/handlers/get-notification-history.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetNotificationHistoryQuery } from '../get-notification-history.query';
import type { NotificationHistoryResponse } from '../../dtos/notification-preferences.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

@QueryHandler(GetNotificationHistoryQuery)
export class GetNotificationHistoryHandler
  implements IQueryHandler<GetNotificationHistoryQuery>
{
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetNotificationHistoryQuery): Promise<NotificationHistoryResponse> {
    const result = await this.portRegistry.execute<NotificationHistoryResponse>(
      'notification',
      'get-notification-history',
      {
        customerId: query.customerId,
        ...query.filters,
      },
    );

    if (!result?.data) {
      throw new PortFallbackException('notification');
    }

    return result.data;
  }
}
```

#### Notification Controller
```typescript
// src/modules/communication/infrastructure/http/notification.controller.ts
/**
 * Notification Controller
 *
 * REST endpoints for notification preferences and history.
 * Thin pass-through: validates input → dispatches CQRS query/command → returns result.
 *
 * AC: #1 (get preferences), #2 (update preferences), #3 (history)
 *
 * ⚠️ Route ordering: GET /preferences and GET /history MUST come BEFORE any :id routes.
 */

import { Controller, Get, Patch, Body, Query, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN, COMMAND_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import type { ICommandBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetNotificationPreferencesQuery } from '../../application/queries/get-notification-preferences.query';
import { GetNotificationHistoryQuery } from '../../application/queries/get-notification-history.query';
import { UpdateNotificationPreferencesCommand } from '../../application/commands/update-notification-preferences.command';
import {
  NotificationHistoryQuerySchema,
  UpdatePreferencesBodySchema,
} from '../../application/dtos/notification-preferences.dto';
import { ValidationException } from '@core/common';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationController {

  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  /**
   * GET /notifications/preferences
   * Get notification preferences for the authenticated customer (AC#1)
   */
  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetNotificationPreferencesQuery(userId));
  }

  /**
   * PATCH /notifications/preferences
   * Update notification preferences (AC#2)
   */
  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const validated = UpdatePreferencesBodySchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException(validated.error.message);
    }
    return this.commandBus.execute(
      new UpdateNotificationPreferencesCommand(userId, validated.data),
    );
  }

  /**
   * GET /notifications/history
   * Get notification history with pagination and filters (AC#3)
   */
  @Get('history')
  @ApiOperation({ summary: 'Get notification history' })
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const validated = NotificationHistoryQuerySchema.safeParse(query);
    if (!validated.success) {
      throw new ValidationException(validated.error.message);
    }
    return this.queryBus.execute(new GetNotificationHistoryQuery(userId, validated.data));
  }
}
```

#### Updated MockNotificationAdapter
```typescript
// In notification.port.ts — UPDATED schema map:
import { NotificationPreferencesResponseSchema, UpdateNotificationPreferencesResponseSchema, NotificationHistoryResponseSchema } from '../../application/dtos/notification-preferences.dto';

// Add to constructor super() schema map:
{
  'dispatch-notification': DispatchNotificationResultSchema,
  'get-notification-preferences': NotificationPreferencesResponseSchema,
  'update-notification-preferences': UpdateNotificationPreferencesResponseSchema,
  'get-notification-history': NotificationHistoryResponseSchema,
}
```

#### Mock JSON — get-notification-preferences.json
```json
{
  "customerId": "USR-00001",
  "channels": [
    { "channel": "push", "enabled": true, "isCritical": false },
    { "channel": "in_app", "enabled": true, "isCritical": true },
    { "channel": "zns", "enabled": true, "isCritical": false },
    { "channel": "sms", "enabled": false, "isCritical": false },
    { "channel": "email", "enabled": true, "isCritical": false }
  ],
  "updatedAt": "2026-06-11T10:30:00Z"
}
```

#### Mock JSON — update-notification-preferences.json
```json
{
  "customerId": "USR-00001",
  "channels": [
    { "channel": "push", "enabled": true, "isCritical": false },
    { "channel": "in_app", "enabled": true, "isCritical": true },
    { "channel": "zns", "enabled": false, "isCritical": false },
    { "channel": "sms", "enabled": true, "isCritical": false },
    { "channel": "email", "enabled": true, "isCritical": false }
  ],
  "updatedAt": "2026-06-11T10:35:00Z"
}
```

#### Mock JSON — get-notification-history.json
```json
{
  "notifications": [
    {
      "id": "NTF-001",
      "type": "payment_completed",
      "channel": "zns",
      "contentSummary": "Thanh toán hóa đơn INV-2026-0042 thành công",
      "timestamp": "2026-06-11T09:15:00Z",
      "deliveryStatus": "delivered"
    },
    {
      "id": "NTF-002",
      "type": "alert_outage",
      "channel": "push",
      "contentSummary": "Thông báo cắt nước khu vực KCN Cẩm Phả từ 14:00-17:00",
      "timestamp": "2026-06-11T08:00:00Z",
      "deliveryStatus": "sent"
    },
    {
      "id": "NTF-003",
      "type": "ticket_status_changed",
      "channel": "in_app",
      "contentSummary": "Phiếu tiếp nhận TK-2026-002 đã được chuyển sang 'Đang xử lý'",
      "timestamp": "2026-06-10T16:45:00Z",
      "deliveryStatus": "delivered"
    }
  ],
  "totalCount": 3,
  "page": 1,
  "pageSize": 20
}
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Create a new port for preferences/history | EXTEND the existing `notification` port with new method schemas |
| Create a new DI token | Reuse `NOTIFICATION_PORT_TOKEN` — same adapter, same port |
| Enforce critical bypass in the preferences handler | Bypass is already enforced in `DispatchNotificationHandler` (Story 6.2) — preferences are advisory for non-critical only |
| Use PUT for preferences update | Use PATCH — partial update semantics |
| Duplicate `NotificationChannelSchema` in preferences DTO | Import from `notification.dto.ts` |
| Put preferences logic in the controller | Controller is thin pass-through — validate → dispatch → return |
| Cache preferences updates | `useCache: false` on update — always hit downstream live |
| Return wrapped `{ data: ..., success: true }` | Direct return — no wrappers per API conventions |
| Forget to update barrel exports | Update `commands/index.ts`, `queries/index.ts`, `application/index.ts` |

### 🧪 Testing Requirements

1. **Port — get-notification-preferences** — Read JSON, validate `NotificationPreferencesResponseSchema`
2. **Port — update-notification-preferences** — Read JSON, validate `UpdateNotificationPreferencesResponseSchema`
3. **Port — get-notification-history** — Read JSON, validate `NotificationHistoryResponseSchema`
4. **GetPreferences handler — success** — Returns preferences via PortRegistry
5. **GetPreferences handler — port returns null** — Throws `PortFallbackException`
6. **GetHistory handler — success with filters** — Passes filters through to PortRegistry
7. **GetHistory handler — port returns null** — Throws `PortFallbackException`
8. **UpdatePreferences handler — success** — Updates with `useCache: false`, returns updated preferences
9. **UpdatePreferences handler — port returns null** — Throws `PortFallbackException`
10. **Controller — GET /preferences** — Dispatches query, returns result
11. **Controller — PATCH /preferences with valid body** — Validates, dispatches command
12. **Controller — PATCH /preferences with invalid body** — Returns `ValidationException`
13. **Controller — GET /history with query params** — Validates query, dispatches query with filters
14. **Controller — GET /history with invalid params** — Returns `ValidationException`

### Previous Story Learnings (Stories 1.1–6.2 — MUST Apply)

- **Handler null guard**: Always `!result?.data` → throw `PortFallbackException`
- **Controller validation**: `Schema.safeParse()` → `throw new ValidationException(validated.error.message)`
- **`useCache: false`** goes inside the params object (3rd arg to execute), NOT as a separate argument
- **`useExisting`** for DI token providers — single shared adapter instance
- **Module barrel exports** — update `commands/index.ts`, `queries/index.ts`, `application/index.ts`
- **Port registration** in `onModuleInit` — already done for `notification` port, no change needed
- **Mock JSON files** — must match the Zod schema exactly or app fails to start in dev
- **`@Query()` params** are strings — use `z.coerce.number()` for numeric fields in query schemas
- **`@Body()` params** are parsed JSON — use `z.number()` (no coerce needed) for body schemas
- **Route ordering** in NestJS — specific paths (`/preferences`, `/history`) before parameterized routes

### 📋 Cross-Story Context

**Depends on (all complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Story 6.1 (Communication module scaffold + proactive-notification port + controller pattern)
- Story 6.2 (notification port + MockNotificationAdapter + rate limiter + dispatch handler)

**Enables (future stories):**
- Epic 6 Retrospective — all stories in Epic 6 will be complete after this story
- Epic 7 (Session Events) — will replace session event stubs with real Redis writes
- Notification delivery status webhooks (`POST /webhooks/notification/delivery`) — Phase 2 feature

**This is the LAST story in Epic 6.** After completion, the SM should run `*ER` (Epic Retrospective).

### Project Structure Notes

- All new files follow the established `src/modules/communication/` DDD structure
- Controller `NotificationController` uses `@Controller('notifications')` — plural kebab-case per API conventions
- New controller lives alongside `ProactiveNotificationController` in `infrastructure/http/`
- No new DI tokens needed — reuses `NOTIFICATION_PORT_TOKEN`
- No new port registration needed — extends existing `notification` adapter

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.3: Notification Preferences & History]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Module Structure (line ~1101)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port 13: INotificationPort methods (line ~515)]
- [Source: _bmad-output/planning-artifacts/prd.md#FR56-FR57 (Notification Preferences & History)]
- [Source: _bmad-output/project-context.md#Notification Module — DispatchNotificationCommand]
- [Source: config/api-endpoints.yaml#notification (lines 212-223) — methods already defined]
- [Source: src/modules/communication/communication.module.ts — module to extend]
- [Source: src/modules/communication/infrastructure/ports/notification.port.ts — adapter to extend]
- [Source: src/modules/communication/infrastructure/http/proactive-notification.controller.ts — controller pattern reference]
- [Source: src/modules/communication/application/commands/handlers/acknowledge-alert.handler.ts — command handler pattern reference]
- [Source: src/modules/communication/application/queries/handlers/get-active-alerts.handler.ts — query handler pattern reference]
- [Source: src/modules/communication/application/dtos/notification.dto.ts — NotificationChannelSchema + NotificationTypeSchema to reuse]
- [Source: Story 6-2 (previous story) — all learnings and patterns established]

## Dev Agent Record

### Agent Model Used

Claude (glm-5[1m])

### Debug Log References

- All 972 tests pass across 101 test suites (zero regressions)

### Completion Notes List

- ✅ Task 1: Created `notification-preferences.dto.ts` with all 8 Zod schemas + types. Reused `NotificationChannelSchema` and `NotificationTypeSchema` from `notification.dto.ts`.
- ✅ Task 2: Extended `MockNotificationAdapter` with 3 new method schemas (`get-notification-preferences`, `update-notification-preferences`, `get-notification-history`). Created 3 mock JSON files with realistic Vietnamese content.
- ✅ Task 3: Created `GetNotificationPreferencesQuery` + `Handler`. Follows existing pattern: PortRegistry → null guard → PortFallbackException.
- ✅ Task 4: Created `UpdateNotificationPreferencesCommand` + `Handler`. Includes `useCache: false` for write operation.
- ✅ Task 5: Created `GetNotificationHistoryQuery` + `Handler`. Spreads filters into port params for date/channel/type filtering.
- ✅ Task 6: Created `NotificationController` with 3 endpoints: GET /preferences, PATCH /preferences, GET /history. Zod validation on PATCH body and GET query params. `z.coerce.number()` for query params.
- ✅ Task 7: Updated `CommunicationModule` with `NotificationController` + 3 handlers. Updated all barrel exports.
- ✅ Task 8: Wrote 4 new spec files + updated port spec. Tests cover success paths, null guards, validation edge cases, filter passthrough, critical channel verification.
- ✅ Code Review Fix (HIGH-1): Created dedicated `notification-preferences.dto.spec.ts` with 44 comprehensive DTO schema tests — was missing from original implementation.
- ✅ Code Review Fix (HIGH-2): Added `.refine()` to `NotificationHistoryQuerySchema` to validate `startDate ≤ endDate` — prevents inverted date ranges from passing validation silently.
- ✅ Code Review Fix (MEDIUM-3): Updated mock JSON files to mark both `push` and `in_app` as `isCritical: true`, better representing AC#1's requirement that water cutoff, payment status, and widespread incident channels are always enabled. Updated all corresponding test fixtures.

### File List

**NEW files:**
- `src/modules/communication/application/dtos/notification-preferences.dto.ts`
- `src/modules/communication/application/dtos/notification-preferences.dto.spec.ts` ← code review fix
- `src/modules/communication/application/queries/get-notification-preferences.query.ts`
- `src/modules/communication/application/queries/handlers/get-notification-preferences.handler.ts`
- `src/modules/communication/application/queries/get-notification-history.query.ts`
- `src/modules/communication/application/queries/handlers/get-notification-history.handler.ts`
- `src/modules/communication/application/commands/update-notification-preferences.command.ts`
- `src/modules/communication/application/commands/handlers/update-notification-preferences.handler.ts`
- `src/modules/communication/infrastructure/http/notification.controller.ts`
- `mocks/notification/get-notification-preferences.json`
- `mocks/notification/update-notification-preferences.json`
- `mocks/notification/get-notification-history.json`
- `src/modules/communication/application/queries/handlers/get-notification-preferences.handler.spec.ts`
- `src/modules/communication/application/queries/handlers/get-notification-history.handler.spec.ts`
- `src/modules/communication/application/commands/handlers/update-notification-preferences.handler.spec.ts`
- `src/modules/communication/infrastructure/http/notification.controller.spec.ts`

**MODIFIED files:**
- `src/modules/communication/infrastructure/ports/notification.port.ts` — added 3 method schemas
- `src/modules/communication/infrastructure/ports/notification.port.spec.ts` — added tests for 3 new schemas
- `src/modules/communication/communication.module.ts` — added NotificationController + 3 handlers
- `src/modules/communication/application/commands/index.ts` — added barrel export
- `src/modules/communication/application/queries/index.ts` — added barrel exports
- `src/modules/communication/application/index.ts` — added barrel exports
- `src/modules/communication/application/dtos/notification-preferences.dto.ts` — added `.refine()` for startDate ≤ endDate ← code review fix
- `mocks/notification/get-notification-preferences.json` — updated critical channels ← code review fix
- `mocks/notification/update-notification-preferences.json` — updated critical channels ← code review fix
