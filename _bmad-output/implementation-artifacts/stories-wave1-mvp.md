---
title: "OmniCare — Wave-1 MVP Stories (Epics 3, 4-mvp, 5-mvp, 6-mvp, 7, 8)"
document_type: "Dev-ready stories"
version: "1.0"
date: "2026-06-24"
source:
  epics: "epics.md (v0.3.2)"
  prd: "prd.md (v1.2)"
  architecture: "architecture.md (v0.3)"
scope: "Wave-1 MVP backend. Runs against the Ticketing STUB + mock ports, into the delivered FE. Security/auth OUT OF SCOPE (descoped)."
legend: "[MVP] phase · FRxx/NFRxx = traceability to PRD · 'Arch' = endpoint/event/module from architecture.md §4–§7"
note: "Story-file IDs match sprint-status.yaml. Acceptance criteria are Given/When/Then. Auth/RBAC/audit/PII are NOT acceptance criteria here (descoped) — role-gated actions assume existing-platform handling."
---

# Wave-1 MVP Stories

> Prereqs already done: **Epic 1** (ingestion/realtime spine) + **Epic 2** (identity/360). These stories build on them.
> Wave-1 dependency: a **contract-conformant Ticketing stub** (accepts `TicketCreateRequested`/`TicketStateChanged`/`TicketReassignRequested`; emits `SlaWarning`/`SlaBreached`/`TicketClosed`/`TicketStateChanged`) — Architecture §5.

---

## Epic 3 — Ticket Interaction & SLA Surfacing
*Depends on: Epic 1 + Ticketing stub. Covers FR19, FR20, FR25, FR60.*

### Story 3-1 — Ticket create from conversation `[MVP]`
**FR19 · NFR9 · NFR21** · Size: M
**As an** agent, **I want** to create a ticket from a conversation in one action, **so that** the request is tracked by the Ticketing service with full context.

**Acceptance Criteria**
- **Given** an open conversation, **when** the agent triggers "create ticket", **then** the BFF publishes a `TicketCreateRequested` command to the broker carrying conversation id, customer id (from Epic 2), channel, and initial type/priority, and the conversation is linked to the returned ticket reference.
- **Given** the agent double-submits (or a retry occurs), **when** the same idempotency key is seen, **then** exactly one ticket is created (dedup at the command edge).
- **Given** the Ticketing stub is unavailable, **when** the command is published, **then** it is persisted to the outbox and retried (no loss, NFR9) and the conversation flow is **not** blocked.

**Tasks**
- BFF `write-fanout`: `POST /bff/conversations/:id/ticket` → build + publish `TicketCreateRequested` (idempotency-keyed) via `IEventBus`.
- Transactional outbox entry in the same DB tx; outbox processor publishes to broker (ADR-6).
- Persist `conversation.ticketRef` on `TicketStateChanged` (created) event from the stub.
- Contract test (consumer side) for `TicketCreateRequested` schema (NFR21).

**Arch:** BFF `ticketing-contract-client`; broker command `TicketCreateRequested`; module `conversation`.

### Story 3-2 — Ticket state, SLA countdown view & stage advance `[MVP]`
**FR20 · FR60 · NFR21** · Size: M
**As an** agent/supervisor, **I want** to see each ticket's current stage + live SLA countdown and advance the stage, **so that** I can manage work without leaving the workspace.

**Acceptance Criteria**
- **Given** open tickets, **when** the Kanban loads, **then** `GET /bff/tickets/kanban` returns tickets grouped by stage with current state + SLA countdown sourced from the Ticketing service (BFF sync read).
- **Given** a ticket in a conversation, **when** the conversation view loads, **then** the ticket chip shows state + SLA countdown (FR60).
- **Given** an agent advances a ticket stage (received → in-progress → waiting → resolved), **when** the action fires, **then** the BFF proxies a `TicketStateChanged` command to the Ticketing service and the board reflects the new stage on the returned event (FR20).

**Tasks**
- BFF read: `GET /bff/tickets/kanban` (aggregation from Ticketing read API) + ticket chip join in `GET /bff/conversations/:id`.
- BFF write: `POST /bff/tickets/:id/advance` → `TicketStateChanged` command.
- WS `ticket.moved` / `sla.tick` relay so the board stays live.

**Arch:** `GET /bff/tickets/kanban`; commands `TicketStateChanged`; WS `ticket.moved`, `sla.tick`.

### Story 3-3 — Consume & render SlaWarning `[MVP]`
**FR25 · NFR10b** · Size: M
**As a** supervisor/agent, **I want** SLA-at-risk and breach alerts to appear in real time, **so that** I can act before/at breach.

