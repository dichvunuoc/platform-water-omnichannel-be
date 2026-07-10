# Story 1.4: Unified Inbox BFF Endpoints + Bootstrap

Status: ready-for-dev

## Story

As an agent opening the workspace,
I want the inbox loaded fast + a bootstrap payload,
so that the delivered FE reaches interactivity quickly (FR9, FR13, FR17, NFR2, NFR3).

## Acceptance Criteria

1. **Inbox list:** `GET /bff/inbox?page=1&limit=20&channel=ZALO&status=ACTIVE` returns paginated conversations (id, customerChannelId, channel, lastMessage preview, messageCount, updatedAt) ordered by most-recent (FR9/FR17).
2. **Conversation detail:** `GET /bff/conversations/:id` returns the full thread (messages in chronological order) + customer info stub (Customer 360 is mock until Epic 2) + ticket/SLA chip (mock until Epic 3) (FR10/FR13).
3. **Bootstrap:** `GET /bff/bootstrap` returns `{ session, inboxPage1, unreadCount, presence }` in **≤1s p95** (NFR3) — a single call for fast FE interactivity.
4. **BFF read latency:** all BFF GET endpoints respond **≤500ms p95** under normal load (NFR2).

## Tasks / Subtasks

- [ ] **ConversationReadDao** (AC: 1)
  - [ ] Create `src/modules/messaging/infrastructure/persistence/read/conversation-read-dao.ts` — paginated inbox query (joins `conversations` + last `messages` row); implements read DAO pattern (mirror `OrderReadDao`)
  - [ ] `findInbox(filters, page, limit)` → paginated conversation summaries with last-message preview
  - [ ] `findById(id)` → conversation + all messages chronologically
  - [ ] Register `CONVERSATION_READ_DAO_TOKEN` provider in `MessagingModule`
- [ ] **BFF controller** (AC: 1, 2, 3)
  - [ ] Create `src/modules/messaging/infrastructure/http/bff.controller.ts` — `@Controller('bff')`
  - [ ] `GET /bff/inbox` → ConversationReadDao.findInbox()
  - [ ] `GET /bff/conversations/:id` → ConversationReadDao.findById() + join Customer360 (mock) + ticket chip (mock)
  - [ ] `GET /bff/bootstrap` → aggregate session + inbox p1 + counters (optimized single query)
- [ ] **Query handlers** (optional — can call read DAO directly from controller for MVP)
  - [ ] `GetInboxQuery` + handler → ConversationReadDao.findInbox()
  - [ ] `GetConversationQuery` + handler → ConversationReadDao.findById()
- [ ] **Tests** (AC: 1, 2, 4)
  - [ ] Unit: inbox pagination + filters
  - [ ] Integration: `GET /bff/inbox` returns seeded conversations; `GET /bff/bootstrap` ≤1s

## Dev Notes

- The BFF controller is the **SPA's HTTP entry point** (alongside the realtime gateway for WS). It aggregates omnichannel data + (mock) sibling data.
- For MVP: Customer 360 + ticket/SLA chip are **mock stubs** (return static data). Real integration lands in Epic 2 + Epic 3.
- The `GET /bff/bootstrap` endpoint is performance-critical (NFR3 ≤1s). Optimize: single DB round-trip (conversation count + first page in one query), or parallel queries.
- Auth guard (existing) protects these endpoints — agents must be authenticated.

## References
- **PRD:** FR9 (unified inbox), FR10 (conversation detail), FR13 (timeline), FR17 (filter), NFR2 (BFF ≤500ms), NFR3 (bootstrap ≤1s) — [prd.md](../../_bmad-output/planning-artifacts/prd.md)
- **Architecture:** §3.2 BFF (aggregation), §4 Backend Surface — [architecture.md](../../_bmad-output/planning-artifacts/architecture.md)
- **Existing:** `OrderReadDao` pattern to mirror; `BaseReadDao` base class; `DATABASE_READ_TOKEN` for read-replica.
