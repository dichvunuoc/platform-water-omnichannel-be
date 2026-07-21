---
title: "OmniCare — Epic Breakdown (Backend scope)"
project_name: "nestjs-project-example"
product_name: "OmniCare"
document_type: "Epic Breakdown"
workflowType: "create-epics-and-stories (regenerated)"
version: "0.5 — Regenerated: Ticketing as Epic 10 [TKT] (in-project); v1.3 wave plan; no separate-service cutover"
status: "Epic list regenerated — aligned to PRD v1.3 + Architecture v0.4"
date: "2026-07-01"
author: "Pc"
sm: "Bob"
communication_language: "English"

# Workflow state
workflow: "create-epics-and-stories (regenerated for v1.3)"
stepsCompleted: ["step-02-design-epics", "reconcile-with-architecture-v0.4", "regenerate-for-prd-v1.3"]
currentStep: "epic list regenerated (v1.3)"
outputFile: "_bmad-output/planning-artifacts/epics.md"
source:
  prd: "prd.md (v1.3, Vietnamese) — 62 FRs (55 [OMNI] + 7 [TKT], all built in-project); 24 NFRs"
  architecture: "architecture.md (v0.4 — backend-only modular monolith; Omnichannel + in-project Ticketing module + BFF)"

changelog:
  - "v0.2 → v0.3 (2026-06-23): ADD Epic 7 (FR62); RENUMBER mass-outage → Epic 9 (G2); DISSOLVE Security epic into wave-1 FOUNDATION; fix Ticketing-contract dependencies (Epics 3, 6, 8); fix NFR links; AuthN delegated to existing IAM (v0.3.1)."
  - "v0.4 (2026-07-01): re-align to PRD v1.3 — 7 [TKT] FRs move from consumed-contract to in-project build scope; NFR10 now ours; Epic 9 unblocked."
  - "v0.5 (2026-07-01) — REGENERATED: (1) Ticketing becomes its own epic — **Epic 10: Ticketing & SLA Engine [TKT]** owning FR21–24, 26, 27, 61 (the T-1..T-6 stories); (2) wave plan rewritten — no 'wave-2 Ticketing service cutover' (Ticketing built in-project from wave 1); (3) 'Ticketing Stub Contract' section → 'Ticketing Module Contract (in-process)'; (4) Epic 3/6/8/9 dependencies → the Ticketing module (not stub/service); (5) T-6 marked OBSOLETE."

# Epic design rule: organized by USER VALUE (agent/supervisor/operator outcomes via the delivered FE) + one DOMAIN epic (Epic 10, the ticketing engine). Cross-cutting concerns (auth/audit/trace/PII) are wave-1 FOUNDATION stories, not an epic.
---

# OmniCare — Epic Breakdown (Backend scope, v0.5)

> Decomposes the **backend** requirements from [PRD v1.3](./prd.md) into epics, **reconciled with [Architecture v0.4](./architecture.md)** (every epic anchored to the real BFF endpoints + events + WS channels it owns). Frontend is already delivered (out of scope); each epic is the **backend capability** that powers it.
>
> **62 FRs, all built in-project** → **9 user-value/domain epics + a wave-1 cross-cutting Foundation**:
> - **Epics 1–9** are the user-facing outcomes (55 `[OMNI]` FRs).
> - **Epic 10 — Ticketing & SLA Engine `[TKT]`** is the in-project ticketing bounded-context module (7 `[TKT]` FRs: FR21–24, 26, 27, 61) — the engine behind Epics 3, 6, 8, 9.
>
> **(v1.3)** The 7 `[TKT]` FRs are built here (not consumed); NFR10 (`SlaWarning` emit ≤60s) is ours.

---

## Requirements Inventory

### Omnichannel build scope — 55 `[OMNI]` FRs (full text: PRD §9)
- **§1 Messaging:** FR1–8 *(FR6 G2)*
- **§2 Workspace:** FR9–18
- **§3a Ticket interaction:** FR19, 20, 25, 60
- **§4 Identity & 360:** FR28–31
- **§5 Telephony:** FR32–38 *(FR34, 36, 37, 38 G2)*, FR59
- **§6 KB:** FR39 *(FR40, 41 G2)*; FR14 (KB access from workspace)
- **§7 CSAT/Measurement:** FR42 *(FR43–48 G2)*
- **§8 Field incidents & outage:** FR62 (dispatch, MVP) · FR49–52 (triage, G2)
- **§9 Dashboard/Supervision:** FR53, 54
- **§10 Security/Audit:** FR55–58