**Acceptance Criteria**
- **Given** the Ticketing service emits `SlaWarning` (or `SlaBreached`), **when** the omnichannel gateway receives it from the broker, **then** it emits `sla.warning` to the responsible agent's and the supervisor's socket rooms and the client renders red-flash + countdown within **2s p95** of broker receipt (NFR10b).
- **Given** an agent's socket dropped and reconnects, **when** it requests missed events by last-seen id, **then** unrendered SLA warnings are backfilled (idempotent, ADR-9).

**Tasks**
- Realtime gateway subscriber for `SlaWarning`/`SlaBreached`; route to rooms by `agentId`/`supervisorId`.
- WS channel `sla.warning`; include ticket id, severity, remaining-time.
- Reconnect backfill from event log; latency metric (p95) to Prometheus.

**Arch:** broker `SlaWarning`/`SlaBreached` → realtime-gateway → WS `sla.warning` (Arch §7).

---

## Epic 7 — Field-Incident Dispatch
*Depends on: Epic 1 (intake ingestion FR1/10 + AI-tag display FR15) + Field-team App port. Covers FR62.*

### Story 7-1 — Dispatch Work Order to Field-team App `[MVP]`
**FR62 · NFR9 · NFR21** · Size: M
**As a** coordinator (GDV), **I want** a confirmed field incident to be dispatched to the Field-team App, **so that** crews act on it (the J1 "đã chuyển đội hiện trường FSM" step).

**Acceptance Criteria**
- **Given** a confirmed field incident, **when** dispatch is triggered, **then** a Work Order command is published to the Field-team App port carrying incident type, priority, location (address; geo-pin is G2/FR52), and photo references (from FR10 attachments), and the incident timeline records `incident.dispatched`.
- **Given** the Field-team App port is unavailable, **when** dispatch is published, **then** it is retried via outbox/DLQ (no incident lost, NFR9).
- **Given** a duplicate dispatch, **when** the same idempotency key is seen, **then** exactly one Work Order is sent.

**Tasks**
- `incident` module: `dispatchWorkOrder` command + Field-team App port (mock adapter wave-1).
- Map intake fields → Work Order payload (type/priority/location/photoRefs).
- Outbox + idempotency; WS `incident.dispatched`; contract test for the port schema.

**Arch:** module `incident`; `GET /bff/incidents/:id`; WS `incident.dispatched`; Field-team App port.

---

## Epic 8 — Supervisor Operations Dashboard
*Depends on: Epic 1 + Ticketing stub. Covers FR53, FR54.*

### Story 8-1 — Operations dashboard KPIs `[MVP]`
**FR53 · NFR2** · Size: M
**As a** supervisor, **I want** a real-time operations dashboard, **so that** I see volume, SLA, and CSAT at a glance (the Điều hành CSKH screen).

**Acceptance Criteria**
- **Given** the dashboard loads, **when** `GET /bff/operations/kpis` is called, **then** the BFF returns a joined payload: today's request volume + channel mix + topic breakdown (omnichannel), SLA compliance % + open-ticket counts (Ticketing), and CSAT/NPS (omnichannel capture) — matching the mockup tiles.
- **Given** new activity, **when** counters change, **then** `kpi.tick` pushes updates so the dashboard stays live without refresh.
- **Given** normal load, **when** the KPI endpoint is called, **then** it responds ≤ 500ms p95 (NFR2).

**Tasks**
- BFF aggregation `GET /bff/operations/kpis` (omnichannel counters + Ticketing SLA/open-ticket reads + CSAT).
- WS `kpi.tick` emitter on counter deltas.
- Caching of slow joins in Redis where safe.

**Arch:** `GET /bff/operations/kpis` (BFF-joined); WS `kpi.tick`.

### Story 8-2 — Reassign ticket `[MVP]`
**FR54 · NFR21** · Size: S
**As a** supervisor, **I want** to reassign a ticket to another agent, **so that** I can rebalance load to protect SLA.

**Acceptance Criteria**
- **Given** a ticket, **when** the supervisor reassigns it, **then** the BFF proxies a `TicketReassignRequested` command to the Ticketing service and the board reflects the new owner on the returned `TicketStateChanged`.
- **Given** the Ticketing service is unavailable, **when** reassign is published, **then** it is retried (no loss) and the UI surfaces a pending state.

**Tasks**
- BFF write: `POST /bff/tickets/:id/reassign` → `TicketReassignRequested`.
- Reflect new owner on event; contract test.

**Arch:** `POST /bff/tickets/:id/reassign`; command `TicketReassignRequested`.
**Note:** supervisor-only gating relies on the existing platform (RBAC descoped); not an acceptance criterion here.

---

## Epic 4 — Voice Call Handling (MVP slice)
*Depends on: Epic 1 + Epic 2 (screen-pop context). Covers FR32, FR33, FR35, FR59.*

### Story 4-1 — VoIP screen-pop `[MVP]`
**FR32 · FR33 · NFR1** · Size: M
**As an** agent, **I want** the caller's profile to pop before I answer, **so that** I handle the call with full context (the Tổng đài 1900 screen).

