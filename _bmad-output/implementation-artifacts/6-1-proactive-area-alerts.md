# Story 6.1: Proactive Area Alerts

Status: done

## Story

As a **customer (Cô Nguyễn)**,
I want to receive alerts about water outages and maintenance in my area,
so that I can prepare and not be caught off guard.

## Acceptance Criteria

### AC1: Active Alerts (FR50, FR51)
**Given** an authenticated customer navigates to "Active Alerts"
**When** the BFF receives the request
**Then** it calls `IProactiveNotificationPort.getActiveAlerts(customerId)` via PortRegistry
**And** returns only alerts currently active and relevant to the customer's service address
**And** each alert includes: type (outage/maintenance/quality), description, affected area, expected start/end time, current status.

### AC2: Alert History (FR52)
**Given** an authenticated customer navigates to "Alert History"
**When** the BFF receives the request with optional date filters
**Then** it calls `IProactiveNotificationPort.getAlertHistory(customerId, filters)` via PortRegistry
**And** returns a chronological list of past alerts with resolution status.

### AC3: Acknowledge Alert (FR53)
**Given** an authenticated customer views an active alert
**When** they tap "Acknowledge"
**Then** it calls `IProactiveNotificationPort.acknowledgeAlert(alertId, customerId)` via PortRegistry with `useCache: false`
**And** records the acknowledgement — the customer no longer sees the "new alert" badge for this alert.

### AC4: Dynamic Cache Tier
**Given** alert data is fetched successfully
**When** the response is cached
**Then** the cache key follows `cache:v2:port:proactive-notification:{hash}` with TTL 5-15 min (dynamic tier).

### AC5: Circuit Breaker Fallback
**Given** the Proactive Communication Service is down
**When** the BFF attempts to fetch alerts
**Then** the Circuit Breaker returns cached data with a "last updated" timestamp
**And** if no cache exists, returns a graceful "Alert data temporarily unavailable" message.

## Tasks / Subtasks

- [x] Task 1: Create Communication Module Scaffold (AC: all)
  - [x] Create `src/modules/communication/communication.module.ts` — module shell with `OnModuleInit`
  - [x] Create `src/modules/communication/constants/tokens.ts` — `PROACTIVE_NOTIFICATION_PORT_TOKEN = Symbol('IProactiveNotificationPort')`
  - [x] Create `src/modules/communication/domain/index.ts` — empty barrel (BFF has no domain logic)
  - [x] Create `src/modules/communication/application/index.ts` — barrel export