### Ticketing module build — 7 `[TKT]` FRs (built in-project, v1.3 → Epic 10)
FR21, 22, 23, 24, 26, 27, 61 → owned by the **in-project Ticketing module** (`src/modules/ticketing`), built via the T-1..T-6 stories. Reached in-process (command bus / `IEventBus`); the contract is in PRD §9.3b + Architecture §5.

### Non-Functional (24, cross-cutting — full text PRD §10)
See the **NFR → Epic/Foundation map** below. NFR10 (`SlaWarning` emit ≤60s) is the **Ticketing module's** obligation — ours in v1.3 (built via T-2 / Epic 10).

---

## FR Coverage Map (55 OMNI → epics + foundation; 7 TKT → Epic 10)

```
FR1–FR8    → Epic 1   (messaging + ingestion; FR6 broadcast G2)
FR9–FR13   → Epic 1   (inbox / conversation / realtime / timeline)
FR15       → Epic 1   (AI insight + STT transcript display, via port)
FR16–FR18  → Epic 1   (presence/routing, inbox filter, conversation close)
FR28–FR31  → Epic 2   (identity resolution + Customer 360)
FR19,20,25,60 → Epic 3 (ticket interaction + SLA surfacing)
FR32,33,35 → Epic 4   (MVP: routing, screen-pop, recording ref)
FR59       → Epic 4   (MVP: recording-consent announcement)
FR34,36,37,38 → Epic 4 (G2: record/retain, IVR, skill/geo routing, callback)
FR14,39    → Epic 5   (MVP: KB access + Vietnamese search)
FR40,41    → Epic 5   (G2: KB CMS workflow, customer self-serve)
FR42       → Epic 6   (MVP: CSAT on close)
FR43–FR48  → Epic 6   (G2: multi-channel, NPS, CES, closing-loop, self-track, deflection)
FR62       → Epic 7   (MVP: Field-team Work-Order dispatch)
FR53,54    → Epic 8   (dashboard KPIs; reassign)
FR49–FR52  → Epic 9   (G2: mass-outage detection/clustering/split/geo)
FR55–FR58  → FOUNDATION (cross-cutting wave-1: auth/RBAC, audit, trace, PII)
FR21,22,23,24 → Epic 10 [TKT] (MVP: ticket aggregate + lifecycle + dual-clock SLA + breach worker)
FR26,27,61 → Epic 10 [TKT] (G2: escalation, CSAT-reopen, parent-incident grouping)
```
*All 62 FRs mapped (55 [OMNI] + 7 [TKT]); 0 gaps. FR55–58 are foundation, not a user-value epic.*

## NFR → Epic / Foundation map (v1.3)

| NFR | Where it lands | Note |
|---|---|---|
| NFR1 push ≤2s | Epic 1 | realtime gateway (Arch §7) |
| NFR2 BFF read ≤500ms | Foundation/BFF (esp. E1, E8) | aggregation (Arch §3.2) |
| NFR3 bootstrap ≤1s | Epic 1 / BFF | `GET /bff/bootstrap` (Arch §4) |
| NFR4 webhook ack ≤200ms | Epic 1 | ingress (ADR-2) |
| NFR5 rate-limit/DDoS | Foundation | API-gateway/BFF (Arch §8) — protects E1 webhook ingress |
| NFR6 ≥1,000 CCU | Epic 1 | ingress+realtime, HPA (Arch §10) |
| NFR7 10× scale · NFR8 99.9% · NFR11 recover · NFR12 RPO/RTO | Foundation (infra) | K8s/HPA/backup |
| **NFR9 zero message loss** | **Epic 1** *(was Epic 3)* | outbox+idempotency (ADR-2/6); FR7's measurable. *(v1.3: crash-recovery, not sibling-down.)* |
| NFR10 emit SlaWarning ≤60s | **Epic 10 [TKT]** *(was TKT-SVC contract)* | ours in v1.3 — Ticketing module (T-2) |
| NFR10b render SlaWarning ≤2s | Epic 3 | gateway relay (Arch §7) |
| NFR13 trace_id 100% | Foundation (observability) | trace through the bus (Arch §9), FR57 |
| NFR14,15,16,18,19 | Foundation (security/compliance) | encryption/RBAC-audit/residency/retention/DSAR (Arch §8) |
| **NFR17 recording 90d + consent** | **Epic 4** *(+compliance policy)* | telephony recording, FR59 |
| NFR20 semantic KB content | Epic 5 | backend content obligation (Arch §8) |
| NFR21 contract-tested integrations | Epic 10 (module boundary) · 2 (Customer 360) · 7 (Field-team) | module-level + port contract tests (Arch §5) |
| **NFR22 AI safe-degradation** | **Epic 1** | async (BullMQ) + circuit-breaker; never block inbound (ADR-5/12) |
| NFR23 callback ≤60s | Epic 4 | FR38 callback |