**Acceptance Criteria**
- **Given** an inbound call event from VoIP/ACD, **when** it arrives, **then** the telephony module resolves the caller via `GET /bff/customers/by-phone/:n` (Epic 2) and emits `call.ring` with the caller profile + IVR branch to the assigned agent's socket **before** answer.
- **Given** the caller is unknown, **when** lookup fails, **then** the pop shows a graceful "unknown caller" fallback (no blocking).
- **Given** the call is answered/ended, **when** the state changes, **then** `call.answer`/`call.hangup` update the softphone.

**Tasks**
- `telephony` module: consume VoIP/ACD events; screen-pop signal emission.
- BFF `GET /bff/softphone/active`, `GET /bff/customers/by-phone/:n`.
- WS `call.ring`/`call.answer`/`call.hangup`.

**Arch:** module `telephony`; `GET /bff/softphone/active`; WS `call.*`.

### Story 4-2 — Recording reference & consent announcement `[MVP]`
**FR35 · FR59** · Size: S
**As a** compliance-conscious operator, **I want** callers to hear a recording notice and agents to access the recording reference, **so that** calls are traceable.

**Acceptance Criteria**
- **Given** an inbound call, **when** it connects, **then** a recording-consent announcement plays before the agent is bridged (FR59).
- **Given** a completed call, **when** the agent opens the interaction, **then** a recording reference (URL) is present in the interaction timeline (FR35).

**Tasks**
- Consent announcement hook in the call-connect flow.
- Persist `recordingRef` on the interaction record; surface in `GET /bff/conversations/:id`.

**Arch:** `telephony` module; interaction timeline (Epic 1).
**Note:** 90-day retention policy (NFR17) is **out of scope** (descoped) — retention is best-effort/configurable, not a validated target here.

---

## Epic 5 — Knowledge Base & Answers (MVP slice)
*Depends on: Epic 1 (workspace access). Covers FR14, FR39.*

### Story 5-1 — KB Vietnamese search `[MVP]`
**FR14 · FR39 · NFR20** · Size: M
**As an** agent, **I want** to search the FAQ knowledge base from the workspace with Vietnamese-aware matching, **so that** I answer consistently and fast.

**Acceptance Criteria**
- **Given** a query with/without diacritics, **when** the agent searches, **then** `GET /bff/kb/search?q=` returns ranked FAQ articles handling Vietnamese diacritics + synonyms (ElasticSearch).
- **Given** a result, **when** opened, **then** the article content is served in a structured/semantic form (NFR20) for the FE to render.
- **Given** the agent is in a conversation, **when** they open KB, **then** access is available inline (FR14).

**Tasks**
- `kb` module + ElasticSearch index (VN analyzer: diacritics/synonyms).
- BFF `GET /bff/kb/search?q=`; structured content payload.
- Seed mock FAQ matching the KB topics.

**Arch:** module `kb`; ElasticSearch; `GET /bff/kb/search`.
**Open item:** confirm ElasticSearch is omnichannel-owned vs shared cluster (Arch §12).

---

## Epic 6 — Customer Feedback & Measurement (MVP slice)
*Depends on: Epic 1 + Ticketing stub (TicketClosed). Covers FR42.*

### Story 6-1 — CSAT on ticket close `[MVP]`
**FR42 · NFR21** · Size: S
**As a** quality owner, **I want** a CSAT request sent when a ticket closes, **so that** we measure satisfaction and feed the Ticketing auto-reopen loop.

**Acceptance Criteria**
- **Given** the Ticketing service emits `TicketClosed`, **when** the omnichannel `csat` module consumes it, **then** a CSAT survey is delivered to the customer for that ticket.
- **Given** the customer submits a rating, **when** it is captured, **then** the service emits `CsatSubmitted` (consumed by Ticketing for auto-reopen, FR27).
- **Given** delivery is requested, **when** sent, **then** the MVP uses a single channel (multi-channel SMS/Zalo/in-app/email is G2/FR43).

**Tasks**
- `csat` module: consume `TicketClosed`; create + send survey; capture rating; emit `CsatSubmitted`.
- BFF `POST /bff/csat`; contract tests for `TicketClosed`/`CsatSubmitted`.

**Arch:** module `csat`; `POST /bff/csat`; events `TicketClosed` (in) / `CsatSubmitted` (out).

---

## Wave-1 coverage check
FR19, 20, 25, 60 (Epic 3) · 62 (Epic 7) · 53, 54 (Epic 8) · 32, 33, 35, 59 (Epic 4-mvp) · 14, 39 (Epic 5-mvp) · 42 (Epic 6-mvp) → **all wave-1 MVP FRs mapped.** G2 FRs (34,36,37,38,40,41,43–52) are in `stories-wave3-g2.md`.
