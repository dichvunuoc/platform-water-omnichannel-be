# Story 5.2: Ticket Tracking & Timeline

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **customer (Cô Nguyễn)**,
I want to track my reported issue with a real-time timeline like Grab/Shopee order tracking,
so that I know exactly what's happening without calling the hotline.

## Acceptance Criteria

### AC1: Ticket Status Lookup (FR43)
**Given** an authenticated customer enters a tracking ID or taps "My Tickets"
**When** the BFF receives the request
**Then** it calls `ITicketPort.getTicketStatus(ticketId)` via PortRegistry
**And** returns: current status, full timeline (submitted → assigned → in progress → resolved → closed), estimated completion time (ETA), and assigned team info.

### AC2: Ticket History List (FR46)
**Given** an authenticated customer navigates to "Ticket History"
**When** the BFF receives the request
**Then** it calls `ITicketPort.getTicketHistory(customerId, filters)` via PortRegistry
**And** returns a list of all tickets with: tracking ID, type, status, creation date, last update.

### AC3: Ticket Status Webhook (FR44)
**Given** the Ticketing Service sends a status change webhook to `POST /webhooks/ticket/status`
**When** the BFF receives it
**Then** it verifies the webhook using `InterServiceApiKeyGuard` (static API key, FR72)
**And** records a session event: `{ type: "ticket_status_changed", ticketId, oldStatus, newStatus }`
**And** invalidates the ticket cache via pattern `cache:port:ticket:{customerId}:*`
**And** dispatches a notification to the customer (Epic 6).

### AC4: Circuit Breaker Fallback (FR43, FR65)
**Given** the Ticketing Service is down
**When** the customer tries to track a ticket
**Then** the Circuit Breaker returns cached ticket data with a "last updated" timestamp
**And** if no cache exists, shows "Ticket tracking temporarily unavailable."

## Tasks / Subtasks