---

## Epic List

### Epic 1: Unified Agent Inbox & Multi-Channel Messaging *(MVP core — the spine)*
Agents receive, read, and reply to customer messages from every channel in one real-time inbox — and the platform never loses a message.
**FRs:** FR1, 2, 3, 4, 5, 6*(G2)*, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18 *(17)*
**Outcome:** all Zalo/App/FB/email threads unified + chronological; new messages pushed in real time; reply/filter/close; idempotent 200-OK ingestion drops nothing.
**Arch anchors:** `messaging`/`conversation`/`realtime-gateway`/`publisher` modules; `GET /bff/inbox`, `/bff/conversations/:id`, `/bff/bootstrap`; WS `interaction.received`/`message.sent`; outbox+Redis idempotency (ADR-6).
**Key NFRs:** NFR1, 3, 4, 6, 9, 22.
**Depends on:** Foundation (auth/trace). Nothing else — it is the spine.

### Epic 2: Customer Identity & 360° Context *(MVP)*
Agents know exactly who they're talking to and the full relationship — resolved from any channel id, with graceful fallback for unknowns.
**FRs:** FR28, 29, 30, 31 *(4)*
**Outcome:** 360° card (contract, receivables, consumption, address) beside the conversation; unknown customers handled via fallback without losing the inbound.
**Arch anchors:** Customer-360 / customer-identity-resolution **port** behind an **Anti-Corruption Layer** (ADR-11; mock wave-1 → real); Redis profile cache; BFF join in `GET /bff/conversations/:id`. Fallback "Khách Vô Danh" when the port is down (FR30).
**Key NFRs:** NFR2, 21.
**Depends on:** Foundation; **Customer 360 / Identity port**. Consumed by Epics 1, 3, 4, 7.

### Epic 3: Ticket Interaction & SLA Surfacing *(MVP — uses the Ticketing module)*
Agents create/advance tickets and everyone sees live ticket state + SLA countdown + breach alerts — sourced from the **in-project Ticketing module** (Epic 10).
**FRs:** FR19, 20, 25, 60 *(4)* — *the ticket engine FRs 21–24, 26, 27 are Epic 10 [TKT].*
**Outcome:** one click → ticket created (in-process); Kanban/Inbox show SLA countdown; `SlaWarning` renders red-flash+countdown ≤2s (NFR10b).
**Arch anchors:** BFF `write-fanout` + `ticketing-client`; `GET /bff/tickets/kanban`; WS `ticket.moved`/`sla.warning`/`sla.tick`.
**Key NFRs:** NFR10b, 21.
**Depends on:** Foundation; Epic 1; **Epic 10 (Ticketing module)** — commands out (`TicketCreateRequested`, `TicketStateChanged`); events in (`SlaWarning`, `SlaBreached`, `TicketStateChanged`).

