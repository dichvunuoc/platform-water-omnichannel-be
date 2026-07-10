# Story 1.1: Multi-Channel Webhook Ingress + 200-OK + Idempotency

Status: review

<!-- Code complete + unit tested (16/16) + code-reviewed (3 fixes applied).
     Remaining for `done`: integration test (needs running PostgreSQL). -->

## Story

As a channel partner (Zalo OA / App / Facebook / Email),
I want my webhook acknowledged with HTTP 200 immediately and my message ingested without duplication or loss,
so that I never time out and the customer's interaction is never dropped — even when downstream services are slow or down.

## Acceptance Criteria

1. **200-OK independent of downstream (NFR4/FR2):** webhook endpoints (`POST /webhooks/zalo`, `/webhooks/inbound`) return HTTP 200 within 200ms of receipt; the response does NOT wait for downstream consumers (realtime push, Ticketing, CSAT) — those receive via the outbox→bus asynchronously.
2. **Idempotent dedup (FR3):** a duplicate webhook (same `channel` + `externalMessageId`) is detected via `IdempotencyService` and discarded; the original result is returned without re-processing.
3. **No message loss (FR7/NFR9):** if a downstream consumer (or the DB write) fails, the interaction is retained in the transactional outbox and retried; zero inbound messages are lost.
4. **Normalization (FR4):** inbound from any channel is normalized into the `OmniMessage` format (the `Message` entity — channel-agnostic: `channel`, `direction`, `senderType`, `content`, `externalId`, `attachments`).
5. **Unified thread (FR1/FR8):** messages attach to a `Conversation` (find-by-customer-channel or create-new); threads render in correct chronological order.

### AC Verification

| AC | Met? | Evidence |
|---|---|---|
| 1 — 200-OK | ✅ | `@HttpCode(200)` + outbox-decoupled handler (save fast, publish async). Timing benchmark pending running env. |
| 2 — Dedup | ✅ | `IdempotencyService` keyed `channel:externalMessageId`; optimistic store-before-save. Tests: "idempotency HIT" + "key format" ✅ |
| 3 — No loss | ✅ | `BaseAggregateRepository` → `IOutboxRepository.addMany(events, tx)` in same DB tx. Integration test pending DB. |
| 4 — Normalization | ✅ | `Message` entity (channel-agnostic); `zaloToDto()` normalizer; `Channel` VO. App/FB/Email normalizers in story 1-2. |
| 5 — Unified thread | ✅ | `Conversation` aggregate; `receiveMessage()` append-only; `findActiveByCustomerChannel()`. Tests: "chronological" + "CLOSED throws" ✅ |

## Tasks / Subtasks

### ✅ DONE

- [x] **Domain layer** (`src/modules/messaging/domain/`) (AC: 4, 5)
  - [x] `value-objects/channel.value-object.ts` — `Channel` VO (ZALO/APP/FACEBOOK/EMAIL/VOIP) + `isVoice`
  - [x] `entities/message.entity.ts` — `Message` (child entity) = normalized OmniMessage; `MessageDirection`, `SenderType`; `externalId`; `attachments`
  - [x] `entities/conversation.entity.ts` — `Conversation` aggregate root; `receiveMessage()`, `assignCustomer()`, `close()/archive()` (+ `markAsModified()` for OCC); `ConversationStatus`; enqueues `MessageReceived` + `ConversationStarted`
  - [x] `events/message-received.event.ts` — `MessageReceivedEvent` (aggregateId = conversationId)
  - [x] `events/conversation-started.event.ts` — `ConversationStartedEvent` (triggers identity resolution)
  - [x] `repositories/conversation.repository.interface.ts` — `IConversationRepository` + `findActiveByCustomerChannel()` + `findActiveConversations()`
  - [x] `index.ts` barrel

- [x] **Application layer** (`src/modules/messaging/application/`) (AC: 2, 3, 4)
  - [x] `commands/receive-inbound-message.command.ts`
  - [x] `commands/handlers/receive-inbound-message.handler.ts` — idempotency store-before-save → find/create → receiveMessage → repo.save → try/catch rollback
  - [x] `dtos/inbound-message.dto.ts`
  - [x] barrel indices

- [x] **Infrastructure HTTP** (AC: 1)
  - [x] `inbound-webhook.controller.ts` — `POST /webhooks/inbound` + `POST /webhooks/zalo` (zaloToDto normalizer); `@HttpCode(200)`

