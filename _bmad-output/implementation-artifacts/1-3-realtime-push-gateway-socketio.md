# Story 1.3: Realtime Push Gateway (socket.io)

Status: ready-for-dev

## Story

As an agent,
I want new inbound messages pushed to my screen in real time without refreshing,
so that I can respond instantly to customers (FR12, NFR1).

## Acceptance Criteria

1. **Gateway live:** a socket.io WebSocket gateway is active in the Omnichannel service; agents connect via `io('/agent')` with their auth token.
2. **Push on event:** when `MessageReceivedEvent` fires (from outbox→bus), the gateway pushes `interaction.received` + `message.sent` to the assigned agent's room within **2s p95** (NFR1).
3. **Room targeting:** messages route to the correct agent room (by agentId / assignment), not broadcast.
4. **Reconnect + backfill:** on socket reconnect, the client requests missed events by `lastSeenId`; the gateway replays from the event log — no message loss (ADR-9).
5. **Auth on connect:** the socket connection validates the agent's JWT (same IAM token) on the `connection` handshake.

## Tasks / Subtasks

- [ ] **Install deps** (AC: 1)
  - [ ] `bun add @nestjs/websockets @nestjs/platform-socket.io socket.io`
- [ ] **Gateway** (AC: 1, 2, 3)
  - [ ] Create `src/modules/messaging/infrastructure/realtime/messaging.gateway.ts` — `@WebSocketGateway({ namespace: '/agent' })`
  - [ ] `@SubscribeMessage('connect')` → validate JWT → join room `agent:{userId}`
  - [ ] Subscribe to `IEventBus` for `MessageReceived` → `server.to(room).emit('interaction.received', payload)`
  - [ ] Subscribe to other events (`SlaWarning`, `IncidentClassified`) → relay to appropriate rooms
- [ ] **Event-log backfill** (AC: 4)
  - [ ] `@SubscribeMessage('backfill')` → query events since `lastSeenId` → emit to the requesting client
  - [ ] Event log source: the outbox table (filter by `aggregateType='Conversation'`, `createdAt > lastSeen`)
- [ ] **Auth handshake** (AC: 5)
  - [ ] In the gateway `handleConnection`: extract JWT from `socket.handshake.auth.token` → validate (reuse existing auth guard/service) → `socket.join('agent:' + userId)`; reject on invalid
- [ ] **Tests** (AC: 2, 3, 4)
  - [ ] Unit: event → push to correct room
  - [ ] Integration: connect → emit MessageReceived → client receives; reconnect → backfill

## Dev Notes

- The gateway lives in the **Omnichannel service** (ADR-8). It subscribes to `IEventBus` events (published by the outbox processor).
- For wave-1 (in-process bus), the gateway subscribes directly. For wave-2 (RabbitMQ), the subscription changes behind the same `IEventBus` port.
- Agent assignment (which agent gets the message) is handled by Epic 1's presence/routing (story 1.6). For MVP, push to ALL connected agents or a default room; refine when 1.6 lands.
- Backfill uses the outbox table as the event log (it stores all domain events with timestamps).

## References
- **PRD:** FR12 (real-time push), NFR1 (≤2s p95), ADR-9 (reconnect+backfill) — [prd.md](../../_bmad-output/planning-artifacts/prd.md), [architecture.md §7](../../_bmad-output/planning-artifacts/architecture.md)
- **Existing:** `IEventBus` (`@core/infrastructure`), `MessageReceivedEvent` (story 1-1 domain)
