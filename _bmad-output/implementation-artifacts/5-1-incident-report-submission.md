# Story 5.1: Incident Report Submission

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **customer (Anh Tuấn)**,
I want to report a water issue with photos and get a tracking ID immediately,
so that I know my problem is being handled without waiting on hold.

## Acceptance Criteria

### AC1: Incident Report Form (FR41)
**Given** an authenticated customer taps "Report Issue"
**When** the incident form loads
**Then** they can select incident type (water outage, leak, water quality, meter issue, other), enter description, and optionally attach photos.

### AC2: Presigned URL Photo Upload (FR58, FR60)
**Given** a customer attaches photos to the incident report
**When** they select images (camera capture or gallery)
**Then** the BFF calls `IDocumentPort.getUploadUrl(fileType, metadata)` to get presigned URLs pointing to a **temporary storage bucket** (Document Service responsibility)
**And** the frontend uploads directly to storage — BFF never handles file binary (FR60: storage credentials never exposed to frontend)
**And** if the customer abandons the form without submitting, orphaned files are auto-cleaned by Document Service via TTL (24h temp bucket) — **this is NOT BFF's responsibility**. Only when `createTicket` is called does the downstream service move files to permanent storage.

### AC3: Ticket Creation via Port (FR41, FR42)
**Given** a customer submits the completed incident form
**When** the BFF processes the submission
**Then** it calls `ITicketPort.createTicket(type, description, imageUrls, customerId, priority)` via PortRegistry with `useCache: false`
**And** the Ticketing Service returns a tracking ID (e.g. `TK-2026-002`)
**And** the BFF records a session event: `{ type: "ticket_created", ticketId, channel }`.

### AC4: Tracking ID Response (FR42)
**Given** the ticket creation succeeds
**When** the response returns to the frontend
**Then** the customer sees: "Incident reported! Your tracking ID: TK-2026-002"
**And** the tracking ID is available for future lookup (Story 5.2).

## Tasks / Subtasks

- [x] Task 1: Create Ticket Module Scaffold (AC: all)
  - [x] Create `src/modules/ticket/` directory structure: `domain/`, `application/`, `infrastructure/`, `constants/`
  - [x] Create `src/modules/ticket/constants/tokens.ts` — `TICKET_PORT_TOKEN`, `DOCUMENT_PORT_TOKEN`
  - [x] Create `src/modules/ticket/domain/index.ts` — empty barrel
  - [x] Create `src/modules/ticket/application/index.ts` — barrel
  - [x] Create `src/modules/ticket/application/commands/index.ts` — barrel
  - [x] Create `src/modules/ticket/application/queries/index.ts` — empty barrel for now

