# Story 1.5: Reply + Outbound Send

Status: ready-for-dev

## Story

As an agent,
I want to reply to a customer on the original channel,
so that the conversation continues in place (FR5, FR11).

## Acceptance Criteria

1. **Reply:** `POST /bff/conversations/:id/reply` → creates an outbound `Message` (direction=OUTBOUND, senderType=AGENT) + appends to the conversation + saves.
2. **Channel send:** the outbound message is sent to the customer on the conversation's origin channel (via a channel adapter).
3. **Realtime echo:** the reply appears in the agent's own thread immediately (pushed via the realtime gateway).
4. **Retry on failure:** if the channel send fails, the message is retained in the outbox + retried — no silent loss (FR7).

## Tasks / Subtasks

- [ ] **Reply command** (AC: 1)
  - [ ] Create `SendReplyCommand(conversationId, agentId, content)` + handler → load conversation → `Message.create({ direction: OUTBOUND, senderType: AGENT })` → `conversation.receiveMessage(msg)` → save
  - [ ] `POST /bff/conversations/:id/reply` in BFF controller → `commandBus.execute(SendReplyCommand)`
- [ ] **Outbound channel adapter** (AC: 2)
  - [ ] Create `src/modules/messaging/infrastructure/channels/outbound/` — per-channel senders (Zalo API call, App push, email SMTP, FB Graph API)
  - [ ] Wave-1: Zalo outbound (API call to Zalo OA send-message endpoint); others mock
  - [ ] On send failure → outbox retry (the `MessageSent` event carries the outbound intent; a consumer triggers the send)
- [ ] **Realtime echo** (AC: 3)
  - [ ] The `MessageReceivedEvent` fires for outbound messages too (or a `MessageSentEvent`) → gateway pushes to the agent's room
- [ ] **Tests** (AC: 1, 2)
  - [ ] Unit: reply creates OUTBOUND message + appends to conversation
  - [ ] Integration: `POST /bff/conversations/:id/reply` → message persisted + outbound attempt

## Dev Notes

- The reply is an OUTBOUND `Message` (same domain entity, different `direction` + `senderType`). The Conversation aggregate handles it via `receiveMessage()` (or a dedicated `agentReply()` method if domain rules differ).
- For MVP: Zalo outbound is the only real channel (API call to Zalo); others return success (mock). The outbound adapter is a port (`IOutboundChannelAdapter`) with per-channel implementations.
- The `MessageReceivedEvent` is emitted for both inbound + outbound (the Conversation aggregate emits it on any message). The realtime gateway pushes both.

## References
- **PRD:** FR5 (outbound send), FR11 (reply) — [prd.md §1/§2](../../_bmad-output/planning-artifacts/prd.md)
- **Existing:** `Message.create()` (story 1-1 domain), `Conversation.receiveMessage()`, `IEventBus` for push.
