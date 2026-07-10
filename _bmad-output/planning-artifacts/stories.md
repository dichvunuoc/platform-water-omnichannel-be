---
title: "OmniCare — Wave-1 MVP Stories (Backend)"
project_name: "nestjs-project-example"
product_name: "OmniCare"
document_type: "Developer Stories (Wave-1 MVP)"
workflowType: "create-story (*yolo, compressed)"
version: "0.1 — Wave-1 MVP story set"
status: "ready-for-dev (draft)"
date: "2026-06-23"
author: "Pc"
sm: "Bob"

source:
  prd: "prd.md (v1.2) — 62 FRs"
  architecture: "architecture.md (v0.3)"
  epics: "epics.md (v0.3.1) — 9 epics + Foundation"

scope: "Wave-1 MVP backend stories (Foundation + Epics 1,2,3,7,8 + MVP slices of 4,5,6). G2 stories (Epic 9 + G2 FRs) deferred to wave 3. Each story is dev-ready: Story (As-a/I-want/So-that) + Acceptance Criteria + Tasks/Subtasks + Dev Notes (arch refs). Built against the Ticketing stub + mock sibling ports, into the delivered FE."

stack_ref: "NestJS 11 (Fastify) + Bun + Drizzle (PostgreSQL) + Redis + RabbitMQ (@core IEventBus) + socket.io. DDD modules under src/modules/* mirroring the existing product-module pattern (@core ports: IEventBus, IOutboxRepository, ICacheService)."
---

# OmniCare — Wave-1 MVP Stories (Backend)

> Build order: **Foundation → Epic 1 (spine) → Epics 2/3/7/8 + MVP slices of 4/5/6**. Demo goal: J1 (Zalo incident), J2 (VoIP call), J3 (SLA firefighting) end-to-end into the delivered FE, against the Ticketing stub + mock ports.

---

## Foundation — Cross-cutting (built first; every epic runs on it)

### Story F.1: IAM token validation + RBAC enforcement
Status: ready-for-dev
**Story:** As a backend service, I want to validate IAM-issued agent tokens and enforce role-based authorization at the BFF edge, so that only authenticated agents with the right role reach each operation (authn delegated to the existing IAM).
**Acceptance Criteria:**
1. Every BFF endpoint requires a valid IAM-issued JWT; invalid/expired tokens → 401.
2. Role claims (agent/supervisor/admin) from the IAM token are enforced server-side (e.g., reassign = supervisor/admin only).
3. Unauthenticated requests never reach a domain service.
**Tasks:**
- [ ] Auth guard middleware at BFF (AC:1,2)
- [ ] IAM JWKS/public-key integration for token validation (AC:1)
- [ ] Role-based route guards (`@Roles()` decorator + guard) (AC:2)
- [ ] Unit tests for valid/invalid/expired/wrong-role tokens (AC:1,2,3)
**Dev Notes:** AuthN = IAM (consumed); we only validate + enforce. Resolve Open Item: does IAM provide roles in claims, or do we map identity→role locally? [Source: architecture.md §8 ADR-10, epics.md Open Items]. Reuse existing `@core`/`@shared` patterns.

### Story F.2: Immutable audit trail
Status: ready-for-dev
**Story:** As a compliance officer, I want an immutable audit trail of who-did-what-when across all interactions, so that the platform is SOE-audit-ready (NFR15/18).
**Acceptance Criteria:**
1. Every state-change + customer-data-access event is recorded (actor, action, target, timestamp, trace_id).
2. Audit records are append-only (no update/delete).
3. Retention ≥ 12 months (NFR18).
**Tasks:**
- [ ] Audit interceptor/hook on command + data-access paths (AC:1)
- [ ] Append-only `audit_log` table (Drizzle) (AC:2)
- [ ] Retention config/job (AC:3)
**Dev Notes:** [Source: architecture.md §8, prd.md NFR15/18]. Carry trace_id (F.3).

### Story F.3: End-to-end trace_id propagation
Status: ready-for-dev
**Story:** As an operator, I want every customer interaction traceable end-to-end across services + the broker, so that I can diagnose where a message/ticket gets stuck (NFR13, FR57).
**Acceptance Criteria:**
1. Each inbound interaction gets a trace_id stamped at ingress.
2. trace_id propagates through broker event metadata (Omnichannel → Ticketing stub and back).
3. trace_id appears in structured logs (Loki) + the audit trail.
**Tasks:**
- [ ] Trace middleware (assign/extract trace_id) (AC:1)
- [ ] Stamp trace_id on broker event headers (AC:2)
- [ ] Include trace_id in pino log context + audit records (AC:3)
**Dev Notes:** Reuse existing OTel/Jaeger instrumentation in-repo. [Source: architecture.md §9, prd.md NFR13].