- [x] **Infrastructure Persistence** (AC: 3, 4, 5)
  - [x] `drizzle/schema/messaging.schema.ts` — `conversationsTable` + `messagesTable` + relations + types
  - [x] `write/conversation.repository.ts` — Drizzle write impl; `BaseAggregateRepository` (outbox + OCC); `save()` upsert + messages; `getById()` reconstitute; `findActiveByCustomerChannel()`; `findActiveConversations()`

- [x] **Module wiring** (AC: 1)
  - [x] `messaging.module.ts` — SharedCqrsModule + controller + repository + handler + IdempotencyService
  - [x] `index.ts` barrel
  - [x] `constants/tokens.ts`
  - [x] Registered in `app.module.ts` (MessagingModule added to imports)
  - [x] Schema registered in `src/libs/shared/database/drizzle/schema/index.ts`

- [x] **Unit tests** (AC: 2, 4, 5) — **16/16 pass**
  - [x] `conversation.entity.spec.ts` (12 tests): create, receiveMessage (ACTIVE/CLOSED), close/archive lifecycle, assignCustomer, reconstitute
  - [x] `receive-inbound-message.handler.spec.ts` (4 tests): new conversation, append existing, idempotency HIT, key format

- [x] **Code review fixes** (3 correctness issues found + fixed)
  - [x] Fix #1: idempotency store moved BEFORE save + try/catch rollback (race condition)
  - [x] Fix #2: `close()/archive()` now call `markAsModified()` (OCC version increment)
  - [x] Fix #3: `assignCustomer()` now calls `markAsModified()` (OCC version increment)

### ☐ REMAINING (for `done` status)

- [ ] **Integration test** (AC: 1, 2, 3) — needs running PostgreSQL + Redis
  - [ ] `POST /webhooks/zalo` → 200 OK + message persisted + outbox entry created
  - [ ] Duplicate webhook → same result, no double-insert (idempotency)
  - [ ] Save failure → outbox rollback → retry succeeds

### 📌 DEFERRED (not in this story's scope)

- ConversationReadDao → **story 1.4** (BFF inbox endpoints)
- App/FB/Email normalizers → **story 1-2** (per-channel normalizer completeness)
- 200ms timing benchmark → needs running env + load test

## Dev Notes

### Outbox flow (FR7/NFR9)
1. Handler calls `conversationRepository.save(conversation)`.
2. Repository opens a Drizzle transaction via `BaseAggregateRepository.persist()`.
3. Within the tx: upsert conversation + messages + `getDomainEvents()` → `IOutboxRepository.addMany(events, tx)`.
4. Commit tx (atomic: aggregate + events persist together, or neither).
5. `OutboxProcessor` (background) publishes pending entries to `IEventBus` → consumers receive async.
6. **This is WHY 200-OK is independent of downstream**: handler returns after step 4 (fast DB write).

### Idempotency flow (FR3 — code-reviewed + fixed)
1. Check `IdempotencyService.getExisting(key)` — if HIT, return cached result (dedup).
2. Store result BEFORE save (optimistic: closes the race window).
3. Save to DB (if fails → `IdempotencyService.remove(key)` rollback → retry can re-process).
4. Return result.

### Code review findings (all resolved)
| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | Idempotency store after save → race condition | 🔴 race | Reordered: store before save + rollback on failure |
| 2 | close()/archive() no version increment → OCC gap | 🟡 design | Added `markAsModified()` |
| 3 | assignCustomer() no version increment → OCC gap | 🟡 design | Added `markAsModified()` |
| 4 | N+1 inbox query (findActiveConversations) | 🔵 efficiency | Acceptable for MVP (small pages); batch fetch later |
| 5 | Delete-all/re-insert messages on update | 🔵 efficiency | Same pattern as OrderRepository; INSERT-only-new later |

### Source tree (all files created)
```
src/modules/messaging/                          26 files
  domain/                                        7 files ✅
  application/                                   6 files ✅ (2 specs)
  infrastructure/
    http/                                        2 files ✅
    persistence/
      drizzle/schema/                            2 files ✅
      write/                                     2 files ✅
  constants/                                     1 file  ✅
  messaging.module.ts                            1 file  ✅
  index.ts                                       1 file  ✅
src/app.module.ts                                EDITED  ✅ (added MessagingModule)
src/libs/shared/database/drizzle/schema/index.ts EDITED  ✅ (added messaging tables)
```

