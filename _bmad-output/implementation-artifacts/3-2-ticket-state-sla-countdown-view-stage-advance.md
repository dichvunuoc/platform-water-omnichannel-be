# Story 3-2: Ticket State View + SLA Countdown + Stage Advance

Status: ready-for-dev

## Story

As an agent/supervisor,
I want to see ticket state + SLA countdown on the Kanban + advance tickets through stages,
so that I can track progress and know when SLA is at risk (FR20/FR60).

> **SCOPE CLARITY:** The ticket store + SLA engine live in the **Ticketing service** (stub/real). OmniCare's BFF **reads** ticket data via HTTP + **publishes** stage changes via broker. The Kanban *UI* is delivered (FE). We build the data pipeline.

## Acceptance Criteria

1. **Kanban data:** `GET /bff/tickets/kanban` returns tickets grouped by stage (`RECEIVED` → `IN_PROGRESS` → `WAITING` → `RESOLVED`), each with `{ id, title, priority, channel, slaDeadline, slaRemainingMs, assignee, customerName }`.
2. **SLA countdown:** each ticket includes `slaRemainingMs` (milliseconds until SLA breach) computed from the stub's `slaDeadline`.
3. **Stage advance:** `POST /bff/tickets/:id/advance` publishes `TicketStateChanged { ticketId, newStage }` to the broker → stub updates the ticket.
4. **SLA chip on inbox:** `GET /bff/conversations/:id` includes `ticketSla: { remainingMs, isWarning, isBreached }` when the conversation has a linked ticket.
5. **Mock data matches UI:** Kanban columns match the delivered FE mockup (6 + 11 + 2 + 7 tickets; SLA colors: green >30min, yellow <30min, red breached).

## Tasks / Subtasks

- [ ] **BFF Kanban endpoint** (AC: 1, 2)
  - [ ] `GET /bff/tickets/kanban` in BffController
  - [ ] Delegates to Ticketing stub HTTP: `GET /bff/tickets` → groups by stage
  - [ ] Computes `slaRemainingMs = slaDeadline - Date.now()` per ticket
  - [ ] Joins customer name from Customer 360 (mock) for display
- [ ] **Stage advance** (AC: 3)
  - [ ] `POST /bff/tickets/:id/advance` in BffController
  - [ ] Body: `{ newStage: 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' }`
  - [ ] Publishes `TicketStateChanged { ticketId, newStage }` via IEventBus
  - [ ] Returns `{ ok: true, ticketId, stage: newStage }`
- [ ] **SLA chip on conversation** (AC: 4)
  - [ ] Enhance `ConversationReadDao.findById()` response: if `ticketId` is set, include `ticketSla` object
  - [ ] `ticketSla` fetched from stub: `GET /bff/tickets/:ticketId` → compute `remainingMs` + `isWarning (<30min)` + `isBreached (<0)`
- [ ] **Mock Kanban seed data** (AC: 5)
  - [ ] Ticketing stub pre-seeds 26 tickets matching the UI mockup numbers
  - [ ] Mix of P0/P1/P2/P3 with varying SLA statuses (green/yellow/red)
- [ ] **Tests**
  - [ ] Unit: Kanban groups by stage + computes SLA remaining
  - [ ] Unit: stage advance publishes correct event
  - [ ] Unit: SLA chip on conversation (with/without ticket)

## Dev Notes

### Data flow (BFF reads, broker writes)
```
GET /bff/tickets/kanban (FE calls)
    ↓
BFF → Ticketing stub HTTP: GET /internal/tickets
    ↓
Stub returns: [{ id, stage, priority, slaDeadline, assignee, ... }]
    ↓
BFF computes: slaRemainingMs = slaDeadline - now
BFF joins: customerName from Customer 360 mock
    ↓
Returns grouped: { RECEIVED: [...], IN_PROGRESS: [...], WAITING: [...], RESOLVED: [...] }
```

### SLA color logic (matches FE)
```typescript
const remaining = slaDeadline - Date.now();
const color = remaining < 0 ? 'red'      // breached
            : remaining < 30 * 60 * 1000 ? 'yellow' // <30 min warning
            : 'green';                                // ok
```

### What this story does NOT build
- ❌ Ticket state machine (FR21 — Ticketing service)
- ❌ SLA policy application (FR23 — Ticketing service)
- ❌ SLA breach detection (FR24 — Ticketing service)
- ✅ We READ ticket data + PUBLISH stage changes (FR20/FR60 — our scope)

## References
- **PRD:** FR20 `[MVP·OMNI]` (advance ticket stages via BFF proxy), FR60 `[MVP·OMNI]` (view ticket state + SLA countdown) — [prd.md §3a](../../_bmad-output/planning-artifacts/prd.md)
- **Architecture:** §4 BFF `GET /bff/tickets/kanban` + `GET /bff/conversations/:id` (SLA chip) — [architecture.md](../../_bmad-output/planning-artifacts/architecture.md)
- **Dependencies:** Ticketing stub (Kanban data source)