### Story F.4: Role-based PII restriction
Status: ready-for-dev
**Story:** As a customer, I want my PII visible only to roles that need it, so that my data is protected by least-privilege (FR58, NFR16).
**Acceptance Criteria:**
1. Customer PII fields are masked/restricted by role in BFF responses.
2. Data-access guards enforce role→field visibility server-side.
3. PII access is audit-logged (ties to F.2).
**Tasks:**
- [ ] Role→PII-field visibility rules (AC:1)
- [ ] Response-serialization guards (AC:1,2)
- [ ] PII-access audit hook (AC:3)
**Dev Notes:** [Source: architecture.md §8, prd.md FR58/NFR16].

---

## Epic 1 — Unified Agent Inbox & Multi-Channel Messaging (the spine)

### Story 1.1: Multi-channel webhook ingress + 200-OK + idempotency
Status: ready-for-dev
**Story:** As a channel partner (Zalo/App/FB), I want my webhook acknowledged instantly, so that I never time out — even if downstream processing is slow or down.
**Acceptance Criteria:**
1. Webhook endpoints (Zalo/App/FB/email) accept inbound, return HTTP 200 within 200ms (NFR4), independent of downstream.
2. Duplicate webhooks (same idempotency key) are detected + discarded (FR3).
3. On downstream failure, the interaction is retained (outbox) and retried — zero loss (FR7, NFR9).
**Tasks:**
- [ ] Webhook controllers per channel (AC:1)
- [ ] Redis idempotency-key check (AC:2)
- [ ] Transactional outbox + retry publisher (AC:3)
- [ ] DLQ for poisoned interactions (AC:3)
- [ ] Tests: dup webhook, downstream-down replay, 200ms ack (AC:1,2,3)
**Dev Notes:** `messaging` module; `@core` IEventBus + IOutboxRepository. [Source: architecture.md §3.1, ADR-2/6]. Emit `MessageReceived` to broker.

### Story 1.2: OmniMessage normalization + conversation/thread store
Status: ready-for-dev
**Story:** As an agent, I want every channel's message in one normalized format within a conversation thread, so that the inbox is unified regardless of source.
**Acceptance Criteria:**
1. Inbound from any channel → normalized `OmniMessage` (common schema).
2. Messages attach to a conversation; threads render in correct chronological order (FR8).
3. Attachments (photos) preserved.
**Tasks:**
- [ ] Per-channel normalizers → OmniMessage (AC:1)
- [ ] `conversations` + `messages` Drizzle schema (AC:2)
- [ ] Chronological ordering (AC:2)
- [ ] Attachment storage (AC:3)
**Dev Notes:** `conversation` module. [Source: architecture.md §6 data, prd.md FR4/8/10].

### Story 1.3: Realtime push gateway (socket.io) — new inbound to agent screen
Status: ready-for-dev
**Story:** As an agent, I want new inbound messages pushed to my screen in real time, so that I don't refresh (FR12, NFR1).
**Acceptance Criteria:**
1. On `MessageReceived`, the Omnichannel socket.io gateway pushes to the assigned agent's room.
2. Push latency ≤ 2s p95 from broker receipt (NFR1).
3. On reconnect, the client backfills missed events by last-seen id — no loss (ADR-9).
**Tasks:**
- [ ] socket.io gateway in Omnichannel service, agent rooms (AC:1)
- [ ] Broker subscriber → emit `interaction.received`/`message.sent` (AC:1)
- [ ] Event-log backfill endpoint (AC:3)
- [ ] Latency test (AC:2)
**Dev Notes:** `realtime-gateway` module (Arch §7). Confirm WS routing Open Item first. [Source: architecture.md §7, ADR-8/9].

