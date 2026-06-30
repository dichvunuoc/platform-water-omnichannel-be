# Story: Wave-1 Ticketing Stub (Contract-Conformant)

Status: ready-for-dev

## Story

As a wave-1 demo enabler,
I want a contract-conformant stub that simulates the Ticketing & SLA service,
so that Epics 3, 6, and 8 can demo end-to-end BEFORE the real Ticketing service exists (wave-2).

## Acceptance Criteria

1. **Accepts commands (from broker/HTTP):** `TicketCreateRequested` → returns ticket ID + initial SLA info; `TicketStateChanged` → updates ticket status; `TicketReassignRequested` → updates assignee.
2. **Emits events (to broker):** `SlaWarning` (when SLA is near breach — simulated), `SlaBreached`, `TicketClosed`, `TicketStateChanged`.
3. **In-memory store:** tickets stored in a Map (no DB). Survives within process lifetime only.
4. **SLA simulation:** each ticket gets a mock SLA deadline (e.g. `createdAt + 4 hours` for P0); the stub computes the countdown + emits `SlaWarning` when <30 min remaining (or immediately for demo).
5. **HTTP endpoint for BFF reads:** `GET /bff/tickets/:id` → returns `{ id, status, priority, slaDeadline, assignee, stage }`; `GET /bff/tickets/kanban` → returns tickets grouped by stage.
6. **Contract-identical cutover:** wave-2 replaces the stub with the real service behind the SAME contract — zero omnichannel-side rewrite.

## Tasks / Subtasks

- [ ] **Stub module** (`src/modules/ticketing-stub/`)
  - [ ] `ticketing-stub.module.ts` — NestJS module
  - [ ] `ticketing-stub.service.ts` — in-memory ticket store; create/state-change/reassign; SLA simulation
  - [ ] `ticketing-stub.controller.ts` — `GET /bff/tickets/:id`, `GET /bff/tickets/kanban`, `POST /internal/tickets/create` (simulates broker command receipt)
  - [ ] `ticketing-stub.event-emitter.ts` — emits SlaWarning/TicketClosed/TicketStateChanged to IEventBus
- [ ] **SLA simulation**
  - [ ] On create: set `slaDeadline = now + slaPolicy[type][priority]` (mock: P0=4h, P1=8h, P2=24h, P3=72h)
  - [ ] Background timer: check every 60s; if <30 min to deadline → emit `SlaWarning`
  - [ ] If past deadline → emit `SlaBreached`
  - [ ] Demo mode: option to fast-forward SLA (set deadline to `now + 5 min` for J3 demo)
- [ ] **Wire into MessagingModule**
  - [ ] Import TicketingStubModule in app.module.ts
  - [ ] Subscribe to `TicketCreateRequested` on the broker → create ticket → emit `TicketStateChanged`
- [ ] **Tests**
  - [ ] Unit: create ticket → returns ID + SLA info
  - [ ] Unit: advance stage → state updated
  - [ ] Unit: SLA warning emitted when <30 min

## Dev Notes

### Why a stub, not the real service?
The real Ticketing & SLA service is wave-2 (separate PRD, separate microservice, own PostgreSQL). The stub lets us demo J1/J2/J3 end-to-end NOW — without waiting for that service. The contract (events + HTTP reads) is defined here and honored identically in wave-2.

### Contract (Architecture §5)
- **OmniCare → Stub (commands):** `TicketCreateRequested`, `TicketStateChanged`, `TicketReassignRequested`
- **Stub → OmniCare (events):** `SlaWarning`, `SlaBreached`, `TicketClosed`, `TicketStateChanged`
- **BFF reads (HTTP):** ticket state + SLA countdown

### Demo SLA fast-forward
For J3 (SLA firefighting demo), set the SLA deadline to `now + 5 min` so the supervisor sees a red-flash + countdown during the demo. A `POST /internal/tickets/:id/fast-forward-sla` endpoint controls this.

## References
- **Architecture:** §5 Omnichannel ↔ Ticketing contract; §10 wave sequencing — [architecture.md](../../_bmad-output/planning-artifacts/architecture.md)
- **Epics:** Dependencies section (Epics 3, 6, 8 depend on stub) — [epics.md](../../_bmad-output/planning-artifacts/epics.md)
- **Sprint-status:** `ticketing-stub: backlog` — prerequisite for Epics 3/6/8
