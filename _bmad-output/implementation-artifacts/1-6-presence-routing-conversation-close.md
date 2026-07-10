# Story 1.6: Presence / Routing + Conversation Close

Status: ready-for-dev

## Story

As an agent,
I want to set my availability and close/archive conversations,
so that routing works and my inbox stays manageable (FR16, FR18).

## Acceptance Criteria

1. **Presence:** agent can set availability (AVAILABLE / BUSY / OFFLINE) via `PUT /bff/agent/presence`; presence stored in Redis.
2. **Routing hint:** new inbound conversations route to an AVAILABLE agent (round-robin or least-loaded). For MVP: the routing logic assigns to the first available agent; the realtime gateway pushes to that agent's room.
3. **Close:** agent can close a conversation via `POST /bff/conversations/:id/close` → `conversation.close()` (FR18 — distinct from ticket resolution).
4. **Archive:** agent can archive via `POST /bff/conversations/:id/archive` → `conversation.archive()`.
5. **Inbox excludes closed/archived:** `GET /bff/inbox` returns only ACTIVE conversations (already handled by the read DAO's status filter).

## Tasks / Subtasks

- [ ] **Presence store + endpoint** (AC: 1)
  - [ ] Create `src/modules/messaging/infrastructure/presence/presence.service.ts` — Redis-backed `setPresence(agentId, status)` + `getAvailableAgents()` + `getPresence(agentId)`
  - [ ] `PUT /bff/agent/presence` → `presenceService.setPresence(userId, body.status)`
  - [ ] `GET /bff/agent/presence` → current status
- [ ] **Routing logic** (AC: 2)
  - [ ] In `ReceiveInboundMessageHandler` (or a new `AssignConversationHandler`): after creating a conversation, assign to an available agent via `presenceService.getAvailableAgents()` → pick (round-robin)
  - [ ] Store `assignedAgentId` on the conversation (new field or Redis mapping `conversation:agent`)
  - [ ] The realtime gateway uses `assignedAgentId` to target the push room (story 1.3 room targeting)
- [ ] **Close/archive endpoints** (AC: 3, 4)
  - [ ] `POST /bff/conversations/:id/close` → load conversation → `conversation.close()` → save
  - [ ] `POST /bff/conversations/:id/archive` → load → `conversation.archive()` → save
  - [ ] These use a simple command (`CloseConversationCommand`) + handler pattern
- [ ] **Tests** (AC: 1, 2, 3)
  - [ ] Unit: presence set/get; conversation close lifecycle
  - [ ] Integration: close → inbox excludes; presence → routing assigns

## Dev Notes

- Presence uses the **existing Redis** (`ICacheService` from `@shared/caching`). Key pattern: `presence:{agentId}` → status enum; `presence:available` → SET of available agent IDs.
- The Conversation domain entity already has `close()` + `archive()` methods (story 1-1) + `ConversationStatus` enum. This story adds the BFF endpoints + presence infrastructure.
- Routing is intentionally simple for MVP (first-available round-robin). Sophisticated routing (skill-based, geo-based) is G2 (FR37).

## References
- **PRD:** FR16 (availability + routing), FR18 (close/archive) — [prd.md §2](../../_bmad-output/planning-artifacts/prd.md)
- **Existing:** `Conversation.close()/archive()` (story 1-1 domain); `ICacheService` (Redis, from `@shared`).