### Story 1.4: Unified inbox BFF endpoints + bootstrap
Status: ready-for-dev
**Story:** As an agent opening the workspace, I want the inbox + a fast bootstrap payload, so that the delivered FE reaches interactivity quickly (FR9/13/17, NFR2/3).
**Acceptance Criteria:**
1. `GET /bff/inbox` returns filtered/paginated conversations (channel/status/customer/priority) (FR17).
2. `GET /bff/conversations/:id` returns thread + Customer-360 card + ticket/SLA chip (joined).
3. `GET /bff/bootstrap` returns session + inbox p1 + counters ≤ 1s p95 (NFR3).
**Tasks:**
- [ ] BFF aggregation resolvers (AC:1,2)
- [ ] Inbox filter logic (AC:1)
- [ ] Bootstrap aggregator (AC:3)
- [ ] BFF read latency ≤ 500ms p95 (NFR2)
**Dev Notes:** BFF `aggregation` (Arch §3.2/§4). Joins Omnichannel + Customer 360 (mock) + Ticketing stub. [Source: architecture.md §4].

### Story 1.5: Reply + outbound send
Status: ready-for-dev
**Story:** As an agent, I want to reply to a customer on the original channel, so that the conversation continues in place (FR5/11).
**Acceptance Criteria:**
1. Agent reply (BFF write) → outbound send on the conversation's origin channel.
2. Reply appears in the thread + is pushed real-time.
3. Outbound failures are retried (no silent loss).
**Tasks:**
- [ ] Outbound send per-channel adapter (AC:1)
- [ ] BFF reply endpoint + fan-out (AC:1,2)
- [ ] Outbox-retry on send failure (AC:3)
**Dev Notes:** `messaging` outbound. [Source: prd.md FR5/11].

### Story 1.6: Presence/routing + conversation close
Status: ready-for-dev
**Story:** As an agent, I want to set my availability and close/archive conversations, so that routing works and my inbox stays manageable (FR16/18).
**Acceptance Criteria:**
1. Agent can set availability (available/busy/offline); presence stored (Redis).
2. New interactions route to available agents (FR16).
3. Agent can close/archive a conversation (distinct from ticket resolution) (FR18).
**Tasks:**
- [ ] Presence store + status endpoint (AC:1)
- [ ] Routing-by-availability logic (AC:2)
- [ ] Conversation close/archive (AC:3)
**Dev Notes:** `conversation` module + Redis presence. [Source: prd.md FR16/18].

### Story 1.7: AI insight display (port)
Status: ready-for-dev
**Story:** As an agent, I want external AI tags + transcripts displayed on the conversation, so that I get context without the system owning AI (FR15, NFR22).
**Acceptance Criteria:**
1. AI-vision tag + speech-to-text transcript (from AI ports) render on the conversation screen.
2. AI-port failure degrades safely (circuit-breaker) — never blocks inbound (NFR22).
**Tasks:**
- [ ] AI Vision / Audio-AI / NLP port interfaces + mock adapters (AC:1)
- [ ] Circuit-breaker on AI calls (AC:2)
**Dev Notes:** Mock adapters wave 1. [Source: prd.md FR15/NFR22, architecture.md §3.1].

---

## Epic 2 — Customer Identity & 360° Context

### Story 2.1: Customer identity resolution + fallback
Status: ready-for-dev
**Story:** As a backend, I want to resolve a channel identifier to a unified customer profile (with fallback for unknowns), so that agents get context and no inbound is lost (FR28/30/31).
**Acceptance Criteria:**
1. Channel id (Zalo id / phone) → Customer-360 profile (via port).
2. Unresolved customers → fallback flow; inbound still captured (FR30).
3. Agent can create/link a provisional profile (FR31).
**Tasks:**
- [ ] Customer-360/Identity port interface + mock adapter (AC:1)
- [ ] Fallback "unidentified" path (AC:2)
- [ ] Provisional-profile create/link (AC:3)
**Dev Notes:** Distinct from IAM (agent auth). Redis profile cache. [Source: architecture.md §3.1/§6, epics.md Epic 2].

### Story 2.2: Customer 360 card in conversation view
Status: ready-for-dev
**Story:** As an agent, I want the customer's 360° card beside the conversation, so that I see contract/receivables/consumption/address context (FR29).
**Acceptance Criteria:**
1. `GET /bff/conversations/:id` includes the Customer-360 card (contract, receivables, consumption, address).
2. Card loads within the conversation-view latency budget (NFR2).
**Tasks:**
- [ ] BFF join: conversation + Customer-360 (AC:1)
- [ ] Profile cache for repeat lookups (AC:2)
**Dev Notes:** [Source: prd.md FR29, architecture.md §4].

---

## Epic 3 — Ticket Interaction & SLA Surfacing (needs Ticketing stub)