- [x] Task 2: Create Proactive Notification DTOs (AC: #1, #2, #3)
  - [x] Create `src/modules/communication/application/dtos/proactive-notification.dto.ts`
  - [x] `AlertTypeSchema` — `z.enum(['outage', 'maintenance', 'quality'])`
  - [x] `AlertStatusSchema` — `z.enum(['active', 'resolved', 'scheduled'])`
  - [x] `ActiveAlertSchema` — `{ id, type, description, affectedArea, expectedStartTime, expectedEndTime, status, severity? }`
  - [x] `GetActiveAlertsResponseSchema` — `{ alerts: ActiveAlertSchema[], totalCount: number }`
  - [x] `AlertHistoryItemSchema` — `{ id, type, description, affectedArea, startTime, endTime, status, resolvedAt? }`
  - [x] `AlertHistoryQuerySchema` — `{ startDate?, endDate?, page?, pageSize? }` (controller query params)
  - [x] `AlertHistoryResponseSchema` — `{ alerts: AlertHistoryItemSchema[], totalCount, page, pageSize }`
  - [x] `AcknowledgeAlertResponseSchema` — `{ alertId, customerId, acknowledgedAt }`
  - [x] `AlertIdParamSchema` — `z.string().min(1)` for `:alertId` route param validation
  - [x] Export all TypeScript types

- [x] Task 3: Create Proactive Notification Port & Mock Adapter (AC: all)
  - [x] Create `src/modules/communication/infrastructure/ports/proactive-notification.port.ts`
  - [x] `IProactiveNotificationPort` interface extending `IPortAdapter`
  - [x] `MockProactiveNotificationAdapter` extending `MockAdapterBase` with schemas for: `get-active-alerts`, `get-alert-history`, `acknowledge-alert`
  - [x] Create `mocks/proactive-notification/get-active-alerts.json` — 2 active alerts (outage + maintenance)
  - [x] Create `mocks/proactive-notification/get-alert-history.json` — 3 resolved past alerts
  - [x] Create `mocks/proactive-notification/acknowledge-alert.json` — acknowledgement response

- [x] Task 4: Create Alert Query Handlers (AC: #1, #2, #4, #5)
  - [x] Create `src/modules/communication/application/queries/get-active-alerts.query.ts` + `GetActiveAlertsQuery extends IQuery`
  - [x] Create `src/modules/communication/application/queries/handlers/get-active-alerts.handler.ts` — calls `portRegistry.execute('proactive-notification', 'get-active-alerts', { customerId })`, null guard with `PortFallbackException`
  - [x] Create `src/modules/communication/application/queries/get-alert-history.query.ts` + `GetAlertHistoryQuery extends IQuery`
  - [x] Create `src/modules/communication/application/queries/handlers/get-alert-history.handler.ts` — calls `portRegistry.execute('proactive-notification', 'get-alert-history', { customerId, ...filters })`, null guard with `PortFallbackException`
  - [x] Create `src/modules/communication/application/queries/index.ts` — barrel export

- [x] Task 5: Create Acknowledge Alert Command + Handler (AC: #3)
  - [x] Create `src/modules/communication/application/commands/acknowledge-alert.command.ts` — `AcknowledgeAlertCommand extends ICommand`
  - [x] Create `src/modules/communication/application/commands/handlers/acknowledge-alert.handler.ts` — calls `portRegistry.execute('proactive-notification', 'acknowledge-alert', { alertId, customerId })` with `useCache: false`, null guard with `PortFallbackException`
  - [x] Create `src/modules/communication/application/commands/index.ts` — barrel export

- [x] Task 6: Create Proactive Notification Controller (AC: #1, #2, #3)
  - [x] Create `src/modules/communication/infrastructure/http/proactive-notification.controller.ts`
  - [x] `GET /proactive-notifications/active` → dispatch `GetActiveAlertsQuery`
  - [x] `GET /proactive-notifications/history` → dispatch `GetAlertHistoryQuery` (query params: startDate, endDate, page, pageSize)
  - [x] `POST /proactive-notifications/:alertId/acknowledge` → dispatch `AcknowledgeAlertCommand`
  - [x] Inject BOTH `QUERY_BUS_TOKEN` and `COMMAND_BUS_TOKEN`
  - [x] Validate `alertId` param with `AlertIdParamSchema` via `Schema.safeParse()`
  - [x] ⚠️ **Route ordering**: `GET /history` MUST be defined BEFORE any dynamic `:alertId` routes

- [x] Task 7: Register Communication Module (AC: all)
  - [x] Update `src/modules/communication/communication.module.ts`:
    - [x] `useExisting` for `PROACTIVE_NOTIFICATION_PORT_TOKEN` → `MockProactiveNotificationAdapter`
    - [x] Add all query + command handlers to providers
    - [x] Add `ProactiveNotificationController` to controllers
    - [x] `onModuleInit` → `portRegistry.register('proactive-notification', mockAdapter, mockAdapter)`
  - [x] Update `src/app.module.ts` — add `CommunicationModule` after `TicketModule`, before `AuthPropagationModule`
  - [x] Update barrel exports

- [x] Task 8: Write comprehensive tests (AC: all)
  - [x] `proactive-notification.port.spec.ts` — mock adapter reads all 3 JSON files, validates schemas
  - [x] `get-active-alerts.handler.spec.ts` — verify PortRegistry call, null data → `PortFallbackException`, undefined result → `PortFallbackException`
  - [x] `get-alert-history.handler.spec.ts` — verify PortRegistry call with filters + null guards
  - [x] `acknowledge-alert.handler.spec.ts` — verify `useCache: false`, null guard
  - [x] `proactive-notification.controller.spec.ts` — all 3 endpoints, query param validation, alertId validation, `toBeInstanceOf()` assertions, auth guard

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story creates the **first endpoints in the Communication module** (`modules/communication/`). The module will eventually host THREE ports across Epics 6+7:
- `proactive-notification` (MVP, Story 6.1 — **this story**)
- `notification` (MVP, Story 6.2+6.3)
- Campaign (Phase 3)

This story follows the EXACT same pattern as every domain module since Story 2.1. The "two ports, one module" pattern from billing/meter/payment is extended here to "multiple ports, one module."

**BFF is a pure pass-through.** The Proactive Communication Service downstream handles GIS area matching (which KH are affected by which incident), alert lifecycle, and acknowledgement persistence. BFF only: validates schema, calls port, returns result.

#### What ALREADY EXISTS — DO NOT RECREATE

| Component | Location | Status |
|-----------|----------|--------|
| **PortRegistry** | `src/libs/shared/port/port-registry.service.ts` | ✅ Exists — USE `register()` + `execute<T>()` |
| **MockAdapterBase** | `src/libs/shared/port/mock-adapter.base.ts` | ✅ Exists — EXTEND this |
| **IPortAdapter** | `src/libs/shared/port/port.interface.ts` | ✅ Exists — IMPLEMENT this |
| **PortFallbackException** | `src/libs/shared/port/port-exceptions.ts` | ✅ Exists — USE for null guards |
| **SessionAuthGuard + @CurrentUser()** | `src/modules/auth/infrastructure/` | ✅ Exists — USE `@CurrentUser('id') userId: string` |
| **QUERY_BUS_TOKEN / COMMAND_BUS_TOKEN** | `src/core/constants/tokens.ts` | ✅ Exists — INJECT both |
| **CircuitBreakerState** | `src/libs/shared/resilience/` | ✅ Exists — PortRegistry handles per-port CB |
| **CacheService** | `src/libs/shared/caching/` | ✅ Exists — PortRegistry handles cache tiers |
| **api-endpoints.yaml** | `config/api-endpoints.yaml` | ✅ Already has `proactive-notification` config |

#### What ALREADY EXISTS in Other Modules — REUSE AS TEMPLATE

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **Ticket module** (3 ports) | `src/modules/ticket/` | EXACT TEMPLATE — multiple ports in one module, query + command handlers, webhook pattern |
| **Payment module** (2 ports) | `src/modules/payment/` | TEMPLATE — two ports with different cache tiers |
| **Billing module** (2 ports) | `src/modules/billing/` | TEMPLATE — tariff (static) + invoice (dynamic) |
| **Knowledge-base controller** | `src/modules/ticket/infrastructure/http/knowledge-base.controller.ts` | TEMPLATE — separate controller for non-overlapping DTOs within same module |

#### ⚡ Key Architecture Points

1. **Port name**: `'proactive-notification'` (kebab-case) — matches `api-endpoints.yaml` config key
2. **Cache tier**: `dynamic` (900s = 15 min) — alerts change frequently but don't need real-time
3. **Acknowledgement is a WRITE** → use `COMMAND_BUS_TOKEN` + `useCache: false`
4. **Active alerts + history are READs** → use `QUERY_BUS_TOKEN`
5. **No domain layer** — BFF doesn't own alert data. `domain/index.ts` is empty barrel.
6. **No webhook in this story** — inbound webhooks for notification delivery status come in Story 6.2

### 📁 File Structure — Changes

```
src/modules/communication/                          ← NEW MODULE
├── application/
│   ├── commands/
│   │   ├── acknowledge-alert.command.ts            ← NEW (AC#3)
│   │   ├── handlers/
│   │   │   └── acknowledge-alert.handler.ts        ← NEW (AC#3)
│   │   └── index.ts                                ← NEW
│   ├── queries/
│   │   ├── get-active-alerts.query.ts              ← NEW (AC#1)
│   │   ├── get-alert-history.query.ts              ← NEW (AC#2)
│   │   ├── handlers/
│   │   │   ├── get-active-alerts.handler.ts        ← NEW (AC#1)
│   │   │   └── get-alert-history.handler.ts        ← NEW (AC#2)
│   │   └── index.ts                                ← NEW
│   ├── dtos/
│   │   └── proactive-notification.dto.ts           ← NEW
│   └── index.ts                                    ← NEW
├── domain/
│   └── index.ts                                    ← NEW (empty barrel)
├── infrastructure/
│   ├── http/
│   │   ├── proactive-notification.controller.ts    ← NEW
│   │   └── proactive-notification.controller.spec.ts ← NEW
│   └── ports/
│       ├── proactive-notification.port.ts          ← NEW
│       └── proactive-notification.port.spec.ts     ← NEW
├── constants/
│   └── tokens.ts                                   ← NEW
└── communication.module.ts                         ← NEW

mocks/proactive-notification/                        ← NEW directory
├── get-active-alerts.json                           ← NEW
├── get-alert-history.json                           ← NEW
└── acknowledge-alert.json                           ← NEW
```

**MODIFIED files:**
- `src/app.module.ts` — add `CommunicationModule` import

### 🔧 Implementation Details

#### DI Token (`constants/tokens.ts`)
```typescript
export const PROACTIVE_NOTIFICATION_PORT_TOKEN = Symbol('IProactiveNotificationPort');
```

#### Proactive Notification DTOs — NEW FILE
```typescript
// src/modules/communication/application/dtos/proactive-notification.dto.ts
import { z } from 'zod';

// =============================================================================
// AC#1: Active Alerts
// =============================================================================

export const AlertTypeSchema = z.enum(['outage', 'maintenance', 'quality']);

export const AlertStatusSchema = z.enum(['active', 'resolved', 'scheduled']);

export const ActiveAlertSchema = z.object({
  id: z.string().min(1),
  type: AlertTypeSchema,
  description: z.string().min(1),
  affectedArea: z.string().min(1),
  expectedStartTime: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  expectedEndTime: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  status: AlertStatusSchema,
  severity: z.enum(['low', 'medium', 'high']).optional(),
});

export const GetActiveAlertsResponseSchema = z.object({
  alerts: z.array(ActiveAlertSchema),
  totalCount: z.number(),
});

// =============================================================================
// AC#2: Alert History
// =============================================================================

export const AlertHistoryItemSchema = z.object({
  id: z.string().min(1),
  type: AlertTypeSchema,
  description: z.string().min(1),
  affectedArea: z.string().min(1),
  startTime: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  endTime: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  status: AlertStatusSchema,
  resolvedAt: z.string().nullable(),
});

export const AlertHistoryQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

export const AlertHistoryResponseSchema = z.object({
  alerts: z.array(AlertHistoryItemSchema),
  totalCount: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

// =============================================================================
// AC#3: Acknowledge Alert
// =============================================================================

export const AcknowledgeAlertResponseSchema = z.object({
  alertId: z.string().min(1),
  customerId: z.string().min(1),
  acknowledgedAt: z.string(),
});

// =============================================================================
// Shared Validation
// =============================================================================

export const AlertIdParamSchema = z.object({
  alertId: z.string().min(1).regex(/^[a-zA-Z0-9-_]+$/),
});

// =============================================================================
// TypeScript Types
// =============================================================================

export type AlertType = z.infer<typeof AlertTypeSchema>;
export type AlertStatus = z.infer<typeof AlertStatusSchema>;
export type ActiveAlert = z.infer<typeof ActiveAlertSchema>;
export type GetActiveAlertsResponse = z.infer<typeof GetActiveAlertsResponseSchema>;
export type AlertHistoryItem = z.infer<typeof AlertHistoryItemSchema>;
export type AlertHistoryQuery = z.infer<typeof AlertHistoryQuerySchema>;
export type AlertHistoryResponse = z.infer<typeof AlertHistoryResponseSchema>;
export type AcknowledgeAlertResponse = z.infer<typeof AcknowledgeAlertResponseSchema>;
```

#### Port & Mock Adapter
```typescript
// src/modules/communication/infrastructure/ports/proactive-notification.port.ts
import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  GetActiveAlertsResponseSchema,
  AlertHistoryResponseSchema,
  AcknowledgeAlertResponseSchema,
} from '../../application/dtos/proactive-notification.dto';

export interface IProactiveNotificationPort extends IPortAdapter {}

@Injectable()
export class MockProactiveNotificationAdapter extends MockAdapterBase implements IProactiveNotificationPort {
  constructor() {
    super(
      'proactive-notification',
      {
        'get-active-alerts': GetActiveAlertsResponseSchema,
        'get-alert-history': AlertHistoryResponseSchema,
        'acknowledge-alert': AcknowledgeAlertResponseSchema,
      },
      new Logger('proactive-notification-mock-adapter'),
    );
  }
}
```

#### Query: Get Active Alerts
```typescript
// get-active-alerts.query.ts
import { IQuery } from '@core/application';
import type { GetActiveAlertsResponse } from '../../dtos/proactive-notification.dto';

export class GetActiveAlertsQuery extends IQuery<GetActiveAlertsResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}

export type GetActiveAlertsResult = GetActiveAlertsResponse;
```

```typescript
// get-active-alerts.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetActiveAlertsQuery } from '../get-active-alerts.query';
import type { GetActiveAlertsResponse } from '../../dtos/proactive-notification.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

@QueryHandler(GetActiveAlertsQuery)
export class GetActiveAlertsHandler implements IQueryHandler<GetActiveAlertsQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetActiveAlertsQuery): Promise<GetActiveAlertsResponse> {
    const result = await this.portRegistry.execute<GetActiveAlertsResponse>(
      'proactive-notification',
      'get-active-alerts',
      { customerId: query.customerId },
    );

    if (!result?.data) {
      throw new PortFallbackException('proactive-notification');
    }

    return result.data;
  }
}
```

#### Query: Get Alert History
```typescript
// get-alert-history.query.ts
import { IQuery } from '@core/application';
import type { AlertHistoryResponse, AlertHistoryQuery } from '../../dtos/proactive-notification.dto';

export class GetAlertHistoryQuery extends IQuery<AlertHistoryResponse> {
  constructor(
    public readonly customerId: string,
    public readonly filters?: Partial<AlertHistoryQuery>,
  ) {
    super();
  }
}

export type GetAlertHistoryResult = AlertHistoryResponse;
```

```typescript
// get-alert-history.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetAlertHistoryQuery } from '../get-alert-history.query';
import type { AlertHistoryResponse } from '../../dtos/proactive-notification.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

@QueryHandler(GetAlertHistoryQuery)
export class GetAlertHistoryHandler implements IQueryHandler<GetAlertHistoryQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetAlertHistoryQuery): Promise<AlertHistoryResponse> {
    const result = await this.portRegistry.execute<AlertHistoryResponse>(
      'proactive-notification',
      'get-alert-history',
      { customerId: query.customerId, ...query.filters },
    );

    if (!result?.data) {
      throw new PortFallbackException('proactive-notification');
    }

    return result.data;
  }
}
```

#### Command: Acknowledge Alert
```typescript
// acknowledge-alert.command.ts
import { ICommand } from '@core/application';
import type { AcknowledgeAlertResponse } from '../../dtos/proactive-notification.dto';

export class AcknowledgeAlertCommand implements ICommand {
  constructor(
    public readonly alertId: string,
    public readonly customerId: string,
  ) {}
}

export type AcknowledgeAlertResult = AcknowledgeAlertResponse;
```

```typescript
// acknowledge-alert.handler.ts
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { AcknowledgeAlertCommand } from '../acknowledge-alert.command';
import type { AcknowledgeAlertResponse } from '../../dtos/proactive-notification.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

@CommandHandler(AcknowledgeAlertCommand)
export class AcknowledgeAlertHandler implements ICommandHandler<AcknowledgeAlertCommand> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: AcknowledgeAlertCommand): Promise<AcknowledgeAlertResponse> {
    const result = await this.portRegistry.execute<AcknowledgeAlertResponse>(
      'proactive-notification',
      'acknowledge-alert',
      { alertId: command.alertId, customerId: command.customerId },
      undefined, // no idempotency key
      { useCache: false }, // WRITE operation — skip cache
    );

    if (!result?.data) {
      throw new PortFallbackException('proactive-notification');
    }

    return result.data;
  }
}
```

#### Controller — NEW FILE
```typescript
// src/modules/communication/infrastructure/http/proactive-notification.controller.ts
import { Controller, Get, Post, Query, Param, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import { COMMAND_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import type { ICommandBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetActiveAlertsQuery } from '../../application/queries/get-active-alerts.query';
import { GetAlertHistoryQuery } from '../../application/queries/get-alert-history.query';
import { AcknowledgeAlertCommand } from '../../application/commands/acknowledge-alert.command';
import { AlertHistoryQuerySchema, AlertIdParamSchema } from '../../application/dtos/proactive-notification.dto';
import { ValidationException } from '@core/common';

@ApiTags('Proactive Alerts')
@ApiBearerAuth('JWT-auth')
@Controller('proactive-notifications')
export class ProactiveNotificationController {

  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  /**
   * GET /proactive-notifications/active
   * Get active alerts for customer's area (AC#1)
   */
  @Get('active')
  @ApiOperation({ summary: 'Get active alerts for customer area' })
  async getActiveAlerts(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetActiveAlertsQuery(userId));
  }

  /**
   * GET /proactive-notifications/history
   * Get alert history with optional filters (AC#2)
   *
   * ⚠️ MUST be defined BEFORE @Get(':alertId') routes — NestJS route ordering
   */
  @Get('history')
  @ApiOperation({ summary: 'Get alert history' })
  async getAlertHistory(
    @CurrentUser('id') userId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const validated = AlertHistoryQuerySchema.safeParse(query);
    if (!validated.success) {
      throw new ValidationException(validated.error.message);
    }
    return this.queryBus.execute(new GetAlertHistoryQuery(userId, validated.data));
  }

  /**
   * POST /proactive-notifications/:alertId/acknowledge
   * Acknowledge an alert (AC#3)
   */
  @Post(':alertId/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  async acknowledgeAlert(
    @CurrentUser('id') userId: string,
    @Param() params: Record<string, string>,
  ) {
    const validated = AlertIdParamSchema.safeParse(params);
    if (!validated.success) {
      throw new ValidationException(validated.error.message);
    }
    return this.commandBus.execute(
      new AcknowledgeAlertCommand(validated.data.alertId, userId),
    );
  }
}
```

#### CommunicationModule
```typescript
// src/modules/communication/communication.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { ProactiveNotificationController } from './infrastructure/http/proactive-notification.controller';
import { MockProactiveNotificationAdapter } from './infrastructure/ports/proactive-notification.port';
import { PROACTIVE_NOTIFICATION_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetActiveAlertsHandler } from './application/queries/handlers/get-active-alerts.handler';
import { GetAlertHistoryHandler } from './application/queries/handlers/get-alert-history.handler';
import { AcknowledgeAlertHandler } from './application/commands/handlers/acknowledge-alert.handler';

@Module({
  controllers: [ProactiveNotificationController],
  providers: [
    // Port Adapter (single instance via useExisting)
    MockProactiveNotificationAdapter,
    {
      provide: PROACTIVE_NOTIFICATION_PORT_TOKEN,
      useExisting: MockProactiveNotificationAdapter,
    },
    // Query Handlers
    GetActiveAlertsHandler,
    GetAlertHistoryHandler,
    // Command Handlers
    AcknowledgeAlertHandler,
  ],
  exports: [PROACTIVE_NOTIFICATION_PORT_TOKEN],
})
export class CommunicationModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockProactiveNotificationAdapter: MockProactiveNotificationAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register(
      'proactive-notification',
      this.mockProactiveNotificationAdapter,
      this.mockProactiveNotificationAdapter,
    );
  }
}
```

#### Mock JSON Files

`mocks/proactive-notification/get-active-alerts.json`:
```json
{
  "alerts": [
    {
      "id": "ALERT-2026-001",
      "type": "outage",
      "description": "Cúp nước bảo trì đường ống Nguyễn Văn Cừ — Khu vực Quận 1",
      "affectedArea": "Quận 1, Phường Bến Nghé",
      "expectedStartTime": "2026-06-12T08:00:00+07:00",
      "expectedEndTime": "2026-06-12T18:00:00+07:00",
      "status": "active",
      "severity": "high"
    },
    {
      "id": "ALERT-2026-002",
      "type": "maintenance",
      "description": "Bảo trì định kỳ trạm bơm Tân Thuận",
      "affectedArea": "Quận 7, Phường Tân Thuận Đông",
      "expectedStartTime": "2026-06-15T06:00:00+07:00",
      "expectedEndTime": "2026-06-15T12:00:00+07:00",
      "status": "scheduled",
      "severity": "medium"
    }
  ],
  "totalCount": 2
}
```

`mocks/proactive-notification/get-alert-history.json`:
```json
{
  "alerts": [
    {
      "id": "ALERT-2026-000",
      "type": "quality",
      "description": "Chất lượng nước khu vực Thủ Đức — đã khắc phục",
      "affectedArea": "Thủ Đức, Phường Linh Trung",
      "startTime": "2026-05-20T10:00:00+07:00",
      "endTime": "2026-05-20T16:30:00+07:00",
      "status": "resolved",
      "resolvedAt": "2026-05-20T16:30:00+07:00"
    },
    {
      "id": "ALERT-2025-047",
      "type": "outage",
      "description": "Sự cố vỡ ống nước đường Lê Văn Sỹ",
      "affectedArea": "Quận 3, Phường Võ Thị Sáu",
      "startTime": "2025-12-01T09:00:00+07:00",
      "endTime": "2025-12-01T15:00:00+07:00",
      "status": "resolved",
      "resolvedAt": "2025-12-01T15:00:00+07:00"
    },
    {
      "id": "ALERT-2025-032",
      "type": "maintenance",
      "description": "Bảo trì trạm xử lý nước Tân Hiệp",
      "affectedArea": "Huyện Củ Chi, Xã Tân Hiệp",
      "startTime": "2025-11-10T07:00:00+07:00",
      "endTime": "2025-11-10T14:00:00+07:00",
      "status": "resolved",
      "resolvedAt": "2025-11-10T14:00:00+07:00"
    }
  ],
  "totalCount": 3,
  "page": 1,
  "pageSize": 20
}
```

`mocks/proactive-notification/acknowledge-alert.json`:
```json
{
  "alertId": "ALERT-2026-001",
  "customerId": "USR-001",
  "acknowledgedAt": "2026-06-10T14:30:00+07:00"
}
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Implement alert filtering/area-matching in BFF | Pass `customerId` to downstream — Proactive Communication Service handles GIS area matching |
| Mix proactive-notification port into `notification.port.ts` | Create separate `proactive-notification.port.ts` — different port, different downstream service |
| Create a `notification` module | Use `communication` module per architecture — will host both `proactive-notification` and `notification` ports |
| Cache acknowledgement responses | `useCache: false` — acknowledgement is a write operation |
| Use `IQueryBus` for acknowledge endpoint | Use `ICommandBus` — acknowledgement is a WRITE operation |
| Put `@Get('history')` AFTER `@Get(':alertId')` | Static paths MUST come before dynamic params — NestJS route ordering gotcha (Story 5.4 lesson) |
| Throw `NotFoundException` for downstream failures | Use `PortFallbackException` (HTTP 500) — downstream failure ≠ resource not found |
| Check `!result.data` without optional chaining | Use `!result?.data` — handles both null data and undefined result |
| Create domain entities or value objects | BFF doesn't own alert data — empty `domain/index.ts` barrel only |

### 🔧 Important Implementation Notes

1. **Module registration order** in `app.module.ts`: `...TicketModule → CommunicationModule → AuthPropagationModule → PortModule`
2. **`proactive-notification` port config already exists** in `api-endpoints.yaml` — no YAML changes needed
3. **No webhook in this story** — notification delivery webhooks come in Story 6.2
4. **`AlertHistoryQuerySchema` uses `z.coerce.number()`** for `page`/`pageSize` query params (URL strings → number coercion)
5. **Alert IDs allow dashes/underscores** — regex `/^[a-zA-Z0-9-_]+$/` matches patterns like `ALERT-2026-001`

### 🧪 Testing Requirements

1. **MockAdapter — get-active-alerts** — Read JSON, validate `GetActiveAlertsResponseSchema` (alerts array + totalCount)
2. **MockAdapter — get-alert-history** — Read JSON, validate `AlertHistoryResponseSchema` (history items + pagination)
3. **MockAdapter — acknowledge-alert** — Read JSON, validate `AcknowledgeAlertResponseSchema`
4. **Handler — get-active-alerts** — Verify `portRegistry.execute('proactive-notification', 'get-active-alerts', { customerId })`; null data → `PortFallbackException`; undefined result → `PortFallbackException`
5. **Handler — get-alert-history** — Verify PortRegistry call with customerId + filters; null guards
6. **Handler — acknowledge-alert** — Verify `useCache: false` in params; null guard
7. **Controller — GET /proactive-notifications/active** — Returns active alerts
8. **Controller — GET /proactive-notifications/history** — Returns history, validates query params (invalid date → 400)
9. **Controller — POST /proactive-notifications/:alertId/acknowledge** — Validates alertId (empty → 400, special chars → 400)
10. **Controller — query class types** — `toBeInstanceOf()` for `GetActiveAlertsQuery`, `GetAlertHistoryQuery`, `AcknowledgeAlertCommand`

### Previous Story Learnings (Stories 1.1–5.4 — MUST Apply)

- **Module pattern**: `useExisting` for DI token, `onModuleInit` for port registration, `MockAdapterBase` extension
- **Handler null guard**: Always `!result?.data` — throw `PortFallbackException` (never `NotFoundException`)
- **Controller validation**: `Schema.safeParse(query/params)` → `throw new ValidationException(validated.error.message)`
- **Controller dual bus**: Inject both `QUERY_BUS_TOKEN` and `COMMAND_BUS_TOKEN` when module has reads + writes
- **NestJS route ordering**: Static paths (`/active`, `/history`) BEFORE dynamic params (`:alertId`)
- **Write operations**: Always `useCache: false` in params
- **Barrel exports**: Update `commands/index.ts`, `queries/index.ts`, `application/index.ts` after adding files
- **DTO validation**: `.min(1)` on string IDs, `.regex()` on date fields, `z.coerce.number()` for query params

### 📋 Cross-Story Context

**Depends on (all complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Story R-1 (SessionAuthGuard + @CurrentUser decorator)
- Stories 4.1–4.5 (Payment module — webhook/cache pattern reference)

**Independent of:**
- Story 6.2 (Multi-Channel Dispatch) — 6.2 adds a different port (`notification`) to the same module
- Story 6.3 (Notification Preferences) — 6.3 adds `INotificationPort` read/write endpoints

**Enables (future stories):**
- Story 6.2 will add `notification` port + `DispatchNotificationCommand` to `CommunicationModule`
- Story 6.3 will add `notification.controller.ts` + preference endpoints

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1: Proactive Area Alerts]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port 12: proactive-notification]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Module Structure (lines 1101-1122)]
- [Source: _bmad-output/planning-artifacts/architecture.md#api-endpoints.yaml — proactive-notification config]
- [Source: _bmad-output/planning-artifacts/prd.md#FR50-FR53 (Proactive Notifications)]
- [Source: _bmad-output/planning-artifacts/prd.md#Journey 10 — Proactive Alert Flow]
- [Source: _bmad-output/project-context.md#Cache TTL Strategy — dynamic tier 5-15 min]
- [Source: src/modules/ticket/ticket.module.ts — Multiple ports in one module TEMPLATE]
- [Source: src/modules/ticket/infrastructure/http/knowledge-base.controller.ts — Separate controller TEMPLATE]
- [Source: src/modules/ticket/application/queries/handlers/get-ticket-status.handler.ts — PortFallbackException TEMPLATE]
- [Source: config/api-endpoints.yaml#proactive-notification — port config already defined]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (glm-5[1m])

### Debug Log References

- 93 test suites, 830 tests — ZERO regressions
- 32 new tests across 5 spec files in communication module
- TS compilation clean for all communication module files

### Completion Notes List

- ✅ Task 1: Created communication module scaffold — tokens, domain barrel, application barrel
- ✅ Task 2: Created `proactive-notification.dto.ts` — 11 Zod schemas + 8 TypeScript types, AlertType/Status enums, AlertHistoryQuerySchema with z.coerce for query params, AlertIdParamSchema with regex validation
- ✅ Task 3: Created `MockProactiveNotificationAdapter` extending MockAdapterBase with 3 schemas + 3 mock JSON files with realistic Vietnamese alert data
- ✅ Task 4: Created GetActiveAlertsQuery + handler, GetAlertHistoryQuery + handler — both use `result?.data` optional chaining + `PortFallbackException` null guard
- ✅ Task 5: Created AcknowledgeAlertCommand + handler — `useCache: false` in params object (3-arg execute pattern), `PortFallbackException` null guard
- ✅ Task 6: Created ProactiveNotificationController — dual bus injection, route ordering (static before dynamic), Zod safeParse validation on params + query
- ✅ Task 7: Created CommunicationModule with `useExisting` DI pattern + `onModuleInit` port registration; registered in AppModule after TicketModule
- ✅ Task 8: 32 tests — port spec (4), active alerts handler spec (4), history handler spec (5), acknowledge handler spec (5), controller spec (14 including validation, class type verification, auth guard)
- 🔧 Fix: acknowledge-alert.handler.ts — moved `useCache: false` from 5th arg to params object (matches PortRegistry.execute 4-arg signature)

### File List

**NEW files (18):**
- `src/modules/communication/communication.module.ts`
- `src/modules/communication/constants/tokens.ts`
- `src/modules/communication/domain/index.ts`
- `src/modules/communication/application/index.ts`
- `src/modules/communication/application/dtos/proactive-notification.dto.ts`
- `src/modules/communication/application/queries/get-active-alerts.query.ts`
- `src/modules/communication/application/queries/index.ts`
- `src/modules/communication/application/queries/handlers/get-active-alerts.handler.ts`
- `src/modules/communication/application/queries/get-alert-history.query.ts`
- `src/modules/communication/application/queries/handlers/get-alert-history.handler.ts`
- `src/modules/communication/application/commands/acknowledge-alert.command.ts`
- `src/modules/communication/application/commands/index.ts`
- `src/modules/communication/application/commands/handlers/acknowledge-alert.handler.ts`
- `src/modules/communication/infrastructure/ports/proactive-notification.port.ts`
- `src/modules/communication/infrastructure/ports/proactive-notification.port.spec.ts`
- `src/modules/communication/infrastructure/http/proactive-notification.controller.ts`
- `src/modules/communication/infrastructure/http/proactive-notification.controller.spec.ts`
- `src/modules/communication/application/queries/handlers/get-active-alerts.handler.spec.ts`
- `src/modules/communication/application/queries/handlers/get-alert-history.handler.spec.ts`
- `src/modules/communication/application/commands/handlers/acknowledge-alert.handler.spec.ts`
- `mocks/proactive-notification/get-active-alerts.json`
- `mocks/proactive-notification/get-alert-history.json`
- `mocks/proactive-notification/acknowledge-alert.json`

**MODIFIED files (1):**
- `src/app.module.ts` — added CommunicationModule import + registration after TicketModule
