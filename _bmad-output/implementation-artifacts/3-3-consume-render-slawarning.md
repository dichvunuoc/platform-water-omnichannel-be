# Story 3-3: Consume + Render SlaWarning

Status: ready-for-dev

## Story

As a supervisor,
I want SlaWarning events rendered as red-flash + blinking countdown on my Kanban,
so that I can intervene before SLA breaches and protect the 94.2% compliance target (FR25).

> **SCOPE CLARITY:** The breach *detection* (FR24 — background worker scanning open tickets) is the **Ticketing service's** job. OmniCare **consumes** the `SlaWarning` event from the broker + **pushes** it to the agent screen via socket.io. The FE renders the red-flash.

## Acceptance Criteria

1. **Event subscription:** the realtime gateway subscribes to `SlaWarning` events on the broker.
2. **WS push ≤2s (NFR10b):** when a `SlaWarning` arrives, the gateway pushes `sla.warning` to the responsible agent's room + all supervisor rooms within 2s p95.
3. **Payload shape:** the pushed event contains `{ ticketId, conversationId?, slaDeadline, remainingMs, severity: 'WARNING'|'BREACHED', stage, assignee }`.
4. **Kanban real-time update:** connected agents/supervisors see the ticket's SLA badge change from green→yellow (warning) or yellow→red (breached) WITHOUT refreshing.
5. **Inbox SLA chip update:** if the warned ticket is linked to an open conversation, the inbox SLA chip updates in real time.
6. **Demo trigger:** the stub has a `POST /internal/tickets/:id/trigger-sla-warning` endpoint for manual demo (J3: trigger warning on ticket #402).

## Tasks / Subtasks

- [ ] **Gateway subscription** (AC: 1, 2)
  - [ ] In `MessagingGateway.onModuleInit()`: add `eventBus.subscribe('SlaWarning', handler)`
  - [ ] Handler: extract ticketId + remainingMs + severity → push to agent rooms
  - [ ] Push to `agent:{assigneeId}` room + all `role:supervisor` rooms
  - [ ] Measure: push within 2s of event receipt (log latency)
- [ ] **WS payload** (AC: 3)
  - [ ] Emit `sla.warning` event with full payload
  - [ ] Also emit `sla.tick` for periodic countdown updates (every 30s for active warnings)
- [ ] **Severity handling** (AC: 4)
  - [ ] `WARNING` (severity) → FE shows yellow blinking countdown
  - [ ] `BREACHED` → FE shows red solid + escalation indicator
  - [ ] `RESOLVED` (when SLA countdown stops after ticket resolved) → clear badge
- [ ] **Inbox chip sync** (AC: 5)
  - [ ] When `sla.warning` fires for a ticket linked to a conversation, also emit `sla.chip` event on the conversation's channel
  - [ ] The inbox real-time handler picks it up + updates the SLA chip inline
- [ ] **Demo endpoint** (AC: 6)
  - [ ] `POST /internal/tickets/:id/trigger-sla-warning` on the stub
  - [ ] Body: `{ severity: 'WARNING' | 'BREACHED' }`
  - [ ] Emits `SlaWarning` to the broker immediately (for J3 demo)
- [ ] **Tests**
  - [ ] Unit: gateway handler pushes to correct rooms on SlaWarning
  - [ ] Unit: payload shape matches AC:3
  - [ ] Integration: stub emits SlaWarning → gateway receives + pushes (mock broker)

## Dev Notes

### Flow (J3 demo)
```
Supervisor Tuấn opens Kanban (connected via socket.io)
    ↓
Ticketing stub: ticket #402 SLA deadline approaching (<30 min)
    ↓
Stub emits SlaWarning { ticketId: '#402', severity: 'WARNING', remainingMs: 900000 }
    ↓
Broker (IEventBus) → MessagingGateway subscriber
    ↓
Gateway pushes sla.warning to:
  - agent:{assignee of #402} room
  - supervisor rooms (Tuấn + all supervisors)
    ↓ [≤2s from broker receipt]
FE: Kanban ticket #402 badge → yellow blinking
FE: Inbox conversation linked to #402 → SLA chip → yellow
```

### What this story does NOT build
- ❌ SLA breach detection (FR24 — Ticketing service background worker)
- ❌ Escalation logic (FR26 — Ticketing service, G2)
- ✅ Event consumption + real-time rendering pipeline (FR25 — our scope)

### Periodic SLA tick
For active warnings (remaining <30 min), the gateway emits `sla.tick` every 30s with the updated `remainingMs`. This lets the FE countdown tick without polling. The tick is a lightweight push (no DB read — just arithmetic on the last-known deadline).

## References
- **PRD:** FR25 `[MVP·OMNI]` (consume SlaWarning + surface to supervisors/agents), NFR10b `[OMNI]` (render ≤2s p95) — [prd.md §3a](../../_bmad-output/planning-artifacts/prd.md)
- **Architecture:** §7 Realtime Architecture (broker spine → BFF gateway → SPA) — [architecture.md](../../_bmad-output/planning-artifacts/architecture.md)
- **Dependencies:** Ticketing stub (emits SlaWarning), MessagingGateway from story 1-3