### Story 3.1: Ticket-create from conversation
Status: ready-for-dev
**Story:** As an agent, I want to create a ticket from a conversation in one click, so that the issue enters the tracked SLA flow (FR19).
**Acceptance Criteria:**
1. "Create ticket" → BFF sends `TicketCreateRequested` (with conversation + customer context) to the broker → Ticketing stub.
2. Ticket id returned/linked to the conversation.
3. Create is idempotent + queued if Ticketing is down (FR7, NFR9).
**Tasks:**
- [ ] BFF ticket-create endpoint → broker command (AC:1)
- [ ] Ticketing stub: accept `TicketCreateRequested`, return ticket id (AC:1,2)
- [ ] Idempotency + outbox-retry (AC:3)
**Dev Notes:** BFF `ticketing-contract-client`. Stub per epics.md stub contract. [Source: architecture.md §5, epics.md §Ticketing Stub Contract].

### Story 3.2: Ticket state + SLA countdown view
Status: ready-for-dev
**Story:** As an agent/supervisor, I want to see the ticket's current state + SLA countdown in the Kanban + Inbox, so that I track progress against SLA (FR20/60).
**Acceptance Criteria:**
1. `GET /bff/tickets/kanban` returns ticket state + SLA countdown (read from Ticketing stub).
2. Agent can advance ticket stages (proxied to Ticketing) (FR20).
3. SLA chip renders beside the conversation (FR60).
**Tasks:**
- [ ] BFF ticket-state read from stub (AC:1)
- [ ] Stage-advance proxy (AC:2)
- [ ] Inbox SLA chip data (AC:3)
**Dev Notes:** [Source: prd.md FR20/60, architecture.md §4/§5].

### Story 3.3: Consume + render SlaWarning
Status: ready-for-dev
**Story:** As a supervisor/agent, I want `SlaWarning` events rendered as a red-flash + countdown, so that I can act before breach (FR25, NFR10b).
**Acceptance Criteria:**
1. `SlaWarning` (from stub/broker) → pushed to the supervisor + responsible agent's Kanban/Inbox.
2. Render within 2s p95 of broker receipt (NFR10b).
3. Red-flash + blinking countdown UI data provided.
**Tasks:**
- [ ] Broker subscriber for `SlaWarning`/`SlaBreached` (AC:1)
- [ ] Gateway push `sla.warning`/`sla.tick` (AC:1,2)
- [ ] Stub emits `SlaWarning` on near-breach (AC:1)
**Dev Notes:** [Source: prd.md FR25/NFR10b, architecture.md §7]. Stub contract: emits `SlaWarning`.

---

## Epic 7 — Field-Incident Dispatch (MVP)

### Story 7.1: Dispatch Work Order to Field-team App
Status: ready-for-dev
**Story:** As an agent, when a field incident is confirmed I want to dispatch a Work Order to the Field-team App, so that crews act on it (FR62) — closing the J1 "chuyển đội hiện trường" loop.
**Acceptance Criteria:**
1. Confirmed incident → Work Order (type, priority, location/address, photo refs) sent to the Field-team App port.
2. Dispatch is broker-delivered + retried if the Field-team App is down (NFR9).
3. Dispatch status surfaced to the agent (WS `incident.dispatched`).
**Tasks:**
- [ ] `incident` module FSM dispatch trigger + Field-team port (mock) (AC:1)
- [ ] Outbox-retry on dispatch failure (AC:2)
- [ ] WS `incident.dispatched` event (AC:3)
**Dev Notes:** Intake = Epic 1 (FR1/10/15); ticket = Epic 3. MVP uses address text; geo-pin (FR52) is G2/Epic 9. [Source: prd.md FR62, epics.md Epic 7].

---

## Epic 8 — Supervisor Operations Dashboard (needs Ticketing stub)

### Story 8.1: Operations dashboard KPIs
Status: ready-for-dev
**Story:** As a supervisor, I want a real-time KPI dashboard (volume + SLA + CSAT), so that I monitor operations (FR53).
**Acceptance Criteria:**
1. `GET /bff/operations/kpis` returns interaction volume + channel mix (omnichannel) + SLA compliance/open-ticket counts (Ticketing stub) + CSAT.
2. Dashboard updates live (WS `kpi.tick`).
**Tasks:**
- [ ] BFF KPI aggregation joining omnichannel + Ticketing + CSAT (AC:1)
- [ ] WS `kpi.tick` periodic push (AC:2)
**Dev Notes:** [Source: prd.md FR53, architecture.md §4].

