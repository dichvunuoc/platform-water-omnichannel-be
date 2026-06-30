# Story 1.2: OmniMessage Normalization + Conversation / Thread Store

Status: done

<!-- Largely built as part of story 1-1 (domain layer + schema + repository).
     This file documents the complete scope of normalization + thread-store
     for traceability. Remaining: per-channel normalizer completeness. -->

## Story

As a backend system,
I want every channel's message normalized into one common format and stored in a unified conversation thread,
so that the inbox is channel-agnostic regardless of source (FR4, FR8, FR9, FR10).

## Acceptance Criteria

1. **Normalization (FR4):** inbound from any channel (Zalo/App/FB/Email/VoIP) is normalized into the `OmniMessage` format — the `Message` entity (channel-agnostic: `channel`, `direction`, `senderType`, `content`, `externalId`, `attachments`).
2. **Unified thread (FR1/FR8):** messages attach to a `Conversation` (one per customer-channel context); threads render in correct chronological order (`messagesTable.createdAt` ASC).
3. **Attachments (FR10):** photo URLs, recording refs, and other attachments are preserved on the `Message` entity (`attachments: string[]`).
4. **Per-channel normalizers:** each channel's raw webhook payload is translated to the channel-agnostic `InboundMessageDto` before entering the command pipeline (FR4 normalization step).

## Tasks / Subtasks

### ✅ DONE (built as part of story 1-1)

- [x] **Message entity = OmniMessage** (AC: 1) — `src/modules/messaging/domain/entities/message.entity.ts`; `Channel` VO, `MessageDirection`, `SenderType` enums; `externalId` for dedup; `attachments` preserved.
- [x] **Conversation aggregate = unified thread** (AC: 2) — `src/modules/messaging/domain/entities/conversation.entity.ts`; `receiveMessage()` appends messages chronologically; `ConversationStatus` (ACTIVE/CLOSED/ARCHIVED).
- [x] **Drizzle schema** (AC: 2, 3) — `conversationsTable` + `messagesTable` with `jsonb attachments`; relations; types (`src/modules/messaging/infrastructure/persistence/drizzle/schema/messaging.schema.ts`).
- [x] **ConversationRepository** (AC: 2) — Drizzle write impl; `save()` (upsert conversation + messages with OCC + outbox); `getById()` (reconstitute with messages chronologically); `findActiveByCustomerChannel()` (`src/modules/messaging/infrastructure/persistence/write/conversation.repository.ts`).
- [x] **Zalo normalizer** (AC: 4, partial) — `zaloToDto()` in `InboundWebhookController` translates Zalo raw payload → `InboundMessageDto`.

### ✅ DONE (normalizers completed)

- [x] **App normalizer** (AC: 4) — `POST /webhooks/app` + `appToDto()` (userId, messageId, text, attachments)
- [x] **Facebook Messenger normalizer** (AC: 4) — `POST /webhooks/facebook` + `facebookToDto()` (unwraps nested `entry[].messaging[].sender/message` → flat DTO)
- [x] **Email normalizer** (AC: 4) — `POST /webhooks/email` + `emailToDto()` (from, messageId, textBody/subject, attachments)
- [x] Build: ✅ `tsc --noEmit` clean. Tests: ✅ 16/16 pass (existing tests unaffected).

### 📌 DEFERRED

- ConversationReadDao → story 1.4 (BFF inbox endpoints)

## Dev Notes

### What "normalization" means
Each channel sends a **different raw payload shape** (Zalo JSON, FB Messenger format, App push, email body). The normalizer's job is to extract the universal fields (customerChannelId, externalMessageId, content, attachments) and produce a channel-agnostic `InboundMessageDto`. The domain `Message.create()` then produces the `OmniMessage` (the internal canonical format).

### Pattern
```
Raw Zalo payload → zaloToDto() → InboundMessageDto → ReceiveInboundMessageCommand → Message.create() → OmniMessage
```
Every channel follows this: `Raw → normalizer → DTO → command → OmniMessage`. The command handler + domain are channel-agnostic; only the normalizer + controller route are channel-specific.

### What's already production-ready
The domain layer (Conversation + Message), schema, repository, and Zalo normalizer are built and **compile clean** (verified via `nest build`). The thread store (conversations + messages) persists and reconstitutes correctly. The only gap is adding normalizers for the other 3 channels (App/FB/Email) — each is a small function (raw → DTO).

## References
- **PRD:** FR1 (multi-channel receive), FR4 (normalization), FR8 (chronological order), FR10 (history + attachments) — [prd.md §1/§2](../../_bmad-output/planning-artifacts/prd.md)
- **Story 1-1** (this story's domain + infra was built there) — [1-1-multi-channel-webhook-ingress-idempotency.md](./1-1-multi-channel-webhook-ingress-idempotency.md)
- **Story 1.4** (ConversationReadDao — the read-side completion of the thread store) — [1-4-unified-inbox-bff-endpoints-bootstrap.md](./1-4-unified-inbox-bff-endpoints-bootstrap.md)

## Dev Agent Record
### Agent Model Used
Claude (BMAD Bob SM, *yolo mode)
### File List
**Done (via 1-1):** message.entity.ts, conversation.entity.ts, channel.value-object.ts, messaging.schema.ts, conversation.repository.ts
**Remaining:** AppNormalizer, FacebookNormalizer, EmailNormalizer (+ per-channel routes)
