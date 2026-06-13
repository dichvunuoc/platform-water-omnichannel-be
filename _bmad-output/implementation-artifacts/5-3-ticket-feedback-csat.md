# Story 5.3: Ticket Feedback (CSAT)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **customer (Anh Tuấn)**,
I want to rate my experience when a ticket is closed,
so that the water company knows how they're doing and can improve.

## Acceptance Criteria

### AC1: CSAT Feedback Form Display (FR45)
**Given** an authenticated customer has a ticket with status "Closed"
**When** they view the ticket detail
**Then** a CSAT feedback form is displayed: 1-5 star rating + optional text comment.

### AC2: Submit CSAT Feedback (FR45)
**Given** a customer submits CSAT feedback
**When** the BFF processes it
**Then** it calls `ITicketPort.submitFeedback(ticketId, score, comment)` via PortRegistry
**And** returns success confirmation to the customer.

### AC3: Low Score Flagging (FR45)
**Given** a ticket with CSAT score < 3 stars is submitted
**When** the BFF processes the feedback
**Then** the system flags the ticket for follow-up in the session event log
**And** note: Phase 2 auto-reopen if < 3/5 stars is a downstream responsibility — BFF only sends the feedback score.

## Tasks / Subtasks

- [x] Task 1: Add CSAT Feedback DTOs (AC: #1, #2, #3)
  - [x] Add `CsatScoreSchema` — `z.number().int().min(1).max(5)`
  - [x] Add `SubmitFeedbackRequestSchema` — `{ score, comment? }` (controller input)
  - [x] Add `SubmitFeedbackResponseSchema` — `{ ticketId, score, submittedAt }` (port response)
  - [x] Export all TypeScript types

- [x] Task 2: Extend MockTicketAdapter with `submit-feedback` (AC: #2)
  - [x] Add `'submit-feedback': SubmitFeedbackResponseSchema` to MockTicketAdapter schema map
  - [x] Create `mocks/ticket/submit-feedback.json` — mock response

- [x] Task 3: Create Submit Feedback Command + Handler (AC: #2, #3)
  - [x] Create `src/modules/ticket/application/commands/submit-feedback.command.ts`
  - [x] Create `src/modules/ticket/application/commands/handlers/submit-feedback.handler.ts`
  - [x] Handler: inject `PortRegistry`, call `execute('ticket', 'submit-feedback', { ticketId, score, comment })` with `useCache: false`
  - [x] Handler: if `score < 3`, log flag for follow-up (session event TODO — Epic 7)
  - [x] Returns `SubmitFeedbackResult`

- [x] Task 4: Add Feedback Endpoint to TicketController (AC: #1, #2)
  - [x] Add `POST /tickets/:trackingId/feedback` → dispatch `SubmitFeedbackCommand`
  - [x] Validate request body with `SubmitFeedbackRequestSchema`
  - [x] `trackingId` from `@Param`, score + comment from `@Body`

- [x] Task 5: Update TicketModule Registration (AC: all)
  - [x] Add `SubmitFeedbackHandler` to providers
  - [x] Update commands barrel export

- [x] Task 6: Write comprehensive tests (AC: all)
  - [x] `submit-feedback.handler.spec.ts` — verify PortRegistry call, low-score flagging
  - [x] `ticket.controller.spec.ts` — add test for POST /tickets/:trackingId/feedback
  - [x] `ticket.port.spec.ts` — add test for submit-feedback mock schema
  - [x] Test low score (< 3) triggers flag log
  - [x] Test high score (≥ 3) does NOT trigger flag log

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story **EXTENDS** the existing `ticket` module. It adds one new command (`submitFeedback`) — the simplest story in Epic 5. No webhooks, no queries, no cache invalidation, no new ports.

#### What ALREADY EXISTS — DO NOT RECREATE

| Component | Location | Status |
|-----------|----------|--------|
| **MockTicketAdapter** | `infrastructure/ports/ticket.port.ts` | ✅ Has `'create-ticket'` (5.1) + may have `'get-ticket-status'`, `'get-ticket-history'` (5.2) — ADD `'submit-feedback'` |
| **ITicketPort** | `infrastructure/ports/ticket.port.ts` | ✅ Interface exists — methods via `execute()`, no changes needed |
| **TicketController** | `infrastructure/http/ticket.controller.ts` | ✅ Has POST + GET endpoints — ADD `POST /tickets/:trackingId/feedback` |
| **TicketModule** | `ticket.module.ts` | ✅ Registered — ADD `SubmitFeedbackHandler` |
| **DI Tokens** | `constants/tokens.ts` | ✅ No new tokens needed |
| **DTOs** | `application/dtos/ticket.dto.ts` | ✅ Has existing schemas — ADD CSAT schemas |
| **CreateTicketHandler** | `application/commands/handlers/` | ✅ Pattern reference |
| **Mock JSON** | `mocks/ticket/` | ✅ Has `create-ticket.json` — ADD `submit-feedback.json` |

#### ⚡ Key Architecture Points

**Ticket Port Method (from architecture Port Catalog #10):**
- `submitFeedback` — 🆕 This story. Sends CSAT score + comment to downstream Ticketing Service.
- BFF does NOT own feedback logic — pure pass-through to downstream.
- Phase 2 "auto-reopen if < 3 stars" is downstream responsibility. BFF only logs the flag.

**Cache:** `useCache: false` — feedback submission is a write operation, must hit downstream live.
**No webhook** — this story doesn't receive webhooks, it only sends feedback outbound.
**No session events** — log via `this.logger.log()` with TODO for Epic 7 session module.

#### What ALREADY EXISTS in Other Modules — REUSE PATTERNS

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **Command pattern** | `ticket/application/commands/create-ticket.command.ts` | EXACT template — `ICommand` class + result type |
| **Command handler** | `ticket/application/commands/handlers/create-ticket.handler.ts` | EXACT template — `@CommandHandler`, `PortRegistry.execute()`, null guard |
| **Controller POST** | `ticket/infrastructure/http/ticket.controller.ts` | EXACT template — `Schema.safeParse(body)`, `ValidationException`, `commandBus.execute()` |
| **MockAdapter extension** | `ticket/infrastructure/ports/ticket.port.ts` | Add schema to existing map in constructor |
| **Mock JSON** | `mocks/ticket/create-ticket.json` | Same format — simple JSON file |
| **PortFallbackException** | `@shared/port/port-exceptions` | Throw on null `result?.data` |

### 📁 File Structure — Changes

```
src/modules/ticket/
├── application/
│   ├── commands/
│   │   ├── create-ticket.command.ts                     ← NO CHANGE
│   │   ├── get-upload-url.command.ts                    ← NO CHANGE
│   │   ├── submit-feedback.command.ts                   ← NEW (AC#2)
│   │   ├── index.ts                                     ← UPDATE (add export)
│   │   └── handlers/
│   │       ├── create-ticket.handler.ts                 ← NO CHANGE
│   │       ├── get-upload-url.handler.ts                ← NO CHANGE
│   │       ├── submit-feedback.handler.ts               ← NEW (AC#2, #3)
│   │       └── submit-feedback.handler.spec.ts          ← NEW
│   ├── queries/                                         ← NO CHANGE (5.2 territory)
│   ├── dtos/
│   │   └── ticket.dto.ts                                ← UPDATE (add CSAT schemas)
│   └── index.ts                                         ← NO CHANGE
├── infrastructure/
│   ├── http/
│   │   ├── ticket.controller.ts                         ← UPDATE (add POST feedback endpoint)
│   │   └── ticket.controller.spec.ts                    ← UPDATE (add feedback tests)
│   └── ports/
│       ├── ticket.port.ts                               ← UPDATE (add 'submit-feedback' schema)
│       └── ticket.port.spec.ts                          ← UPDATE (add submit-feedback test)
├── constants/
│   └── tokens.ts                                        ← NO CHANGE
└── ticket.module.ts                                     ← UPDATE (add SubmitFeedbackHandler)

mocks/
└── ticket/
    ├── create-ticket.json                               ← NO CHANGE
    └── submit-feedback.json                             ← NEW
```

### 🔧 Implementation Details

#### New DTOs to Add (`ticket.dto.ts`)

Append these schemas to the existing `ticket.dto.ts`:

```typescript
// =============================================================================
// AC#1,#2,#3: CSAT Feedback (FR45)
// =============================================================================

/** CSAT score: 1-5 stars */
export const CsatScoreSchema = z.number().int().min(1).max(5);
export type CsatScore = z.infer<typeof CsatScoreSchema>;

/** Low score threshold — scores below this trigger follow-up flagging */
export const CSAT_LOW_SCORE_THRESHOLD = 3;

/** Controller input: submit feedback request */
export const SubmitFeedbackRequestSchema = z.object({
  score: CsatScoreSchema,
  comment: z.string().max(1000).optional(),
});
export type SubmitFeedbackRequest = z.infer<typeof SubmitFeedbackRequestSchema>;

/** Port response: feedback submission result */
export const SubmitFeedbackResponseSchema = z.object({
  ticketId: z.string(),
  score: CsatScoreSchema,
  submittedAt: z.string(),
});
export type SubmitFeedbackResponse = z.infer<typeof SubmitFeedbackResponseSchema>;
```

#### Update MockTicketAdapter (`ticket.port.ts`)

```typescript
// ADD this import:
import {
  CreateTicketResponseSchema,
  // ... other existing imports (Story 5.2 may have added these) ...
  SubmitFeedbackResponseSchema,  // NEW
} from '../../application/dtos/ticket.dto';

// ADD to constructor schema map:
'submit-feedback': SubmitFeedbackResponseSchema,
```

#### Submit Feedback Command

```typescript
// submit-feedback.command.ts
import { ICommand } from '@core/application';
import type { SubmitFeedbackResponse } from '../../dtos/ticket.dto';

export class SubmitFeedbackCommand implements ICommand {
  constructor(
    public readonly ticketId: string,
    public readonly customerId: string,
    public readonly score: number,
    public readonly comment?: string,
  ) {}
}

export type SubmitFeedbackResult = SubmitFeedbackResponse;
```

#### Submit Feedback Handler

```typescript
// handlers/submit-feedback.handler.ts
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { SubmitFeedbackCommand, SubmitFeedbackResult } from '../submit-feedback.command';
import type { SubmitFeedbackResponse } from '../../../dtos/ticket.dto';
import { CSAT_LOW_SCORE_THRESHOLD } from '../../../dtos/ticket.dto';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';

@CommandHandler(SubmitFeedbackCommand)
export class SubmitFeedbackHandler implements ICommandHandler<SubmitFeedbackCommand> {
  private readonly logger = new Logger(SubmitFeedbackHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: SubmitFeedbackCommand): Promise<SubmitFeedbackResult> {
    const { ticketId, customerId, score, comment } = command;

    this.logger.log(`Submitting CSAT feedback for ticket: ${ticketId}, score: ${score}`);

    const result: PortResult<SubmitFeedbackResponse> =
      await this.portRegistry.execute<SubmitFeedbackResponse>(
        'ticket', 'submit-feedback',
        { ticketId, customerId, score, comment, useCache: false },
      );

    const feedback = result?.data;
    if (!feedback) {
      throw new PortFallbackException('ticket');
    }

    // AC#3: Flag low-score tickets for follow-up
    if (score < CSAT_LOW_SCORE_THRESHOLD) {
      this.logger.warn(
        `Low CSAT alert: ticket ${ticketId} scored ${score}/5 — flagged for follow-up`,
      );
      // TODO: Record session event when session module is built (Epic 7)
      // { type: "ticket_flagged_low_csat", ticketId, score }
    }

    this.logger.log(`CSAT feedback submitted: ${ticketId} → ${score}/5`);
    return feedback;
  }
}
```

#### Update TicketController — Add Feedback Endpoint

```typescript
// ADD this import:
import { SubmitFeedbackCommand } from '../../application/commands/submit-feedback.command';
import { SubmitFeedbackRequestSchema } from '../../application/dtos/ticket.dto';

// ADD this endpoint:

/**
 * POST /tickets/:trackingId/feedback
 * Submit CSAT feedback for a closed ticket (AC#1, #2 — FR45)
 */
@Post(':trackingId/feedback')
@ApiOperation({ summary: 'Submit CSAT feedback for a ticket' })
async submitFeedback(
  @CurrentUser('id') userId: string,
  @Param('trackingId') trackingId: string,
  @Body() body: Record<string, unknown>,
) {
  const validated = SubmitFeedbackRequestSchema.safeParse(body);
  if (!validated.success) {
    throw new ValidationException(validated.error.message);
  }

  return this.commandBus.execute(
    new SubmitFeedbackCommand(
      trackingId,
      userId,
      validated.data.score,
      validated.data.comment,
    ),
  );
}
```

#### Update TicketModule

```typescript
// ADD this import:
import { SubmitFeedbackHandler } from './application/commands/handlers/submit-feedback.handler';

// ADD to providers array:
SubmitFeedbackHandler,
```

#### Mock JSON

**`mocks/ticket/submit-feedback.json`**:
```json
{
  "ticketId": "TK-2026-002",
  "score": 4,
  "submittedAt": "2026-06-10T15:30:00Z"
}
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Implement auto-reopen logic for low CSAT | That's downstream responsibility — BFF only sends score + logs flag |
| Validate ticket status is "Closed" before accepting feedback | That's downstream responsibility — BFF is pass-through |
| Create a new port or module for feedback | Use existing `ITicketPort` — `submitFeedback` is a method on the `ticket` port |
| Cache feedback submissions | `useCache: false` — feedback is a write operation |
| Implement session event recording | Log via `this.logger.warn()` — session module is Epic 7 |
| Hardcode `3` as the low-score threshold | Extract `CSAT_LOW_SCORE_THRESHOLD` constant in DTOs |
| Create a separate feedback controller | Add endpoint to existing `TicketController` |
| Validate that `comment` is required | `comment` is optional per AC#1 — only score is required |
| Implement business rules around feedback (one per ticket, etc.) | That's downstream responsibility — BFF is pass-through |

### 🔧 Important Implementation Notes

#### Dependency on Story 5.2

Story 5.3 is **independent** of Story 5.2. The only dependency is Story 5.1 (ticket module scaffold). Specifically:

- Story 5.2 adds query handlers + webhook controller to the ticket module
- Story 5.3 adds `submit-feedback` command + handler
- These are orthogonal — can be implemented in any order or in parallel

**However**, if both stories are developed simultaneously, the developer must be aware that:
1. `MockTicketAdapter` constructor schema map will need updates from BOTH stories
2. `TicketController` will need new endpoints from BOTH stories
3. `TicketModule` providers array will need handlers from BOTH stories
4. `ticket.dto.ts` will need new schemas from BOTH stories
5. `commands/index.ts` barrel will need exports from BOTH stories

If Story 5.2 is NOT yet implemented, the developer should implement 5.3 against the current codebase state (Story 5.1 only) and not assume 5.2 files exist.

#### BFF is a Pass-Through

This story reinforces a critical architectural principle: **BFF does NOT own business logic**. The CSAT feedback flow is:
```
Customer → BFF Controller → CommandBus → Handler → PortRegistry → Downstream Ticketing Service
```

BFF validates the Zod schema (score is 1-5, comment length) but does NOT enforce:
- Whether the ticket is in "Closed" status
- Whether feedback has already been submitted
- Whether the customer owns the ticket
- Whether to auto-reopen on low score

All of those are downstream Ticketing Service responsibilities.

### 🧪 Testing Requirements

1. **MockTicketAdapter — submit-feedback** — Read JSON, validate `SubmitFeedbackResponseSchema`
2. **SubmitFeedbackHandler — success (high score ≥ 3)** — Verify PortRegistry called with correct params, NO low-score warning log
3. **SubmitFeedbackHandler — success (low score < 3)** — Verify PortRegistry called + `logger.warn` called with low CSAT alert
4. **SubmitFeedbackHandler — null result** — Verify throws `PortFallbackException`
5. **SubmitFeedbackHandler — score boundary (3)** — Verify NOT flagged (threshold is `< 3`, not `≤ 3`)
6. **SubmitFeedbackHandler — score boundary (2)** — Verify IS flagged
7. **SubmitFeedbackHandler — score boundary (1)** — Verify IS flagged
8. **SubmitFeedbackHandler — without comment** — Verify comment undefined in PortRegistry call
9. **SubmitFeedbackHandler — with comment** — Verify comment passed through
10. **Controller — POST /tickets/:trackingId/feedback** — Returns 200 with feedback confirmation
11. **Controller — invalid body (missing score)** — Returns 400 `ValidationException`
12. **Controller — invalid body (score = 0)** — Returns 400 (below min 1)
13. **Controller — invalid body (score = 6)** — Returns 400 (above max 5)
14. **Controller — invalid body (score = 3.5)** — Returns 400 (not integer)
15. **Controller — valid body with comment** — Returns 200
16. **Controller — valid body without comment** — Returns 200
17. **Controller — verify command class type** — `toBeInstanceOf(SubmitFeedbackCommand)`

### Previous Story Learnings (Stories 1.1–5.1 — MUST Apply)

- **Command pattern**: Simple class implementing `ICommand`, handler uses `@CommandHandler()` decorator
- **Handler null guard**: Always check `result?.data` — throw `PortFallbackException` if null (NOT NotFoundException — code review fix from Story 5.1)
- **Controller validation**: `Schema.safeParse(body)` → `throw new ValidationException(validated.error.message)` on failure (passes field-level error info — code review fix from Story 5.1)
- **Mock adapter pattern**: Extend `MockAdapterBase`, add schema to constructor map
- **Mock JSON**: Simple static files in `mocks/{port-name}/` directory
- **Module registration**: Add handler to `providers` array in `@Module` decorator
- **Extract constants**: Use named constants like `CSAT_LOW_SCORE_THRESHOLD` instead of magic numbers (learned from `INCIDENT_PRIORITY_DEFAULT` in Story 5.1)
- **645+ tests passing** — ensure ZERO regressions
- **No bare fetch** — Always use `PortRegistry.execute('ticket', ...)`

### 📋 Cross-Story Context

**Depends on (complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Story R-1 (Session auth guard + CurrentUser decorator)
- Story 5.1 (Ticket module scaffold, ITicketPort, MockTicketAdapter, CreateTicketHandler)

**Independent of:**
- Story 5.2 (Ticket Tracking & Timeline) — can be implemented in parallel or any order

**Enables (future stories):**
- Story 5.4 (Knowledge Base & FAQ Search) — will add `IKnowledgeBasePort` to ticket module
- Story 7.1 (Session Store) — will replace `this.logger.warn()` with real session event recording

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.3: Ticket Feedback (CSAT)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port 10: ticket — methods: submitFeedback]
- [Source: _bmad-output/planning-artifacts/architecture.md#Cache Strategy — ticket: dynamic tier]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules — NEVER call Backend API with bare fetch]
- [Source: src/modules/ticket/infrastructure/ports/ticket.port.ts — Existing MockTicketAdapter to extend]
- [Source: src/modules/ticket/infrastructure/http/ticket.controller.ts — Existing controller to add feedback endpoint]
- [Source: src/modules/ticket/ticket.module.ts — Existing module to add handler]
- [Source: src/modules/ticket/application/commands/handlers/create-ticket.handler.ts — Handler pattern reference]

## Dev Agent Record

### Agent Model Used

glm-5[1m]

### Debug Log References

- 82 test suites, 740 tests — ALL PASSING, ZERO REGRESSIONS

### Completion Notes List

- ✅ Task 1: Added CsatScoreSchema, CSAT_LOW_SCORE_THRESHOLD constant, SubmitFeedbackRequestSchema, SubmitFeedbackResponseSchema to ticket.dto.ts
- ✅ Task 2: Extended MockTicketAdapter with 'submit-feedback' schema + created mocks/ticket/submit-feedback.json
- ✅ Task 3: Created SubmitFeedbackCommand + Handler — PortRegistry execute with useCache: false, low-score (< 3) flagging with logger.warn, null guard with PortFallbackException
- ✅ Task 4: Added POST /tickets/:trackingId/feedback to TicketController — validates with SubmitFeedbackRequestSchema, dispatches SubmitFeedbackCommand
- ✅ Task 5: Added SubmitFeedbackHandler to TicketModule providers + updated commands barrel
- ✅ Task 6: Created submit-feedback.handler.spec.ts (17 tests), updated ticket.controller.spec.ts (13 new tests), updated ticket.port.spec.ts (12 new tests)
- Bug fix: Corrected relative import paths in query handlers (../../../dtos/ → ../../dtos/) and submit-feedback handler — `import type` masked the wrong path in query handlers since TypeScript erases type-only imports at compile time

### File List

**NEW files:**
- src/modules/ticket/application/commands/submit-feedback.command.ts
- src/modules/ticket/application/commands/handlers/submit-feedback.handler.ts
- src/modules/ticket/application/commands/handlers/submit-feedback.handler.spec.ts
- mocks/ticket/submit-feedback.json

**MODIFIED files:**
- src/modules/ticket/application/dtos/ticket.dto.ts
- src/modules/ticket/infrastructure/ports/ticket.port.ts
- src/modules/ticket/infrastructure/ports/ticket.port.spec.ts
- src/modules/ticket/infrastructure/http/ticket.controller.ts
- src/modules/ticket/infrastructure/http/ticket.controller.spec.ts
- src/modules/ticket/application/commands/index.ts
- src/modules/ticket/application/queries/handlers/get-ticket-status.handler.ts (import path fix)
- src/modules/ticket/application/queries/handlers/get-ticket-history.handler.ts (import path fix)
- src/modules/ticket/ticket.module.ts