### Story 8.2: Reassign ticket
Status: ready-for-dev
**Story:** As a supervisor, I want to reassign a ticket to a free agent, so that I protect SLA (FR54).
**Acceptance Criteria:**
1. `POST /bff/tickets/:id/reassign` → `TicketReassignRequested` to Ticketing stub.
2. Reassignment reflected in the Kanban + agent routing.
3. Supervisor-only authorization (ties to F.1).
**Tasks:**
- [ ] BFF reassign endpoint → broker command (AC:1)
- [ ] Stub accepts `TicketReassignRequested`, reflects state (AC:2)
- [ ] Role guard supervisor/admin (AC:3)
**Dev Notes:** [Source: prd.md FR54, architecture.md §5].

---

## Epic 4 — Voice Call Handling (MVP slice)

### Story 4.1: VoIP screen-pop
Status: ready-for-dev
**Story:** As an agent, I want the caller's profile popped before I answer, so that I handle the call with context (FR32/33).
**Acceptance Criteria:**
1. VoIP/ACD ring event (port) → `call.ring` WS push + caller profile lookup (`GET /bff/customers/by-phone/:n`).
2. Agent answers within the 80/20 target data captured.
**Tasks:**
- [ ] `telephony` module + VoIP port (mock) (AC:1)
- [ ] Screen-pop BFF lookup + WS push (AC:1)
**Dev Notes:** [Source: prd.md FR32/33, architecture.md §4].

### Story 4.2: Recording reference + consent
Status: ready-for-dev
**Story:** As an agent, I want past-call recording references accessible + consent announced, so that recordings are retained transparently (FR35/59, NFR17).
**Acceptance Criteria:**
1. Recording reference (mock audio file) accessible from interaction history (FR35).
2. Consent announcement precedes recording (FR59); 90-day retention policy (NFR17).
**Tasks:**
- [ ] Recording-ref in interaction history (AC:1)
- [ ] Consent-announcement config + retention policy (AC:2)
**Dev Notes:** Real recording engine is G2 (FR34); MVP = mock file. [Source: prd.md FR35/59/NFR17].

---

## Epic 5 — Knowledge Base (MVP slice)

### Story 5.1: KB Vietnamese search
Status: ready-for-dev
**Story:** As an agent, I want to search the FAQ in Vietnamese (diacritics + synonyms) from the workspace, so that I find canned answers fast (FR14/39).
**Acceptance Criteria:**
1. `GET /bff/kb/search?q=` returns matching articles (Vietnamese diacritics + synonyms) via ElasticSearch.
2. Articles accessible from the workspace (FR14).
**Tasks:**
- [ ] `kb` module + ElasticSearch index (Vietnamese analyzer) (AC:1)
- [ ] Mock KB content seed (AC:1)
- [ ] Workspace KB access (AC:2)
**Dev Notes:** CMS workflow (FR40) + self-serve (FR41) are G2. [Source: prd.md FR14/39, architecture.md §6].

---

## Epic 6 — Customer Feedback (MVP slice)

### Story 6.1: CSAT on ticket close
Status: ready-for-dev
**Story:** As a backend, I want to request a CSAT rating when a ticket closes + emit `CsatSubmitted`, so that satisfaction is captured (FR42).
**Acceptance Criteria:**
1. On `TicketClosed` (from Ticketing stub), trigger a CSAT survey to the customer.
2. Submitted rating captured + `CsatSubmitted` emitted (consumed by Ticketing for auto-reopen FR27).
**Tasks:**
- [ ] `csat` module: subscribe `TicketClosed` → send survey (AC:1)
- [ ] Capture rating + emit `CsatSubmitted` (AC:2)
**Dev Notes:** NPS/CES/closing-loop/self-track/deflection are G2 (FR43–48). [Source: prd.md FR42, architecture.md §5].

---

## Deferred to Wave 3 (G2 — not in this set)
- **Epic 9** (FR49–52, mass-outage triage) — full G2.
- G2 FRs in Epics 4/5/6: FR34 (real recording), FR36–38 (IVR/skill-routing/callback), FR40/41 (KB CMS/self-serve), FR43–48 (full CSAT/NPS/CES/closing-loop/self-track/deflection).
- **Real Ticketing service** (wave 2): cutover stub → real (FR21–24, 26, 27, 61).

---

*Wave-1 MVP stories v0.1 by Bob (SM, *yolo). Ready for sprint planning ([SP]) → dev-story. Open Items (IAM role source, WS routing, hotline #) resolved per Foundation/Epic-1/Epic-4 stories before build.*