- [x] Task 2: Create Ticket DTOs (AC: #1, #3, #4)
  - [x] Create `src/modules/ticket/application/dtos/ticket.dto.ts`:
  - [x] `IncidentTypeSchema` — enum: `water_outage`, `leak`, `water_quality`, `meter_issue`, `other`
  - [x] `CreateTicketRequestSchema` — input validation (type, description, imageUrls optional)
  - [x] `CreateTicketResponseSchema` — output (trackingId, status, createdAt)
  - [x] `GetUploadUrlRequestSchema` — input (fileName, fileType, metadata)
  - [x] `GetUploadUrlResponseSchema` — output (uploadUrl, fileKey, expiresAt)
  - [x] All TypeScript types exported

- [x] Task 3: Create Ticket Port & Mock Adapter (AC: #3, #4)
  - [x] Create `src/modules/ticket/infrastructure/ports/ticket.port.ts`:
  - [x] `ITicketPort` interface extending `IPortAdapter`
  - [x] `MockTicketAdapter` extending `MockAdapterBase` with `create-ticket` schema
  - [x] Create `mocks/ticket/create-ticket.json` — mock response with trackingId

- [x] Task 4: Create Document Port & Mock Adapter (AC: #2)
  - [x] Create `src/modules/ticket/infrastructure/ports/document.port.ts`:
  - [x] `IDocumentPort` interface extending `IPortAdapter`
  - [x] `MockDocumentAdapter` extending `MockAdapterBase` with `get-upload-url` schema
  - [x] Create `mocks/document/get-upload-url.json` — mock presigned URL response

- [x] Task 5: Create Get Upload URL Command & Handler (AC: #2)
  - [x] Create `src/modules/ticket/application/commands/get-upload-url.command.ts`
  - [x] Create `src/modules/ticket/application/commands/handlers/get-upload-url.handler.ts`
  - [x] Handler: inject `PortRegistry`, call `execute('document', 'get-upload-url', { fileName, fileType, metadata })`
  - [x] Returns presigned URL for frontend to upload directly to storage

- [x] Task 6: Create Create Ticket Command & Handler (AC: #3, #4)
  - [x] Create `src/modules/ticket/application/commands/create-ticket.command.ts`
  - [x] Create `src/modules/ticket/application/commands/handlers/create-ticket.handler.ts`
  - [x] Handler: inject `PortRegistry`, call `execute('ticket', 'create-ticket', { type, description, imageUrls, customerId, priority })` with `useCache: false`
  - [x] Returns tracking ID from downstream Ticketing Service

- [x] Task 7: Add Controller Endpoints (AC: all)
  - [x] Create `src/modules/ticket/infrastructure/http/ticket.controller.ts`
  - [x] `POST /tickets` → dispatch `CreateTicketCommand` (body: { type, description, imageUrls? })
  - [x] `POST /tickets/upload-url` → dispatch `GetUploadUrlCommand` (body: { fileName, fileType })
  - [x] Validate request body via Zod schemas

- [x] Task 8: Create Ticket Module Registration (AC: all)
  - [x] Create `src/modules/ticket/ticket.module.ts`:
  - [x] Register `MockTicketAdapter` + `MockDocumentAdapter` with PortRegistry via `onModuleInit`
  - [x] Register ports: `ticket` (cacheTier: dynamic) + `document` (cacheTier: transaction)
  - [x] Add all command handlers to providers
  - [x] Add `TicketModule` to `app.module.ts` imports

- [x] Task 9: Write comprehensive tests (AC: all)
  - [x] Create `ticket.port.spec.ts` — mock adapter reads JSON, validates `CreateTicketResponseSchema`
  - [x] Create `document.port.spec.ts` — mock adapter reads JSON, validates `GetUploadUrlResponseSchema`
  - [x] Create `create-ticket.handler.spec.ts` — verify PortRegistry call with correct params
  - [x] Create `get-upload-url.handler.spec.ts` — verify PortRegistry call with file params
  - [x] Create `ticket.controller.spec.ts` — POST /tickets, POST /tickets/upload-url, body validation

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story creates **TWO brand-new modules** from scratch:
1. **`ticket` module** — first story of Epic 5, owns `ITicketPort` + `IDocumentPort`
2. No `session` module exists yet — session events are logged via structured logger only (Epic 7 builds the session module)

#### ⚡ TWO New Ports in One Story

This story introduces both `ticket` and `document` ports. Per the architecture:
- **`ticket`** port: `cacheTier: dynamic` (5-15 min cache) — `ITicketPort` in `ticket` module
- **`document`** port: `cacheTier: transaction` (NO CACHE) — `IDocumentPort` in `ticket` module

Both ports live in the `ticket` module because document upload here is exclusively for ticket attachments (per architecture, `document` port is used by `modules/document/` but since this is the first story using it, we create it here under ticket's infrastructure until the `document` module is created in a later phase).

**UPDATE**: Per architecture directory structure, `document` is a separate module at `src/modules/document/`. However, looking at the architecture implementation sequence, document module (item #16) comes AFTER ticket module (item #14). For this story, we need document port ONLY for `get-upload-url`. The pragmatic approach: create document port inside the `ticket` module for NOW. When the `document` module is created later, we can move it. This matches how `debt.port.ts` lives inside the `payment` module.

#### What ALREADY EXISTS — DO NOT REINVENT

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **PortRegistry** | `src/libs/shared/port/port-registry.service.ts` | `register()` + `execute()` — core port infrastructure |
| **MockAdapterBase** | `src/libs/shared/port/mock-adapter.base.ts` | Base class for mock adapters — reads JSON + Zod validate |
| **IPortAdapter** | `src/libs/shared/port/port.interface.ts` | Interface all ports implement |
| **CommandHandler pattern** | `src/modules/payment/application/commands/handlers/` | Template for command + handler structure |
| **Controller pattern** | `src/modules/payment/infrastructure/http/payment.controller.ts` | Dual bus injection, Zod validation, `@CurrentUser` |
| **Module registration pattern** | `src/modules/payment/payment.module.ts` | `OnModuleInit`, `useExisting`, PortRegistry `register()` |
| **WebhookController pattern** | `src/modules/payment/infrastructure/http/webhook.controller.ts` | `@Public()` + `InterServiceApiKeyGuard` + `@UseGuards()` |
| **Mock JSON pattern** | `mocks/payment/*.json` | Template for mock data files |
| **DI Tokens pattern** | `src/modules/payment/constants/tokens.ts` | `Symbol` tokens for DI |
| **Exception classes** | `@core/common` | `ValidationException`, `NotFoundException`, `ForbiddenException` |
| **Current User decorator** | `@modules/auth/infrastructure/decorators/current-user.decorator` | `@CurrentUser('id')` for extracting userId |

#### Pattern Reference — Payment Module (CLOSEST MATCH)

The `payment` module is the most recent and relevant pattern. Follow its structure EXACTLY:

```
payment/                                    → ticket/
├── constants/tokens.ts                     → constants/tokens.ts (TICKET_PORT_TOKEN, DOCUMENT_PORT_TOKEN)
├── domain/index.ts                         → domain/index.ts
├── application/
│   ├── dtos/payment.dto.ts                 → dtos/ticket.dto.ts (incident types, ticket DTOs)
│   ├── commands/
│   │   ├── create-payment.command.ts       → create-ticket.command.ts
│   │   ├── index.ts                        → index.ts
│   │   └── handlers/
│   │       ├── create-payment.handler.ts   → create-ticket.handler.ts
│   │       ├── create-payment.handler.spec.ts → create-ticket.handler.spec.ts
│   │       └── ...                         → get-upload-url.handler.ts + spec
│   ├── queries/index.ts                    → queries/index.ts (empty for now)
│   └── index.ts                            → index.ts
├── infrastructure/
│   ├── http/
│   │   ├── payment.controller.ts           → ticket.controller.ts (POST /tickets, POST /tickets/upload-url)
│   │   └── payment.controller.spec.ts      → ticket.controller.spec.ts
│   └── ports/
│       ├── payment.port.ts                 → ticket.port.ts (MockTicketAdapter)
│       └── payment.port.spec.ts            → ticket.port.spec.ts
│                                           → document.port.ts (MockDocumentAdapter)
│                                           → document.port.spec.ts
└── payment.module.ts                       → ticket.module.ts
```

### 📁 File Structure — ALL New Files

```
src/modules/ticket/
├── domain/
│   └── index.ts                                        ← NEW (empty barrel)
├── application/
│   ├── commands/
│   │   ├── create-ticket.command.ts                     ← NEW (AC#3)
│   │   ├── get-upload-url.command.ts                    ← NEW (AC#2)
│   │   ├── index.ts                                     ← NEW
│   │   └── handlers/
│   │       ├── create-ticket.handler.ts                 ← NEW (AC#3)
│   │       ├── create-ticket.handler.spec.ts            ← NEW
│   │       ├── get-upload-url.handler.ts                ← NEW (AC#2)
│   │       └── get-upload-url.handler.spec.ts           ← NEW
│   ├── queries/
│   │   └── index.ts                                     ← NEW (empty — queries in Story 5.2)
│   ├── dtos/
│   │   └── ticket.dto.ts                                ← NEW (all DTOs)
│   └── index.ts                                         ← NEW
├── infrastructure/
│   ├── http/
│   │   ├── ticket.controller.ts                         ← NEW (AC#1,2,3,4)
│   │   └── ticket.controller.spec.ts                    ← NEW
│   └── ports/
│       ├── ticket.port.ts                               ← NEW (ITicketPort + MockTicketAdapter)
│       ├── ticket.port.spec.ts                          ← NEW
│       ├── document.port.ts                             ← NEW (IDocumentPort + MockDocumentAdapter)
│       └── document.port.spec.ts                        ← NEW
├── constants/
│   └── tokens.ts                                        ← NEW
└── ticket.module.ts                                     ← NEW

mocks/
├── ticket/
│   └── create-ticket.json                               ← NEW
└── document/
    └── get-upload-url.json                              ← NEW

src/app.module.ts                                        ← UPDATE (add TicketModule)
```

### 🔧 Implementation Details

#### DI Tokens (`constants/tokens.ts`)

```typescript
export const TICKET_PORT_TOKEN = Symbol('ITicketPort');
export const DOCUMENT_PORT_TOKEN = Symbol('IDocumentPort');
```

#### DTOs (`ticket.dto.ts`)

```typescript
// Incident Type Enum (FR41)
export const IncidentTypeSchema = z.enum([
  'water_outage', 'leak', 'water_quality', 'meter_issue', 'other'
]);
export type IncidentType = z.infer<typeof IncidentTypeSchema>;

// AC#1: Create Ticket Request (controller input)
export const CreateTicketRequestSchema = z.object({
  type: IncidentTypeSchema,
  description: z.string().min(1).max(2000),
  imageUrls: z.array(z.string().url()).max(5).optional(),
});
export type CreateTicketRequest = z.infer<typeof CreateTicketRequestSchema>;

// AC#3,#4: Create Ticket Response (port response)
export const CreateTicketResponseSchema = z.object({
  trackingId: z.string().regex(/^TK-\d{4}-\d{3}$/, 'Invalid tracking ID format'),
  status: z.enum(['submitted', 'assigned', 'in_progress', 'resolved', 'closed']),
  createdAt: z.string(),
});
export type CreateTicketResponse = z.infer<typeof CreateTicketResponseSchema>;

// AC#2: Get Upload URL Request (controller input)
export const GetUploadUrlRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});
export type GetUploadUrlRequest = z.infer<typeof GetUploadUrlRequestSchema>;

// AC#2: Get Upload URL Response (port response)
export const GetUploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  fileKey: z.string(),
  expiresAt: z.string(),
});
export type GetUploadUrlResponse = z.infer<typeof GetUploadUrlResponseSchema>;
```

#### Commands

```typescript
// create-ticket.command.ts
export class CreateTicketCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly type: IncidentType,
    public readonly description: string,
    public readonly imageUrls?: string[],
  ) {}
}
export type CreateTicketResult = CreateTicketResponse;

// get-upload-url.command.ts
export class GetUploadUrlCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly fileName: string,
    public readonly fileType: string,
  ) {}
}
export type GetUploadUrlResult = GetUploadUrlResponse;
```

#### Create Ticket Handler

```typescript
@CommandHandler(CreateTicketCommand)
export class CreateTicketHandler implements ICommandHandler<CreateTicketCommand> {
  private readonly logger = new Logger(CreateTicketHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: CreateTicketCommand): Promise<CreateTicketResult> {
    const { customerId, type, description, imageUrls } = command;
    this.logger.log(`Creating ticket for customer: ${customerId}, type: ${type}`);
    const result = await this.portRegistry.execute<CreateTicketResponse>(
      'ticket', 'create-ticket',
      { customerId, type, description, imageUrls, priority: 'normal', useCache: false },
    );
    const ticket = result?.data;
    if (!ticket) {
      throw new NotFoundException('Ticket creation failed — no response from ticketing service');
    }
    // TODO: Record session event when session module is built (Epic 7)
    // { type: "ticket_created", ticketId: ticket.trackingId, channel }
    this.logger.log(`Ticket created: ${ticket.trackingId}`);
    return ticket;
  }
}
```

#### Get Upload URL Handler

```typescript
@CommandHandler(GetUploadUrlCommand)
export class GetUploadUrlHandler implements ICommandHandler<GetUploadUrlCommand> {
  private readonly logger = new Logger(GetUploadUrlHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: GetUploadUrlCommand): Promise<GetUploadUrlResult> {
    const { customerId, fileName, fileType } = command;
    this.logger.log(`Getting upload URL for customer: ${customerId}, file: ${fileName}`);
    const result = await this.portRegistry.execute<GetUploadUrlResponse>(
      'document', 'get-upload-url',
      { customerId, fileName, fileType, metadata: { source: 'incident_report' } },
    );
    const uploadInfo = result?.data;
    if (!uploadInfo) {
      throw new NotFoundException('Failed to get upload URL — no response from document service');
    }
    return uploadInfo;
  }
}
```

#### Controller

```typescript
@ApiTags('Tickets')
@ApiBearerAuth('JWT-auth')
@Controller('tickets')
export class TicketController {
  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit incident report / create ticket' })
  async createTicket(
    @CurrentUser('id') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const validated = CreateTicketRequestSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException('Invalid ticket request');
    }
    return this.commandBus.execute(
      new CreateTicketCommand(userId, validated.data.type, validated.data.description, validated.data.imageUrls),
    );
  }

  @Post('upload-url')
  @ApiOperation({ summary: 'Get presigned URL for photo upload' })
  async getUploadUrl(
    @CurrentUser('id') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const validated = GetUploadUrlRequestSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException('Invalid upload URL request');
    }
    return this.commandBus.execute(
      new GetUploadUrlCommand(userId, validated.data.fileName, validated.data.fileType),
    );
  }
}
```

#### Ticket Module

```typescript
@Module({
  controllers: [TicketController],
  providers: [
    // Port Adapters (useExisting pattern)
    MockTicketAdapter,
    { provide: TICKET_PORT_TOKEN, useExisting: MockTicketAdapter },
    MockDocumentAdapter,
    { provide: DOCUMENT_PORT_TOKEN, useExisting: MockDocumentAdapter },
    // Command Handlers
    CreateTicketHandler,
    GetUploadUrlHandler,
  ],
  exports: [TICKET_PORT_TOKEN, DOCUMENT_PORT_TOKEN],
})
export class TicketModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockTicketAdapter: MockTicketAdapter,
    private readonly mockDocumentAdapter: MockDocumentAdapter,
  ) {}

  onModuleInit() {
    // ticket: dynamic tier — 5-15 min cache
    this.portRegistry.register('ticket', this.mockTicketAdapter, this.mockTicketAdapter);
    // document: transaction tier — NO CACHE (presigned URLs are one-time use)
    this.portRegistry.register('document', this.mockDocumentAdapter, this.mockDocumentAdapter);
  }
}
```

#### Mock JSON Files

**`mocks/ticket/create-ticket.json`**:
```json
{
  "trackingId": "TK-2026-002",
  "status": "submitted",
  "createdAt": "2026-06-10T09:30:00Z"
}
```

**`mocks/document/get-upload-url.json`**:
```json
{
  "uploadUrl": "https://storage.ioc.local/upload/tmp/inc-2026-photo-001?signature=abc123&expires=1718010000",
  "fileKey": "tmp/inc-2026-photo-001",
  "expiresAt": "2026-06-10T10:30:00Z"
}
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Create `session` module or Redis session events | Log session event via `this.logger.log()` — session module is Epic 7 |
| Handle file uploads in BFF (receive binary) | Return presigned URL — frontend uploads directly to storage |
| Implement photo cleanup/orphan logic | That's Document Service downstream — NOT BFF responsibility |
| Cache document presigned URLs | `cacheTier: transaction` — presigned URLs are one-time use, must be fresh |
| Put business logic in controller (validate incident type rules, etc.) | Controller validates Zod schema only → CommandBus → Handler → Port |
| Create separate `document` module for one port | Put `IDocumentPort` in ticket module — same pattern as `debt.port.ts` in payment module |
| Use `fetch()` to call Ticketing Service directly | Always use `PortRegistry.execute('ticket', ...)` |
| Implement Vietnamese search logic for anything | That's Story 5.4 KB search — pure downstream concern |
| Create `knowledge-base` port or controller | That's Story 5.4 — this story only creates ticket + document ports |

### 🔧 Module Registration in AppModule

Add `TicketModule` to `app.module.ts` AFTER `PaymentModule`:

```typescript
// In app.module.ts imports array, add:
import { TicketModule } from 'src/modules/ticket/ticket.module';
// ...
TicketModule,
```

Insert between `PaymentModule` and `AuthPropagationModule` to maintain the existing import ordering convention (modules → shared infrastructure).

### 🧪 Testing Requirements

1. **MockTicketAdapter — create-ticket** — Read JSON, validate `CreateTicketResponseSchema`, verify trackingId format
2. **MockDocumentAdapter — get-upload-url** — Read JSON, validate `GetUploadUrlResponseSchema`, verify URL format
3. **CreateTicketHandler — success** — Verify PortRegistry called with correct params (type, description, imageUrls, customerId, priority)
4. **CreateTicketHandler — null result** — Verify throws `NotFoundException`
5. **CreateTicketHandler — without images** — Verify imageUrls not included when undefined
6. **GetUploadUrlHandler — success** — Verify PortRegistry called with file params
7. **GetUploadUrlHandler — null result** — Verify throws `NotFoundException`
8. **Controller — POST /tickets** — Returns 200 with tracking ID
9. **Controller — POST /tickets/upload-url** — Returns 200 with presigned URL
10. **Controller — invalid body (missing type)** — Returns 400 `ValidationException`
11. **Controller — invalid body (empty description)** — Returns 400 `ValidationException`
12. **Controller — invalid body (too many images >5)** — Returns 400 `ValidationException`
13. **Controller — invalid fileType** — Returns 400 `ValidationException`
14. **Controller — verify command class types** — `toBeInstanceOf(CreateTicketCommand)`, `toBeInstanceOf(GetUploadUrlCommand)`

### Previous Story Learnings (Stories 1.1–4.5 — MUST Apply)

- **Module pattern**: `OnModuleInit` + `useExisting` for port adapters — follow `PaymentModule` exactly
- **Port registration**: `portRegistry.register(name, mockAdapter, mockAdapter)` — mock for both mock/live until live adapter exists
- **Command pattern**: Simple class implementing `ICommand`, handler uses `@CommandHandler()` decorator
- **Handler null guard**: Always check `result?.data` — throw `NotFoundException` if null
- **Controller validation**: `Schema.safeParse(body)` → `throw new ValidationException(...)` on failure
- **DI tokens**: `Symbol()` for type-safe injection
- **Mock adapter pattern**: Extend `MockAdapterBase`, pass port name + schema map + Logger to `super()`
- **Mock JSON**: Simple static files in `mocks/{port-name}/` directory
- **551+ tests passing** — ensure ZERO regressions when adding TicketModule
- **app.module.ts ordering**: Domain modules → `AuthPropagationModule` → `PortModule`

### 📋 Cross-Story Context

**Depends on (all complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Story R-1 (Session auth guard + CurrentUser decorator)

**Enables (future stories):**
- Story 5.2 (Ticket Tracking & Timeline) — will add query handlers + webhook controller to this module
- Story 5.3 (Ticket Feedback / CSAT) — will add `submitFeedback` to this module
- Story 5.4 (Knowledge Base & FAQ Search) — will add `IKnowledgeBasePort` to this module

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1: Incident Report Submission]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port Interface Catalog — ticket port, document port]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port 10: ticket — methods: createTicket, getTicketStatus, getTicketHistory, addComment, submitFeedback, handleWebhook, getServiceTypes]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port 14: document — methods: getUploadUrl, getDownloadUrl, deleteFile, getFileInfo]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules — NEVER call Backend API with bare fetch]
- [Source: _bmad-output/project-context.md#Adapter Contract — NormalizedRequest interface]
- [Source: src/modules/payment/payment.module.ts — Module registration pattern]
- [Source: src/modules/payment/infrastructure/http/payment.controller.ts — Controller pattern]
- [Source: src/modules/payment/infrastructure/ports/payment.port.ts — Port + MockAdapter pattern]
- [Source: src/modules/payment/application/commands/handlers/create-payment.handler.ts — Sequential orchestration pattern]
- [Source: src/modules/payment/application/dtos/payment.dto.ts — DTO schema pattern]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (glm-5[1m])

### Debug Log References

- 645/645 tests passing — zero regressions (77 test suites)
- 94 new tests added across 5 test files
- Code review: 7 findings (6 CONFIRMED, 1 PLAUSIBLE) — all fixed

### Completion Notes List

- ✅ Task 1: Ticket module scaffold — tokens, barrels, directory structure
- ✅ Task 2: Ticket DTOs — IncidentType, CreateTicket, GetUploadUrl schemas + types
- ✅ Task 3: MockTicketAdapter with `create-ticket` schema + mock JSON
- ✅ Task 4: MockDocumentAdapter with `get-upload-url` schema + mock JSON
- ✅ Task 5: GetUploadUrlCommand + Handler — PortRegistry → document port
- ✅ Task 6: CreateTicketCommand + Handler — PortRegistry → ticket port, useCache: false
- ✅ Task 7: TicketController — POST /tickets, POST /tickets/upload-url
- ✅ Task 8: TicketModule + AppModule registration — OnModuleInit, useExisting pattern
- ✅ Task 9: 94 new tests across 5 spec files
- ✅ Code Review Fix: Replaced NotFoundException → PortFallbackException in both handlers (HTTP 500 instead of 404 for downstream failures)
- ✅ Code Review Fix: Pass `validated.error.message` to ValidationException (field-level error info preserved)
- ✅ Code Review Fix: Extracted `INCIDENT_PRIORITY_DEFAULT` constant — no more magic string
- ✅ Code Review Fix: Relaxed tracking ID regex from `\d{3}` to `\d+` (flexible sequence length)
- ✅ Code Review Fix: Derive fileType type from DTO via `GetUploadUrlRequest['fileType']` — single source of truth

### File List

**NEW files (21):**
- `src/modules/ticket/constants/tokens.ts`
- `src/modules/ticket/domain/index.ts`
- `src/modules/ticket/application/index.ts`
- `src/modules/ticket/application/commands/index.ts`
- `src/modules/ticket/application/queries/index.ts`
- `src/modules/ticket/application/dtos/ticket.dto.ts`
- `src/modules/ticket/application/commands/create-ticket.command.ts`
- `src/modules/ticket/application/commands/get-upload-url.command.ts`
- `src/modules/ticket/application/commands/handlers/create-ticket.handler.ts`
- `src/modules/ticket/application/commands/handlers/get-upload-url.handler.ts`
- `src/modules/ticket/infrastructure/ports/ticket.port.ts`
- `src/modules/ticket/infrastructure/ports/document.port.ts`
- `src/modules/ticket/infrastructure/http/ticket.controller.ts`
- `src/modules/ticket/ticket.module.ts`
- `mocks/ticket/create-ticket.json`
- `mocks/document/get-upload-url.json`
- `src/modules/ticket/infrastructure/ports/ticket.port.spec.ts`
- `src/modules/ticket/infrastructure/ports/document.port.spec.ts`
- `src/modules/ticket/application/commands/handlers/create-ticket.handler.spec.ts`
- `src/modules/ticket/application/commands/handlers/get-upload-url.handler.spec.ts`
- `src/modules/ticket/infrastructure/http/ticket.controller.spec.ts`

**MODIFIED files (1):**
- `src/app.module.ts` — added TicketModule import