- [x] Task 1: Add Ticket Tracking DTOs (AC: #1, #2)
  - [x] Add `TicketTimelineEntrySchema` — `{ status, timestamp, description?, actor? }`
  - [x] Add `TicketStatusResponseSchema` — `{ trackingId, status, timeline[], eta?, assignedTeam?, createdAt, updatedAt }`
  - [x] Add `TicketHistoryResponseSchema` — `{ tickets: TicketSummarySchema[], total, page, pageSize }`
  - [x] Add `TicketSummarySchema` — `{ trackingId, type, status, createdAt, updatedAt }`
  - [x] Add `TicketHistoryRequestSchema` — `{ status?, page?, pageSize? }` (query params)
  - [x] Add `TicketWebhookPayloadSchema` — `{ ticketId, trackingId, customerId, oldStatus, newStatus, updatedAt }`
  - [x] Export all TypeScript types

- [x] Task 2: Extend MockTicketAdapter with new methods (AC: #1, #2)
  - [x] Add `'get-ticket-status': TicketStatusResponseSchema` to MockTicketAdapter schema map
  - [x] Add `'get-ticket-history': TicketHistoryResponseSchema` to MockTicketAdapter schema map
  - [x] Create `mocks/ticket/get-ticket-status.json` — mock with full timeline + ETA
  - [x] Create `mocks/ticket/get-ticket-history.json` — mock with paginated ticket list

- [x] Task 3: Create Get Ticket Status Query + Handler (AC: #1)
  - [x] Create `src/modules/ticket/application/queries/get-ticket-status.query.ts`
  - [x] Create `src/modules/ticket/application/queries/handlers/get-ticket-status.handler.ts`
  - [x] Handler: inject `PortRegistry`, call `execute('ticket', 'get-ticket-status', { ticketId })`
  - [x] Returns `TicketStatusResponse` with timeline, ETA, assigned team

- [x] Task 4: Create Get Ticket History Query + Handler (AC: #2)
  - [x] Create `src/modules/ticket/application/queries/get-ticket-history.query.ts`
  - [x] Create `src/modules/ticket/application/queries/handlers/get-ticket-history.handler.ts`
  - [x] Handler: inject `PortRegistry`, call `execute('ticket', 'get-ticket-history', { customerId, filters })`
  - [x] Returns paginated `TicketHistoryResponse`

- [x] Task 5: Add Query Endpoints to TicketController (AC: #1, #2)
  - [x] Add `GET /tickets/:trackingId` → dispatch `GetTicketStatusQuery`
  - [x] Add `GET /tickets` → dispatch `GetTicketHistoryQuery` (query params: status, page, pageSize)
  - [x] Inject `QUERY_BUS_TOKEN` alongside `COMMAND_BUS_TOKEN`

- [x] Task 6: Create Ticket Webhook Controller (AC: #3)
  - [x] Create `src/modules/ticket/infrastructure/http/ticket-webhook.controller.ts`
  - [x] `POST /webhooks/ticket/status` — `@Public()` + `@UseGuards(InterServiceApiKeyGuard)`
  - [x] Validate body with `TicketWebhookPayloadSchema`
  - [x] Dispatch `HandleTicketWebhookCommand` for processing

- [x] Task 7: Create Handle Ticket Webhook Command + Handler (AC: #3)
  - [x] Create `src/modules/ticket/application/commands/handle-ticket-webhook.command.ts`
  - [x] Create `src/modules/ticket/application/commands/handlers/handle-ticket-webhook.handler.ts`
  - [x] Handler: invalidate ticket cache via `RedisCacheService.deleteByPattern('cache:port:ticket:*')`
  - [x] Handler: log session event `{ type: "ticket_status_changed", ticketId, oldStatus, newStatus }`
  - [x] Handler: TODO notification dispatch — `DispatchNotificationCommand` not built yet (Epic 6)

- [x] Task 8: Update TicketModule Registration (AC: all)
  - [x] Add `GetTicketStatusHandler` to providers
  - [x] Add `GetTicketHistoryHandler` to providers
  - [x] Add `HandleTicketWebhookHandler` to providers
  - [x] Add `TicketWebhookController` to controllers
  - [x] Update queries barrel export

- [x] Task 9: Write comprehensive tests (AC: all)
  - [x] `get-ticket-status.handler.spec.ts` — verify PortRegistry call with ticketId
  - [x] `get-ticket-history.handler.spec.ts` — verify PortRegistry call with customerId + filters
  - [x] `handle-ticket-webhook.handler.spec.ts` — verify cache invalidation + session event log
  - [x] `ticket.controller.spec.ts` — add tests for GET /tickets/:trackingId, GET /tickets
  - [x] `ticket-webhook.controller.spec.ts` — POST /webhooks/ticket/status, guard, validation
  - [x] `ticket.port.spec.ts` — add tests for get-ticket-status + get-ticket-history mock schemas

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story **EXTENDS** the existing `ticket` module created in Story 5.1. It adds:
1. **Query handlers** (first queries in the ticket module — Story 5.1 was commands only)
2. **Webhook controller** (second webhook in the project — follow payment webhook pattern)
3. **Cache invalidation** (first pattern-based cache purge in the ticket module)

#### What ALREADY EXISTS in Ticket Module (Story 5.1) — DO NOT RECREATE

| Component | Location | Status |
|-----------|----------|--------|
| **MockTicketAdapter** | `infrastructure/ports/ticket.port.ts` | ✅ Has `'create-ticket'` schema — ADD new schemas to its map |
| **ITicketPort** | `infrastructure/ports/ticket.port.ts` | ✅ Interface exists — no changes needed (methods via `execute()`) |
| **TicketController** | `infrastructure/http/ticket.controller.ts` | ✅ Has POST endpoints — ADD GET endpoints + inject QUERY_BUS_TOKEN |
| **TicketModule** | `ticket.module.ts` | ✅ Registered in app.module.ts — ADD new handlers + webhook controller |
| **DI Tokens** | `constants/tokens.ts` | ✅ `TICKET_PORT_TOKEN`, `DOCUMENT_PORT_TOKEN` — no new tokens needed |
| **DTOs** | `application/dtos/ticket.dto.ts` | ✅ Has create-ticket DTOs — ADD tracking/history DTOs |
| **CreateTicketHandler** | `application/commands/handlers/` | ✅ Done — pattern reference for new handlers |
| **Mock JSON** | `mocks/ticket/create-ticket.json` | ✅ Done — ADD get-ticket-status.json, get-ticket-history.json |
| **Queries barrel** | `application/queries/index.ts` | ✅ Empty — populate with new query exports |

#### ⚡ Key Architecture Points

**Ticket Port Methods (from architecture Port Catalog #10):**
- `createTicket` — ✅ Done (Story 5.1)
- `getTicketStatus` — 🆕 This story
- `getTicketHistory` — 🆕 This story
- `addComment` — Future
- `submitFeedback` — Story 5.3
- `handleWebhook` — 🆕 This story (webhook processing)
- `getServiceTypes` — Future

**Cache Tier:** `dynamic` (5-15 min) — ticket status changes frequently.
**Webhook Route:** `POST /webhooks/ticket/status` — per architecture webhook routing table.
**Webhook Guard:** `InterServiceApiKeyGuard` (static API key, FR72 — NOT JWT, NOT ZaloSignatureGuard).

#### What ALREADY EXISTS in Other Modules — REUSE PATTERNS

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **Payment Webhook Controller** | `src/modules/payment/infrastructure/http/webhook.controller.ts` | EXACT template for ticket webhook — `@Public()`, `@UseGuards(InterServiceApiKeyGuard)`, `COMMAND_BUS_TOKEN` |
| **Payment Webhook Handler** | `src/modules/payment/application/commands/handlers/` | Pattern for: cache invalidation, session event log, notification dispatch TODO |
| **Payment DTOs** | `src/modules/payment/application/dtos/payment.dto.ts` | Pattern for webhook payload schema |
| **Query Bus Pattern** | Any billing/meter/customer module | Inject `QUERY_BUS_TOKEN` + `IQueryBus`, dispatch `Get*Query` |
| **PortRegistry execute** | All handlers | `this.portRegistry.execute<T>('ticket', 'method', params)` |
| **PortFallbackException** | `@shared/port/port-exceptions` | Throw on null `result?.data` |
| **RedisCacheService** | `@shared/caching/` | `deleteByPattern()` for cache invalidation — check if it exists |
| **ValidationException** | `@core/common` | For webhook payload validation failures |

### 📁 File Structure — Changes

```
src/modules/ticket/
├── domain/
│   └── index.ts                                        ← NO CHANGE
├── application/
│   ├── commands/
│   │   ├── create-ticket.command.ts                     ← NO CHANGE
│   │   ├── get-upload-url.command.ts                    ← NO CHANGE
│   │   ├── handle-ticket-webhook.command.ts             ← NEW (AC#3)
│   │   ├── index.ts                                     ← UPDATE (add export)
│   │   └── handlers/
│   │       ├── create-ticket.handler.ts                 ← NO CHANGE
│   │       ├── create-ticket.handler.spec.ts            ← NO CHANGE
│   │       ├── get-upload-url.handler.ts                ← NO CHANGE
│   │       ├── get-upload-url.handler.spec.ts           ← NO CHANGE
│   │       ├── handle-ticket-webhook.handler.ts         ← NEW (AC#3)
│   │       └── handle-ticket-webhook.handler.spec.ts    ← NEW
│   ├── queries/
│   │   ├── get-ticket-status.query.ts                   ← NEW (AC#1)
│   │   ├── get-ticket-history.query.ts                  ← NEW (AC#2)
│   │   ├── index.ts                                     ← UPDATE (add exports)
│   │   └── handlers/
│   │       ├── get-ticket-status.handler.ts             ← NEW (AC#1)
│   │       ├── get-ticket-status.handler.spec.ts        ← NEW
│   │       ├── get-ticket-history.handler.ts            ← NEW (AC#2)
│   │       └── get-ticket-history.handler.spec.ts       ← NEW
│   ├── dtos/
│   │   └── ticket.dto.ts                                ← UPDATE (add tracking DTOs)
│   └── index.ts                                         ← NO CHANGE
├── infrastructure/
│   ├── http/
│   │   ├── ticket.controller.ts                         ← UPDATE (add GET endpoints + QUERY_BUS)
│   │   ├── ticket.controller.spec.ts                    ← UPDATE (add GET tests)
│   │   ├── ticket-webhook.controller.ts                 ← NEW (AC#3)
│   │   └── ticket-webhook.controller.spec.ts            ← NEW
│   └── ports/
│       ├── ticket.port.ts                               ← UPDATE (add schemas to MockTicketAdapter)
│       ├── ticket.port.spec.ts                          ← UPDATE (add new method tests)
│       ├── document.port.ts                             ← NO CHANGE
│       └── document.port.spec.ts                        ← NO CHANGE
├── constants/
│   └── tokens.ts                                        ← NO CHANGE
└── ticket.module.ts                                     ← UPDATE (add handlers + webhook controller)

mocks/
└── ticket/
    ├── create-ticket.json                               ← NO CHANGE
    ├── get-ticket-status.json                           ← NEW
    └── get-ticket-history.json                          ← NEW
```

### 🔧 Implementation Details

#### New DTOs to Add (`ticket.dto.ts`)

Append these schemas to the existing `ticket.dto.ts` file:

```typescript
// =============================================================================
// AC#1: Ticket Timeline Entry (FR43 — tracking detail)
// =============================================================================

export const TicketStatusEnum = z.enum([
  'submitted', 'assigned', 'in_progress', 'resolved', 'closed',
]);
export type TicketStatus = z.infer<typeof TicketStatusEnum>;

export const TicketTimelineEntrySchema = z.object({
  status: TicketStatusEnum,
  timestamp: z.string(),
  description: z.string().optional(),
  actor: z.string().optional(),       // e.g. "Team Kỹ thuật A"
});
export type TicketTimelineEntry = z.infer<typeof TicketTimelineEntrySchema>;

export const TicketStatusResponseSchema = z.object({
  trackingId: z.string(),
  status: TicketStatusEnum,
  timeline: z.array(TicketTimelineEntrySchema).min(1),
  eta: z.string().nullable(),         // Estimated completion time
  assignedTeam: z.string().nullable(), // e.g. "Đội sửa ống nước Bắc"
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TicketStatusResponse = z.infer<typeof TicketStatusResponseSchema>;

// =============================================================================
// AC#2: Ticket History (FR46 — list all tickets)
// =============================================================================

export const TicketSummarySchema = z.object({
  trackingId: z.string(),
  type: IncidentTypeSchema,
  status: TicketStatusEnum,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TicketSummary = z.infer<typeof TicketSummarySchema>;

export const TicketHistoryResponseSchema = z.object({
  tickets: z.array(TicketSummarySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type TicketHistoryResponse = z.infer<typeof TicketHistoryResponseSchema>;

export const TicketHistoryQuerySchema = z.object({
  status: TicketStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type TicketHistoryQuery = z.infer<typeof TicketHistoryQuerySchema>;

// =============================================================================
// AC#3: Ticket Webhook Payload (FR44 — status change from Ticketing Service)
// =============================================================================

export const TicketWebhookPayloadSchema = z.object({
  ticketId: z.string(),
  trackingId: z.string(),
  customerId: z.string(),
  oldStatus: TicketStatusEnum,
  newStatus: TicketStatusEnum,
  updatedAt: z.string(),
});
export type TicketWebhookPayload = z.infer<typeof TicketWebhookPayloadSchema>;
```

#### Update MockTicketAdapter (`ticket.port.ts`)

```typescript
// ADD these imports at top:
import {
  CreateTicketResponseSchema,
  TicketStatusResponseSchema,   // NEW
  TicketHistoryResponseSchema,  // NEW
} from '../../application/dtos/ticket.dto';

// UPDATE constructor — add new method schemas:
constructor() {
  super(
    'ticket',
    {
      'create-ticket': CreateTicketResponseSchema,
      'get-ticket-status': TicketStatusResponseSchema,    // NEW
      'get-ticket-history': TicketHistoryResponseSchema,  // NEW
    },
    new Logger('ticket-mock-adapter'),
  );
}
```

#### Get Ticket Status Query

```typescript
// get-ticket-status.query.ts
import { IQuery } from '@core/application';
import type { TicketStatusResponse } from '../../dtos/ticket.dto';

export class GetTicketStatusQuery implements IQuery {
  constructor(
    public readonly ticketId: string,
  ) {}
}

export type GetTicketStatusResult = TicketStatusResponse;
```

#### Get Ticket Status Handler

```typescript
// handlers/get-ticket-status.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { GetTicketStatusQuery, GetTicketStatusResult } from '../get-ticket-status.query';
import type { TicketStatusResponse } from '../../../dtos/ticket.dto';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';

@QueryHandler(GetTicketStatusQuery)
export class GetTicketStatusHandler implements IQueryHandler<GetTicketStatusQuery> {
  private readonly logger = new Logger(GetTicketStatusHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetTicketStatusQuery): Promise<GetTicketStatusResult> {
    const { ticketId } = query;
    this.logger.log(`Fetching ticket status: ${ticketId}`);

    const result: PortResult<TicketStatusResponse> =
      await this.portRegistry.execute<TicketStatusResponse>(
        'ticket', 'get-ticket-status',
        { ticketId },
      );

    const ticket = result?.data;
    if (!ticket) {
      throw new PortFallbackException('ticket');
    }

    return ticket;
  }
}
```

#### Get Ticket History Query

```typescript
// get-ticket-history.query.ts
import { IQuery } from '@core/application';
import type { TicketHistoryResponse } from '../../dtos/ticket.dto';

export class GetTicketHistoryQuery implements IQuery {
  constructor(
    public readonly customerId: string,
    public readonly status?: string,
    public readonly page?: number,
    public readonly pageSize?: number,
  ) {}
}

export type GetTicketHistoryResult = TicketHistoryResponse;
```

#### Get Ticket History Handler

```typescript
// handlers/get-ticket-history.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { GetTicketHistoryQuery, GetTicketHistoryResult } from '../get-ticket-history.query';
import type { TicketHistoryResponse } from '../../../dtos/ticket.dto';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';

@QueryHandler(GetTicketHistoryQuery)
export class GetTicketHistoryHandler implements IQueryHandler<GetTicketHistoryQuery> {
  private readonly logger = new Logger(GetTicketHistoryHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetTicketHistoryQuery): Promise<GetTicketHistoryResult> {
    const { customerId, status, page, pageSize } = query;
    this.logger.log(`Fetching ticket history for customer: ${customerId}`);

    const result: PortResult<TicketHistoryResponse> =
      await this.portRegistry.execute<TicketHistoryResponse>(
        'ticket', 'get-ticket-history',
        { customerId, status, page, pageSize },
      );

    const history = result?.data;
    if (!history) {
      throw new PortFallbackException('ticket');
    }

    return history;
  }
}
```

#### Handle Ticket Webhook Command

```typescript
// handle-ticket-webhook.command.ts
import { ICommand } from '@core/application';
import type { TicketWebhookPayload } from '../../dtos/ticket.dto';

export class HandleTicketWebhookCommand implements ICommand {
  constructor(public readonly payload: TicketWebhookPayload) {}
}
```

#### Handle Ticket Webhook Handler

```typescript
// handlers/handle-ticket-webhook.handler.ts
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { HandleTicketWebhookCommand } from '../handle-ticket-webhook.command';
// import { RedisCacheService } from '@shared/caching';  // Uncomment if deleteByPattern exists

@CommandHandler(HandleTicketWebhookCommand)
export class HandleTicketWebhookHandler implements ICommandHandler<HandleTicketWebhookCommand> {
  private readonly logger = new Logger(HandleTicketWebhookHandler.name);

  // constructor(private readonly cacheService: RedisCacheService) {}
  constructor() {}

  async execute(command: HandleTicketWebhookCommand): Promise<void> {
    const { payload } = command;
    const { ticketId, trackingId, customerId, oldStatus, newStatus } = payload;

    this.logger.log(
      `Ticket webhook: ${trackingId} ${oldStatus} → ${newStatus} (customer: ${customerId})`,
    );

    // 1. Invalidate ticket cache for this customer (pattern-based purge)
    // await this.cacheService.deleteByPattern(`cache:port:ticket:*`);
    // NOTE: Check if RedisCacheService has deleteByPattern(). If not, use
    // a direct Redis SCAN + DEL approach. The payment webhook handler may
    // already have a utility for this — check its implementation.
    this.logger.warn('TODO: Cache invalidation — implement when RedisCacheService.deleteByPattern is available');

    // 2. Log session event (TODO: session module — Epic 7)
    // { type: "ticket_status_changed", ticketId, oldStatus, newStatus }
    this.logger.log(`Session event: ticket_status_changed — ${trackingId}`);

    // 3. TODO: Dispatch notification (Epic 6 — DispatchNotificationCommand)
    // await this.commandBus.execute(new DispatchNotificationCommand({ ... }));
    this.logger.log(`TODO: Notification dispatch for ticket ${trackingId} (Epic 6)`);
  }
}
```

#### Update TicketController — Add GET Endpoints

```typescript
// ADD these imports:
import { Get, Param, Query, Inject } from '@nestjs/common';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { GetTicketStatusQuery } from '../../application/queries/get-ticket-status.query';
import { GetTicketHistoryQuery } from '../../application/queries/get-ticket-history.query';
import { TicketHistoryQuerySchema } from '../../application/dtos/ticket.dto';

// UPDATE constructor — inject both buses:
constructor(
  @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
) {}

// ADD these endpoints:

/**
 * GET /tickets/:trackingId
 * Track ticket status with full timeline (AC#1 — FR43)
 */
@Get(':trackingId')
@ApiOperation({ summary: 'Track ticket status with timeline' })
async getTicketStatus(
  @Param('trackingId') trackingId: string,
) {
  return this.queryBus.execute(new GetTicketStatusQuery(trackingId));
}

/**
 * GET /tickets
 * List ticket history with pagination and filters (AC#2 — FR46)
 */
@Get()
@ApiOperation({ summary: 'Get ticket history' })
async getTicketHistory(
  @CurrentUser('id') userId: string,
  @Query() query: Record<string, unknown>,
) {
  const validated = TicketHistoryQuerySchema.safeParse(query);
  if (!validated.success) {
    throw new ValidationException(validated.error.message);
  }

  return this.queryBus.execute(
    new GetTicketHistoryQuery(
      userId,
      validated.data.status,
      validated.data.page,
      validated.data.pageSize,
    ),
  );
}
```

#### Ticket Webhook Controller

```typescript
/**
 * Ticket Webhook Controller (AC#3 — FR44)
 *
 * Receives ticket status change notifications from Ticketing Service.
 * Guarded by InterServiceApiKeyGuard — static API key verification (FR72).
 * Returns 200 always — webhook acknowledgment.
 *
 * Pattern: Payment WebhookController (EXACT same structure).
 */

import { Controller, Post, Body, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { COMMAND_BUS_TOKEN } from '@core/constants/tokens';
import type { ICommandBus } from '@core/application';
import { InterServiceApiKeyGuard } from '@shared/security';
import { Public } from '@modules/auth/infrastructure/decorators/public.decorator';
import { HandleTicketWebhookCommand } from '../../application/commands/handle-ticket-webhook.command';
import { TicketWebhookPayloadSchema } from '../../application/dtos/ticket.dto';
import { ValidationException } from '@core/common';

@Public()
@ApiTags('Webhooks — Ticket')
@Controller('webhooks/ticket')
@UseGuards(InterServiceApiKeyGuard)
export class TicketWebhookController {
  constructor(
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  @Post('status')
  @ApiOperation({ summary: 'Ticket status change webhook (internal service)' })
  @ApiHeader({ name: 'x-api-key', description: 'Inter-service static API key' })
  async handleTicketStatus(@Body() body: Record<string, unknown>) {
    const validated = TicketWebhookPayloadSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException('Invalid ticket webhook payload');
    }

    await this.commandBus.execute(new HandleTicketWebhookCommand(validated.data));

    return { received: true };
  }
}
```

#### Update TicketModule

```typescript
// ADD these imports:
import { GetTicketStatusHandler } from './application/queries/handlers/get-ticket-status.handler';
import { GetTicketHistoryHandler } from './application/queries/handlers/get-ticket-history.handler';
import { HandleTicketWebhookHandler } from './application/commands/handlers/handle-ticket-webhook.handler';
import { TicketWebhookController } from './infrastructure/http/ticket-webhook.controller';

// UPDATE @Module decorator:
@Module({
  controllers: [TicketController, TicketWebhookController],  // ADD TicketWebhookController
  providers: [
    // ... existing providers stay the same ...
    // ADD new handlers:
    GetTicketStatusHandler,
    GetTicketHistoryHandler,
    HandleTicketWebhookHandler,
  ],
  exports: [TICKET_PORT_TOKEN, DOCUMENT_PORT_TOKEN],  // NO CHANGE
})
```

#### Mock JSON Files

**`mocks/ticket/get-ticket-status.json`**:
```json
{
  "trackingId": "TK-2026-002",
  "status": "in_progress",
  "timeline": [
    { "status": "submitted", "timestamp": "2026-06-10T09:30:00Z", "description": "Incident reported by customer" },
    { "status": "assigned", "timestamp": "2026-06-10T10:15:00Z", "description": "Assigned to technical team", "actor": "Đội kỹ thuật A" },
    { "status": "in_progress", "timestamp": "2026-06-10T11:00:00Z", "description": "Team is investigating the issue", "actor": "Đội kỹ thuật A" }
  ],
  "eta": "2026-06-10T17:00:00Z",
  "assignedTeam": "Đội kỹ thuật A",
  "createdAt": "2026-06-10T09:30:00Z",
  "updatedAt": "2026-06-10T11:00:00Z"
}
```

**`mocks/ticket/get-ticket-history.json`**:
```json
{
  "tickets": [
    {
      "trackingId": "TK-2026-002",
      "type": "water_outage",
      "status": "in_progress",
      "createdAt": "2026-06-10T09:30:00Z",
      "updatedAt": "2026-06-10T11:00:00Z"
    },
    {
      "trackingId": "TK-2026-001",
      "type": "leak",
      "status": "closed",
      "createdAt": "2026-05-20T14:00:00Z",
      "updatedAt": "2026-05-22T09:00:00Z"
    }
  ],
  "total": 2,
  "page": 1,
  "pageSize": 10
}
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Create a new `ITicketPort` or separate port file | Add schemas to existing `MockTicketAdapter` constructor — same `ticket` port |
| Create `session` module or Redis session events | Log session event via `this.logger.log()` — session module is Epic 7 |
| Implement notification dispatch logic | Add `TODO` comment — `DispatchNotificationCommand` is Epic 6 |
| Use `ZaloSignatureGuard` for ticket webhook | Use `InterServiceApiKeyGuard` — ticket webhooks are internal service, NOT Zalo |
| Use `@Public()` without `@UseGuards(InterServiceApiKeyGuard)` | Both decorators required — `@Public()` bypasses auth, `InterServiceApiKeyGuard` provides API key security |
| Implement cache invalidation with manual Redis commands if `deleteByPattern()` doesn't exist | Check payment webhook handler for existing pattern — may already have a utility |
| Put query handlers in `commands/handlers/` directory | Create `queries/handlers/` directory — separate CQRS paths |
| Forget to inject `QUERY_BUS_TOKEN` in controller | Must inject BOTH `COMMAND_BUS_TOKEN` and `QUERY_BUS_TOKEN` |
| Add `@Param('trackingId')` validation in controller | Keep controller thin — handler delegates to port, port delegates to downstream |
| Hardcode `cache:port:ticket:*` pattern without checking existing utilities | Check `RedisCacheService` and payment webhook handler for existing pattern-based purge |

### 🔧 Important Implementation Notes

#### Cache Invalidation Research

Before implementing cache invalidation in `HandleTicketWebhookHandler`, check:
1. `src/libs/shared/caching/` — does `RedisCacheService` have a `deleteByPattern()` or `invalidateByPattern()` method?
2. `src/modules/payment/application/commands/handlers/` — how does the payment webhook handler invalidate invoice cache? It uses pattern-based purge (`SCAN` + `DEL` matching `cache:port:invoice:{customerId}:*`). Replicate the exact same approach.

The epics specify: `cache:port:ticket:{customerId}:*` — but the webhook payload MUST contain `customerId` for this to work. Verify the `TicketWebhookPayloadSchema` includes `customerId`.

#### Webhook Endpoint Route

Per architecture webhook routing table:
```
POST /webhooks/ticket/status → Ticket Module → Session event + Notification dispatch
```

The controller path is `webhooks/ticket` (controller decorator) + `status` (method decorator) = `POST /webhooks/ticket/status`.

#### Query Barrel Exports

The `application/queries/index.ts` is currently empty (Story 5.1 created it but didn't populate it). Populate it:

```typescript
export * from './get-ticket-status.query';
export * from './get-ticket-history.query';
```

Also create `application/queries/handlers/` directory (doesn't exist yet).

### 🧪 Testing Requirements

1. **MockTicketAdapter — get-ticket-status** — Read JSON, validate `TicketStatusResponseSchema`, verify timeline is non-empty
2. **MockTicketAdapter — get-ticket-history** — Read JSON, validate `TicketHistoryResponseSchema`, verify tickets array
3. **GetTicketStatusHandler — success** — Verify PortRegistry called with `{ ticketId: 'TK-2026-002' }`
4. **GetTicketStatusHandler — null result** — Verify throws `PortFallbackException`
5. **GetTicketHistoryHandler — success** — Verify PortRegistry called with `{ customerId, status?, page?, pageSize? }`
6. **GetTicketHistoryHandler — null result** — Verify throws `PortFallbackException`
7. **HandleTicketWebhookHandler — success** — Verify cache invalidation attempt + session event log
8. **HandleTicketWebhookHandler — logs correct status transition** — Verify log contains oldStatus → newStatus
9. **TicketController — GET /tickets/:trackingId** — Returns 200 with ticket status + timeline
10. **TicketController — GET /tickets** — Returns 200 with paginated ticket list
11. **TicketController — GET /tickets?status=in_progress** — Passes status filter to query
12. **TicketController — GET /tickets?page=2&pageSize=5** — Passes pagination to query
13. **TicketWebhookController — POST /webhooks/ticket/status** — Returns `{ received: true }`
14. **TicketWebhookController — invalid payload** — Returns 400 `ValidationException`
15. **TicketWebhookController — missing x-api-key** — Returns 403 (guard rejects)
16. **Controller — verify query class types** — `toBeInstanceOf(GetTicketStatusQuery)`, `toBeInstanceOf(GetTicketHistoryQuery)`
17. **Webhook controller — verify command class type** — `toBeInstanceOf(HandleTicketWebhookCommand)`

### Previous Story Learnings (Stories 1.1–5.1 — MUST Apply)

- **Module pattern**: `OnModuleInit` + `useExisting` for port adapters — follow `PaymentModule` exactly
- **Port registration**: `portRegistry.register(name, mockAdapter, mockAdapter)` — mock for both mock/live until live adapter exists
- **Command pattern**: Simple class implementing `ICommand`, handler uses `@CommandHandler()` decorator
- **Query pattern**: Simple class implementing `IQuery`, handler uses `@QueryHandler()` decorator — same as command but with `IQueryHandler` + `IQuery`
- **Handler null guard**: Always check `result?.data` — throw `PortFallbackException` if null (NOT NotFoundException — changed during Story 5.1 code review)
- **Controller validation**: `Schema.safeParse(body)` → `throw new ValidationException(validated.error.message)` on failure (passes field-level error info — code review fix from Story 5.1)
- **DI tokens**: `Symbol()` for type-safe injection — no new tokens needed for this story
- **Mock adapter pattern**: Extend `MockAdapterBase`, pass port name + schema map + Logger to `super()`
- **Mock JSON**: Simple static files in `mocks/{port-name}/` directory
- **645+ tests passing** — ensure ZERO regressions when adding ticket query/webhook code
- **app.module.ts ordering**: Domain modules → `AuthPropagationModule` → `PortModule` — TicketModule already registered, no changes needed
- **Webhook pattern**: `@Public()` + `@UseGuards(InterServiceApiKeyGuard)` + `COMMAND_BUS_TOKEN` — exact copy from payment webhook

### 📋 Cross-Story Context

**Depends on (all complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Story R-1 (Session auth guard + CurrentUser decorator)
- Story 5.1 (Ticket module scaffold, ITicketPort, MockTicketAdapter, CreateTicketHandler)

**Enables (future stories):**
- Story 5.3 (Ticket Feedback / CSAT) — will add `submitFeedback` to ticket module
- Story 5.4 (Knowledge Base & FAQ Search) — will add `IKnowledgeBasePort` to ticket module
- Story 6.2 (Multi-Channel Notification Dispatch) — webhook handler will call `DispatchNotificationCommand`
- Story 7.1 (Session Store & Event Recording) — webhook handler will record real session events

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2: Ticket Tracking & Timeline]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port 10: ticket — methods: createTicket, getTicketStatus, getTicketHistory, addComment, submitFeedback, handleWebhook, getServiceTypes]
- [Source: _bmad-output/planning-artifacts/architecture.md#Webhook Routing — POST /webhooks/ticket/status → Ticket Module]
- [Source: _bmad-output/planning-artifacts/architecture.md#Cache Strategy — ticket: dynamic tier (5-15 min)]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules — NEVER call Backend API with bare fetch]
- [Source: _bmad-output/project-context.md#Webhook Security — Internal webhooks: InterServiceApiKeyGuard, static API key, NOT JWT]
- [Source: _bmad-output/project-context.md#Session Event Types — ticket_status_changed]
- [Source: src/modules/payment/infrastructure/http/webhook.controller.ts — Webhook controller pattern]
- [Source: src/modules/ticket/infrastructure/ports/ticket.port.ts — Existing MockTicketAdapter to extend]
- [Source: src/modules/ticket/infrastructure/http/ticket.controller.ts — Existing controller to add GET endpoints]
- [Source: src/modules/ticket/ticket.module.ts — Existing module to add handlers + webhook controller]
- [Source: src/modules/ticket/application/commands/handlers/create-ticket.handler.ts — Handler pattern reference]

## Dev Agent Record

### Agent Model Used

glm-5[1m]

### Debug Log References

- 81 test suites, 707 tests — ALL PASSING, ZERO REGRESSIONS
- Code review: 4 findings (2 MEDIUM, 2 LOW) — all fixed

### Completion Notes List

- ✅ Task 1: Added 6 new Zod schemas + TypeScript types to ticket.dto.ts (TicketStatusEnum, TicketTimelineEntrySchema, TicketStatusResponseSchema, TicketSummarySchema, TicketHistoryResponseSchema/TicketHistoryQuerySchema, TicketWebhookPayloadSchema)
- ✅ Task 2: Extended MockTicketAdapter with 'get-ticket-status' and 'get-ticket-history' schemas + created 2 mock JSON files
- ✅ Task 3: Created GetTicketStatusQuery + Handler — PortRegistry execute + null guard with PortFallbackException
- ✅ Task 4: Created GetTicketHistoryQuery + Handler — supports status filter + pagination params
- ✅ Task 5: Added GET /tickets/:trackingId + GET /tickets to TicketController — injected QUERY_BUS_TOKEN alongside COMMAND_BUS_TOKEN
- ✅ Task 6: Created TicketWebhookController — @Public() + @UseGuards(InterServiceApiKeyGuard), validates payload, dispatches command
- ✅ Task 7: Created HandleTicketWebhookCommand + Handler — cache invalidation via cacheService.deleteByPattern('cache:v2:port:ticket:*'), session event + notification stubs for Epic 6/7
- ✅ Task 8: Updated TicketModule — added 3 new handlers + webhook controller to providers/controllers, updated commands barrel + queries barrel
- ✅ Task 9: Created 4 new spec files + updated 2 existing — 707 tests pass (was 645+ before, ~62 new tests added)
- Key decision: Used `cache:v2:port:ticket:*` pattern (matching existing payment webhook cache pattern) instead of non-versioned `cache:port:ticket:*` from story notes
- 🔍 Code review fix M-1: Deduplicated `TicketStatusEnum` — moved to shared position before `CreateTicketResponseSchema`, eliminated inline enum duplication
- 🔍 Code review fix M-2: Added `IdempotencyService` to `HandleTicketWebhookHandler` — now follows EXACT payment webhook pattern with duplicate detection + result storage
- 🔍 Code review fix L-1: Fixed unused `ticketId` variable — now included in session event stub log

### File List

**NEW files:**
- src/modules/ticket/application/queries/get-ticket-status.query.ts
- src/modules/ticket/application/queries/handlers/get-ticket-status.handler.ts
- src/modules/ticket/application/queries/handlers/get-ticket-status.handler.spec.ts
- src/modules/ticket/application/queries/get-ticket-history.query.ts
- src/modules/ticket/application/queries/handlers/get-ticket-history.handler.ts
- src/modules/ticket/application/queries/handlers/get-ticket-history.handler.spec.ts
- src/modules/ticket/application/commands/handle-ticket-webhook.command.ts
- src/modules/ticket/application/commands/handlers/handle-ticket-webhook.handler.ts
- src/modules/ticket/application/commands/handlers/handle-ticket-webhook.handler.spec.ts
- src/modules/ticket/infrastructure/http/ticket-webhook.controller.ts
- src/modules/ticket/infrastructure/http/ticket-webhook.controller.spec.ts
- mocks/ticket/get-ticket-status.json
- mocks/ticket/get-ticket-history.json

**MODIFIED files:**
- src/modules/ticket/application/dtos/ticket.dto.ts
- src/modules/ticket/infrastructure/ports/ticket.port.ts
- src/modules/ticket/infrastructure/ports/ticket.port.spec.ts
- src/modules/ticket/infrastructure/http/ticket.controller.ts
- src/modules/ticket/infrastructure/http/ticket.controller.spec.ts
- src/modules/ticket/application/commands/index.ts
- src/modules/ticket/application/queries/index.ts
- src/modules/ticket/ticket.module.ts