### FR/NFR coverage
- ✅ FR1 (multi-channel receive) — webhook controllers per channel
- ✅ FR2 (immediate ack) — `@HttpCode(200)` + outbox-decoupled handler
- ✅ FR3 (dedup) — `IdempotencyService` keyed `channel:externalMessageId` + store-before-save
- ✅ FR4 (normalization) — `Message` entity = channel-agnostic OmniMessage
- ✅ FR7 (no loss) — transactional outbox (same tx as aggregate save)
- ✅ FR8 (chronological order) — append-only + `createdAt` ordering
- ✅ NFR4 (200ms ack) — fast save + async outbox publishing (benchmark pending)
- ✅ NFR9 (zero loss) — outbox retry + DLQ (existing `OutboxModule`)

## References

- **PRD:** FR1, FR2, FR3, FR4, FR7, FR8; NFR4, NFR9 — [prd.md](../../_bmad-output/planning-artifacts/prd.md)
- **Architecture:** §3.1 messaging module; §5 outbox (ADR-6); §6 data — [architecture.md](../../_bmad-output/planning-artifacts/architecture.md)
- **Epics:** Epic 1 — [epics.md](../../_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record

### Agent Model Used
Claude (BMAD SM Bob, *yolo mode) + code-review skill

### Debug Log References
- `nest build` — clean (no errors) ✅
- `jest src/modules/messaging` — 16/16 pass ✅
- Jest config fixes: `@core` mapper path (`libs/core` → `src/libs/core`), `@shared` mapper added, `src/` mapper added, stale `<rootDir>/libs` root removed.

### Completion Notes
- Domain bug found + fixed via tests: `MessageReceivedEvent.aggregateId` was `messageId` (wrong — should be `conversationId`, the emitting aggregate).
- 3 code-review fixes applied: idempotency race (#1) + OCC version gaps (#2, #3).
- Product/Order demo modules were missing on disk (deleted by user); removed their references from `app.module.ts` + schema index.
- ConversationReadDao intentionally deferred to story 1.4 (BFF inbox).

### File List (26 files — all created this session)
- `src/modules/messaging/domain/value-objects/channel.value-object.ts`
- `src/modules/messaging/domain/entities/message.entity.ts`
- `src/modules/messaging/domain/entities/conversation.entity.ts`
- `src/modules/messaging/domain/entities/conversation.entity.spec.ts`
- `src/modules/messaging/domain/events/message-received.event.ts`
- `src/modules/messaging/domain/events/conversation-started.event.ts`
- `src/modules/messaging/domain/repositories/conversation.repository.interface.ts`
- `src/modules/messaging/domain/index.ts`
- `src/modules/messaging/application/commands/receive-inbound-message.command.ts`
- `src/modules/messaging/application/commands/handlers/receive-inbound-message.handler.ts`
- `src/modules/messaging/application/commands/handlers/receive-inbound-message.handler.spec.ts`
- `src/modules/messaging/application/commands/handlers/index.ts`
- `src/modules/messaging/application/commands/index.ts`
- `src/modules/messaging/application/dtos/inbound-message.dto.ts`
- `src/modules/messaging/application/dtos/index.ts`
- `src/modules/messaging/application/index.ts`
- `src/modules/messaging/infrastructure/http/inbound-webhook.controller.ts`
- `src/modules/messaging/infrastructure/http/index.ts`
- `src/modules/messaging/infrastructure/index.ts`
- `src/modules/messaging/infrastructure/persistence/drizzle/schema/messaging.schema.ts`
- `src/modules/messaging/infrastructure/persistence/drizzle/schema/index.ts`
- `src/modules/messaging/infrastructure/persistence/write/conversation.repository.ts`
- `src/modules/messaging/infrastructure/persistence/write/index.ts`
- `src/modules/messaging/constants/tokens.ts`
- `src/modules/messaging/messaging.module.ts`
- `src/modules/messaging/index.ts`
- EDITED: `src/app.module.ts` (added MessagingModule)
- EDITED: `src/libs/shared/database/drizzle/schema/index.ts` (added messaging tables)
- EDITED: `package.json` (jest config fixes: @core/@shared/src mappers + roots)