### Epic 4: Voice Call Handling (Softphone) *(MVP core + G2 advanced)*
Agents handle 1900 calls with the caller's context popped before answering; recordings are retained, consented, and referenceable.
**FRs:** FR32, 33, 35, 59 *(MVP)* · FR34, 36, 37, 38 *(G2)* *(8)*
**Outcome:** on ring, softphone pops caller profile; answer within 80/20; consent announced before recording; past recordings accessible; (G2) IVR + skill/geo routing + app callback.
**Arch anchors:** `telephony` module = **signaling-only via PBX webhooks** (ADR-13): `call.ringing` → screen-pop, `call.ended` → recording URL (no RTP handled); `GET /bff/softphone/active`, `/bff/customers/by-phone/:n`; WS `call.ring`/`call.answer`/`call.hangup`.
**Key NFRs:** **NFR17 (recording 90d + consent)**, NFR23 (callback ≤60s, G2).
**Depends on:** Foundation; Epic 1; Epic 2 (screen-pop context); **VoIP/PBX port**.

### Epic 5: Knowledge Base & Answers *(MVP search + G2 CMS)*
Agents (and later customers) find accurate answers fast via a Vietnamese-aware knowledge base.
**FRs:** FR14, 39 *(MVP)* · FR40, 41 *(G2)* *(4)*
**Outcome:** agent searches FAQ from the workspace (diacritics + synonyms); (G2) author→edit→approve→publish CMS + customer self-serve.
**Arch anchors:** `kb` module + **ElasticSearch** (Vietnamese NLP); `GET /bff/kb/search?q=`.
**Key NFRs:** NFR20 (semantic content).
**Depends on:** Foundation; Epic 1 (workspace access).

### Epic 6: Customer Feedback & Measurement *(MVP CSAT + G2 full)*
The platform captures satisfaction to drive improvement — and closes the loop on unhappy customers.
**FRs:** FR42 *(MVP)* · FR43, 44, 45, 46, 47, 48 *(G2)* *(7)*
**Outcome:** after a ticket closes, a CSAT rating is requested and `CsatSubmitted` is emitted (consumed by the Ticketing module for auto-reopen, FR27); (G2) multi-channel, NPS, CES, closing-loop, self-track, deflection.
**Arch anchors:** `csat` module; `POST /bff/csat`; emits `CsatSubmitted`.
**Key NFRs:** NFR21.
**Depends on:** Foundation; Epic 1; **Epic 10 (Ticketing module)** — *triggered by `TicketClosed`* (in), *emits `CsatSubmitted`* (out, → FR27 reopen).

### Epic 7: Field-Incident Dispatch *(MVP)*
When a field incident is confirmed, the backend dispatches a Work Order to the Field-team App so crews can act — reliably, without losing the incident.
**FRs:** FR62 *(1)*
**Outcome:** confirmed incident → Work Order to the Field-team App (type, priority, location, photo refs); dispatch is **outbound-webhook + retry + DLQ** (ADR-12) so the order is never lost if the Field-team App is down (NFR9) — J1 ("đã chuyển đội hiện trường FSM") demos end-to-end.
**Arch anchors:** `incident` module (FSM dispatch trigger); `GET /bff/incidents/:id`; WS `incident.dispatched`; **Field-team App port** (mock wave-1).
**Key NFRs:** NFR9 (no-loss dispatch), NFR21.
**Depends on:** Foundation; Epic 1 (intake ingestion FR1/10 + AI-tag display FR15); **Field-team App port**.
**Note:** 1-FR epic by design — a distinct operational outcome (field crews). Intake/AI-tag are Epic 1; GIS pin (FR52) is G2/Epic 9 → MVP dispatch uses address text, full geo-pin lands in G2.

### Epic 8: Supervisor Operations Dashboard *(MVP)*
Supervisors see real-time operational KPIs and reassign work to protect SLA.
**FRs:** FR53, 54 *(2)*
**Outcome:** BFF-aggregated dashboard (volume + channel mix from omnichannel; SLA + open-ticket counts from the Ticketing module; CSAT) updates live; supervisors reassign tickets (invoking the Ticketing module).
**Arch anchors:** `GET /bff/operations/kpis` (joined); `POST /bff/tickets/:id/reassign`; WS `kpi.tick`.
**Key NFRs:** NFR2.
**Depends on:** Foundation; Epic 1; **Epic 10 (Ticketing module)** — reads ticket/SLA state + `TicketReassignRequested` (out).

