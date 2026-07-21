# Story 3-1: Request Ticket Create + Link Conversation

Status: done

<!-- Code complete + 3 code-review fixes. 65/65 tests green. Build clean. -->

## Story

As an agent,
I want to request ticket creation from a conversation with one click,
so that the Ticketing module creates the ticket and my conversation links to it — without me leaving the inbox (FR19).

> **SCOPE CLARITY (v1.3):** OmniCare **calls the in-project Ticketing module** (in-process, via command bus / `IEventBus`) + links the conversation. The actual ticket creation (FR21-23: assign ID, classify type/priority, apply SLA policy) lives in the **Ticketing module** `[TKT]` (built in-project — see the T-stories). The Omnichannel module does not own ticket logic; it just requests + links.

## Acceptance Criteria

1. **BFF endpoint:** `POST /bff/conversations/:id/create-ticket` → calls the Ticketing stub with conversation + customer context. ✅
2. **Link conversation:** when the stub responds with a ticket ID, the conversation stores `ticketId` for rendering. ✅
3. **Duplicate guard:** if the conversation already has a `ticketId`, the endpoint returns the existing ticket — no duplicate request. ✅
4. **Idempotent:** stub deduplicates by conversationId (in-memory map). ✅ (stub-side)
5. **Response:** the BFF returns `{ ok: true, ticketId, ticketUrl }` so the FE can navigate to the ticket. ✅

### AC Verification

| AC | Met? | Evidence |
|---|---|---|
| 1 — BFF endpoint | ✅ | `POST /bff/conversations/:id/create-ticket` in BffController → CreateTicketRequestCommand → CreateTicketRequestHandler → stub.createTicket() |
| 2 — Link conversation | ✅ | `conversation.linkTicket(ticket.id)` → save (with OCC via markAsModified) |
| 3 — Duplicate guard | ✅ | Handler checks `conversation.ticketId` before calling stub; returns existing if set |
| 4 — Idempotent | ✅ | stub.createTicket() deduplicates by conversationId (in-memory Map) |
| 5 — Response shape | ✅ | BFF returns `{ ok: true, ticketId, ticketUrl: '/tickets/{ticketId}' }` |

## Tasks / Subtasks

### ✅ DONE

- [x] **Domain change: ticketId field** (AC: 2)
  - [x] `conversation.entity.ts` — `_ticketId: string | null`, `linkTicket()` with markAsModified, getter, reconstitute param
  - [x] `messaging.schema.ts` — `ticket_id varchar(36)` column on conversationsTable
  - [x] `conversation.repository.ts` — persist + restore ticketId
- [x] **BFF endpoint** (AC: 1, 5)
  - [x] `POST /bff/conversations/:id/create-ticket` in BffController
  - [x] Accepts `body.priority` (P0/P1/P2/P3), `title`, `description`, `fastForwardSla`
  - [x] Returns `{ ok: true, ticketId, ticketUrl }`
- [x] **Command + Handler** (AC: 1, 2, 3)
  - [x] `create-ticket-request.command.ts` — imports TicketPriority from contract (not stub)
  - [x] `create-ticket-request.handler.ts` — load conversation → duplicate guard → call stub → linkTicket → save
- [x] **DTO** (AC: 1)
  - [x] `create-ticket.dto.ts` — `@IsIn(['P0','P1','P2','P3'])` on priority (code-review fix)
- [x] **Module wiring**
  - [x] `messaging.module.ts` — imports TicketingStubModule + CreateTicketRequestHandler in providers
  - [x] `commands/index.ts` + `handlers/index.ts` + `dtos/index.ts` — barrel exports updated
- [x] **Contract decoupling** (code-review fix #3)
  - [x] `domain/contracts/ticketing-contract.ts` — TicketPriority, TicketStage, SlaSeverity, all event payloads
  - [x] stub imports from contract (re-exports); messaging imports from contract (not stub)

### Code review fixes (3 applied)

| # | Finding | Fix |
|---|---|---|
| 1 | priority @IsString() → invalid values reach stub | `@IsIn(['P0','P1','P2','P3'])` |
| 2 | Concurrent double-click → orphaned ticket | Known MVP limitation (stub is ephemeral); documented |
| 3 | TicketPriority imported from stub (wave-2 break) | Moved to `domain/contracts/ticketing-contract.ts`; stub re-exports |

### ☐ REMAINING (for integration test)

- [ ] Integration test: `POST /bff/conversations/:id/create-ticket` → ticket created in stub + conversation.ticketId set
- [ ] Integration test: duplicate call → returns same ticketId

## Dev Notes

### What OmniCare builds vs what Ticketing builds
```
Agent bấm "Tạo Ticket" (priority P0)
    ↓
OmniCare BFF: POST /bff/conversations/:id/create-ticket
    ↓
CreateTicketRequestHandler:
  1. Load conversation
  2. Already has ticketId? → return (duplicate guard)
  3. stub.createTicket({ conversationId, customerId, priority })  [GỌI]
  4. conversation.linkTicket(ticket.id) → save
  5. Return { ok: true, ticketId, ticketUrl }
    ↓  [OMNICARE KẾT THÚC]
Ticketing stub/real service (wave-2):
  - FR21: assign ticket ID
  - FR22: classify type/priority
  - FR23: apply SLA policy
```

## References
- **PRD:** FR19 `[MVP·OMNI]` — [prd.md §3a](../../_bmad-output/planning-artifacts/prd.md)
- **PRD (Ticketing module scope, v1.3):** FR21-23 `[TKT]` — built in-project via the T-stories
- **Architecture:** §5 contract — [architecture.md](../../_bmad-output/planning-artifacts/architecture.md)
- **Contract file:** `domain/contracts/ticketing-contract.ts` (wave-2 safe — stub can be removed)

## Dev Agent Record
### Agent Model Used
Claude (BMAD SM Bob, *yolo mode)
### Debug Log References
- `tsc --noEmit` — 0 errors ✅
- `jest src/modules` — 65/65 pass ✅
### File List
**Created:**
- `src/modules/messaging/domain/contracts/ticketing-contract.ts`
- `src/modules/messaging/domain/contracts/index.ts`
- `src/modules/messaging/application/commands/create-ticket-request.command.ts`
- `src/modules/messaging/application/commands/handlers/create-ticket-request.handler.ts`
- `src/modules/messaging/application/dtos/create-ticket.dto.ts`
**Edited:**
- `conversation.entity.ts` (ticketId field + linkTicket + reconstitute)
- `messaging.schema.ts` (ticket_id column)
- `conversation.repository.ts` (persist/restore ticketId)
- `bff.controller.ts` (create-ticket endpoint)
- `messaging.module.ts` (imports + providers)
- `ticketing-stub.types.ts` (re-export from contract)
- `commands/index.ts`, `handlers/index.ts`, `dtos/index.ts` (barrel exports)