### Epic 9: Mass-Outage Triage *(G2)*
The system auto-merges thousands of simultaneous outage reports into a single parent so the coordinator isn't flooded.
**FRs:** FR49, 50, 51, 52 *(all G2)* — *parent-incident grouping FR61 is Epic 10 [TKT].*
**Outcome:** burst reports cluster by geo + time + type into a parent (pre-ticket triage); affected list viewable; mis-merges split; GIS pin at intake.
**Arch anchors:** `incident` module (mass-outage clustering, FR49); `GET /bff/incidents`; WS `incident.classified`.
**Key NFRs:** NFR21.
**Depends on:** Foundation; Epic 1; Epic 7 (incident intake); **Epic 10 / FR61** (parent-grouping, in-project — unblocked in v1.3). G2.

### Epic 10: Ticketing & SLA Engine [TKT] *(MVP core + G2 depth — the ticketing bounded-context module)*
The in-project Ticketing module owns the ticket lifecycle, dual-clock SLA, breach detection, escalation, reopen, and parent-incident grouping — the engine behind Epics 3, 6, 8, 9.
**FRs:** FR21, 22, 23, 24 *(MVP)* · FR26, 27, 61 *(G2)* *(7)*
**Outcome:** tickets get unique IDs (`SC-XXXXXX`) + type/priority classification + SLA policy applied (dual-clock ack + resolve); a background worker detects approaching breaches and emits `SlaWarning`/`SlaBreached` ≤60s (NFR10); (G2) auto-escalation on breach, CSAT-driven reopen (CLOSED→IN_PROGRESS + new 24h SLA), parent-incident grouping of child tickets.
**Arch anchors:** `ticketing` module (`src/modules/ticketing`): `Ticket` aggregate + state machine + dual-clock SLA + `SlaWorkerService` (`@Cron` every 60s) + escalation + reopen + parent-incident; own schema (`tickets`); reached in-process via command bus / `IEventBus`. State changes only via Commands — never direct SQL `UPDATE` (PRD §9.3 encapsulation note).
**Key NFRs:** **NFR10 (SlaWarning emit ≤60s)**, NFR21.
**Depends on:** Foundation; Epic 1 (create-ticket trigger FR19). **Powers** Epics 3, 6, 8, 9.
**Stories:** T-1 (aggregate + lifecycle state machine), T-2 (dual-clock SLA engine), T-3 (escalation), T-4 (CSAT reopen), T-5 (parent-incident), ~~T-6 (contract cutover — OBSOLETE in v1.3)~~.
**Note:** this epic was absent pre-v1.3 (Ticketing was a "consumed contract"). Building it in-project is the core of the v1.3 decision.

---

## Cross-Cutting Foundation *(wave-1 platform — NOT an epic)*
Built **first**; every epic above runs on it. Tracked as foundation stories with their own acceptance criteria (so SOE/security value stays visible and testable).
- **FR55 (AuthN) — CONSUMED, not built:** authentication is handled by the **existing IAM** service. Our backend **validates IAM-issued sessions/tokens (JWT) and extracts identity/claims** at the API-gateway/BFF edge — an integration, not a build.
- **FR55 (AuthZ / RBAC) — built:** the backend **enforces role-based authorization** (agent/supervisor/admin) server-side at the BFF/domain boundary using the IAM identity (ADR-10). JWT validation + role extraction + `@Roles()` guard.
- **FR56** immutable audit trail (who/what/when) across interactions (NFR15).
- **FR57** end-to-end `trace_id` across all processing — propagated through the bus (NFR13, Arch §9).
- **FR58** role-based PII restriction (NFR15).
- **Security/compliance NFRs:** NFR14 (encryption), NFR16 (VN residency), NFR18 (12-mo log retention), NFR19 (DSAR ≤72h), NFR5 (rate-limit/DDoS).
- **Reliability/infra NFRs:** NFR7, 8, 11, 12 (scale/uptime/recovery/RPO-RTO) — reuse existing K8s/OTel/Loki/Grafana stack.
- **Consumed port:** **IAM (existing)** — AuthN / session-token validation. Wave-1 prerequisite for every epic.

---

## Dependencies & Wave Plan (v1.3 — aligned to Architecture §10)

**Dependency summary**
- **Foundation** → prerequisite for all epics (wave 1, first).
- **IAM (existing) port** → Foundation (AuthN / token validation) → prerequisite for all epics. *(Auth is consumed, not built.)*
- **Epic 1** → spine; Epics 2–9 build on its ingestion/realtime.
- **Epic 10 (Ticketing module)** → built wave 1 (real module, in-project); **powers Epics 3, 6, 8, 9**. *(Replaces the old "Ticketing contract stub" dependency — no stub, no separate service.)*
- **Customer 360 port** (customer identity resolution — distinct from IAM agent auth) → Epic 2 (→ feeds 1, 3, 4, 7), via Anti-Corruption Layer (ADR-11).
- **Field-team App port** → Epic 7 (outbound webhook + retry + DLQ, ADR-12).
- **AI vision/NLP/speech ports** → Epics 1 (FR15), 7, 4 — async via BullMQ (ADR-12).
- **Epic 9** → depends on Epic 7 intake + Epic 10 / FR61 (parent-grouping). G2.

**Waves (Architecture §10, v1.3)**
- **Wave 1 — MVP demo (J1/J2/J3):** Foundation + Epic 1 + Epic 2 + **Epic 10 (MVP: FR21–24)** + Epic 3 + Epic 7 + Epic 8 + MVP parts of Epic 4 (FR32,33,35,59), Epic 5 (FR14,39), Epic 6 (FR42) — into the delivered FE. *(The in-memory Ticketing stub is a local-dev fallback toggle only, superseded by the real module.)*
- **Wave 2 — real adapters + G2 depth:** real adapters (Customer 360, VoIP/PBX, AI) + KB CMS (FR40,41) + full CSAT/NPS (FR43–48) + telephony G2 (FR34,36,37,38) + **Epic 10 G2 (FR26,27,61)** + Epic 9 (FR49–52).
- *(No separate "Ticketing service cutover" wave — Ticketing is built in-project from wave 1.)*

---

## Ticketing Module Contract *(in-process — Architecture §5, v1.3)*
The Ticketing module is co-deployed and reached in-process (command bus / `IEventBus`); the contract shapes are preserved so a future split (ADR-1 extraction path) is a config/port swap.
- **Accepts commands (OMNI → TKT):** `TicketCreateRequested`, `TicketStateChanged`, `TicketReassignRequested` (each idempotency-keyed).
- **Emits events (TKT → OMNI):** `SlaWarning`, `SlaBreached`, `TicketClosed`, `TicketStateChanged`.
- **Sync reads (BFF → TKT, in-process):** ticket state + SLA countdown for the Kanban/Inbox.
- **Transactional outbox** around module-spanning writes → no message lost on process crash (NFR9); (DLQ added only if/when a real broker is introduced).
- Module-boundary contract tests (NFR21).
> `TicketClosed` emission is required for **Epic 6** (CSAT trigger); `SlaWarning` for **Epic 3**; reassign command for **Epic 8**.

---

## Open items inherited from Architecture (affect stories)
- **IAM role source:** ✅ **RESOLVED** — IAM is team-owned; agent roles (agent/supervisor/admin) are embedded in **JWT claims at login**. The BFF validates the token, extracts the role from claims, and **enforces RBAC at the gateway edge**. F.1 (AuthZ/RBAC) Foundation story = JWT validation + role extraction + `@Roles()` guard.
- **WS routing (Arch §12):** SPA socket.io via API-gateway → OmniCare realtime gateway (current) **vs** BFF proxies the WS upgrade. Decide before Epic 1 realtime stories.
- **Search index ownership** (ElasticSearch omnichannel-owned vs shared) — affects Epic 5 stories.
- **Hotline canonical number** (`1900 1090` vs `1900.545.520`) — IVR/screen-pop config, Epic 4.
- **Broker-less → broker swap trigger** (Arch §12) — the threshold at which a real broker / Ticketing split is justified.

---

*Epic list regenerated v0.5 (2026-07-01) by Bob (SM), aligned to PRD v1.3 + Architecture v0.4. Ticketing is now Epic 10 [TKT] (in-project). On sign-off: stories per epic (Given/When/Then) — wave-1 Foundation + Epic 1 + Epic 10 stories first.*
