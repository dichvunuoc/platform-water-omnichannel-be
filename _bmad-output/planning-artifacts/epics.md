---
title: "OmniCare — Epic Breakdown (Backend scope)"
project_name: "nestjs-project-example"
product_name: "OmniCare"
document_type: "Epic Breakdown"
workflowType: "create-epics-and-stories (compressed)"
version: "0.3.1 — Finalized epic list (reconciled with PRD v1.2 + Architecture v0.3; AuthN delegated to existing IAM)"
status: "Epic list finalized — ready for step-03 (stories) on sign-off"
date: "2026-06-23"
author: "Pc"
sm: "Bob"
communication_language: "English"

# Workflow state
workflow: "create-epics-and-stories (step-02 design, compressed)"
stepsCompleted: ["step-02-design-epics", "reconcile-with-architecture-v0.3"]
currentStep: "awaiting epic-list sign-off → step-03 (stories)"
outputFile: "_bmad-output/planning-artifacts/epics.md"
source:
  prd: "prd.md (v1.2) — 62 FRs (55 [OMNI] backend build + 7 [TKT-SVC] Ticketing contract); 24 NFRs"
  architecture: "architecture.md (v0.3 — backend-only; Omnichannel service + BFF)"

# v0.2 → v0.3 changes
changelog:
  - "ADD Epic 7 'Field-Incident Dispatch' (FR62, MVP) — closes the FSM/Work-Order gap flagged in review."
  - "RENUMBER old mass-outage epic → Epic 9 'Mass-Outage Triage' (G2)."
  - "DISSOLVE old 'Security' epic into a cross-cutting WAVE-1 FOUNDATION (FR55–58 + security/observability NFRs) — not a user-value epic."
  - "FIX dependencies: Ticketing contract is consumed by Epics 3, 6, AND 8 (not Epic 3 only); Epic 2 depends on Customer 360/Identity port."
  - "FIX NFR links: NFR9 → Epic 1 (ingestion/outbox); NFR17 → Epic 4 (recording); NFR13–19 → Foundation (were mislinked to the old Epic 9)."
  - "FIX stub contract: wave-1 Ticketing stub must emit SlaWarning + TicketClosed and accept TicketCreateRequested/TicketStateChanged/TicketReassignRequested (per Architecture §5)."
  - "v0.3.1: AuthN delegated to the EXISTING IAM (consumed port, not built). Foundation now builds only AuthZ/RBAC enforcement + audit + trace + PII; IAM added as a wave-1 prerequisite port. Customer-360 'identity' (customer resolution) kept distinct from IAM (agent auth)."

# Epic design rule applied: organized by USER VALUE (agent/supervisor/operator outcomes via the delivered FE), not technical layers. Cross-cutting concerns (auth/audit/trace/PII) are wave-1 FOUNDATION stories, not an epic.
---

# OmniCare — Epic Breakdown (Backend scope, v0.3)

> Decomposes the **backend** requirements from [PRD v1.2](./prd.md) into user-value epics, **reconciled with [Architecture v0.3](./architecture.md)** (every epic anchored to the real BFF endpoints + broker events + WS channels it owns). Frontend is already delivered (out of scope); each epic is the **backend capability** that powers it.
>
> **55 `[OMNI]` FRs** → **8 user-value epics + 1 G2 triage epic + a wave-1 cross-cutting Foundation**. **7 `[TKT-SVC]`** FRs (FR21–24, 26, 27, 61) belong to the Ticketing service's own PRD (consumed, not built here).

---

## Requirements Inventory

### Build scope — 55 `[OMNI]` FRs (full text: PRD §9)
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

### Ticketing service contract — 7 `[TKT-SVC]` (NOT built here)
FR21, 22, 23, 24, 26, 27, 61 → owned by the Ticketing & SLA microservice (separate PRD). Consumed via broker + BFF; the contract is in PRD §3b + Architecture §5.

### Non-Functional (24, cross-cutting — full text PRD §10)
See the **NFR → Epic/Foundation map** below. NFR10 (`SlaWarning` emit ≤60s) is the **Ticketing service's** obligation (TKT-SVC contract), not ours.

---

## FR Coverage Map (55 OMNI → epics + foundation)

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
```
*All 55 `[OMNI]` FRs mapped; 0 gaps. FR55–58 are foundation, not an epic.*

## NFR → Epic / Foundation map (corrected in v0.3)

| NFR | Where it lands | Note |
|---|---|---|
| NFR1 push ≤2s | Epic 1 | realtime gateway (Arch §7) |
| NFR2 BFF read ≤500ms | Foundation/BFF (esp. E1, E8) | aggregation (Arch §3.2) |
| NFR3 bootstrap ≤1s | Epic 1 / BFF | `GET /bff/bootstrap` (Arch §4) |
| NFR4 webhook ack ≤200ms | Epic 1 | ingress (ADR-2) |
| NFR5 rate-limit/DDoS | Foundation | API-gateway/BFF (Arch §8) — protects E1 webhook ingress |
| NFR6 ≥1,000 CCU | Epic 1 | ingress+realtime, HPA (Arch §10) |
| NFR7 10× scale · NFR8 99.9% · NFR11 recover · NFR12 RPO/RTO | Foundation (infra) | K8s/HPA/backup |
| **NFR9 zero message loss** | **Epic 1** *(was Epic 3)* | outbox+idempotency+DLQ (ADR-2/6); FR7's measurable |
| NFR10 emit SlaWarning ≤60s | **TKT-SVC contract** | Ticketing's obligation, not ours |
| NFR10b render SlaWarning ≤2s | Epic 3 | gateway relay (Arch §7) |
| NFR13 trace_id 100% | Foundation (observability) | trace through broker (Arch §9), FR57 |
| NFR14,15,16,18,19 | Foundation (security/compliance) | encryption/RBAC-audit/residency/retention/DSAR (Arch §8) |
| **NFR17 recording 90d + consent** | **Epic 4** *(+compliance policy)* | telephony recording, FR59 |
| NFR20 semantic KB content | Epic 5 | backend content obligation (Arch §8) |
| NFR21 contract-tested integrations | Epics 3, 6, 8 (Ticketing) · 2 (Customer 360) · 7 (Field-team) | consumer-driven CDC (Arch §5) |
| **NFR22 AI safe-degradation** | **Epic 1** *(added)* | circuit-breaker; never block inbound (ADR-5) |
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
**Arch anchors:** Customer-360 / customer-identity-resolution **port** (mock wave-1 → real; distinct from IAM agent auth); Redis profile cache; BFF join in `GET /bff/conversations/:id`.
**Key NFRs:** NFR2, 21.
**Depends on:** Foundation; **Customer 360 / Identity port**. Consumed by Epics 1, 3, 4, 7.

### Epic 3: Ticket Interaction & SLA Surfacing *(MVP — needs Ticketing stub)*
Agents create/advance tickets and everyone sees live ticket state + SLA countdown + breach alerts — sourced from the Ticketing & SLA service.
**FRs:** FR19, 20, 25, 60 *(4)* — *contract FRs 21–24, 26, 27 are the Ticketing service's scope.*
**Outcome:** one click → `TicketCreateRequested`; Kanban/Inbox show SLA countdown; `SlaWarning` renders red-flash+countdown ≤2s (NFR10b).
**Arch anchors:** BFF `write-fanout` + `ticketing-contract-client`; `GET /bff/tickets/kanban`; WS `ticket.moved`/`sla.warning`/`sla.tick`.
**Key NFRs:** NFR10b, 21.
**Depends on:** Foundation; Epic 1; **Ticketing contract** (commands out: `TicketCreateRequested`, `TicketStateChanged`; events in: `SlaWarning`, `SlaBreached`, `TicketStateChanged`).

### Epic 4: Voice Call Handling (Softphone) *(MVP core + G2 advanced)*
Agents handle 1900 calls with the caller's context popped before answering; recordings are retained, consented, and referenceable.
**FRs:** FR32, 33, 35, 59 *(MVP)* · FR34, 36, 37, 38 *(G2)* *(8)*
**Outcome:** on ring, softphone pops caller profile; answer within 80/20; consent announced before recording; past recordings accessible; (G2) IVR + skill/geo routing + app callback.
**Arch anchors:** `telephony` module (VoIP/ACD events, screen-pop signal); `GET /bff/softphone/active`, `/bff/customers/by-phone/:n`; WS `call.ring`/`call.answer`/`call.hangup`.
**Key NFRs:** **NFR17 (recording 90d + consent)**, NFR23 (callback ≤60s, G2).
**Depends on:** Foundation; Epic 1; Epic 2 (screen-pop context).

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
**Outcome:** after a ticket closes, a CSAT rating is requested and `CsatSubmitted` is emitted (consumed by Ticketing for auto-reopen, FR27); (G2) multi-channel, NPS, CES, closing-loop, self-track, deflection.
**Arch anchors:** `csat` module; `POST /bff/csat`; emits `CsatSubmitted`.
**Key NFRs:** NFR21.
**Depends on:** Foundation; Epic 1; **Ticketing contract** — *triggered by `TicketClosed`* (in), *emits `CsatSubmitted`* (out). *(This dependency was missing in v0.2.)*

### Epic 7: Field-Incident Dispatch *(MVP)*
When a field incident is confirmed, the backend dispatches a Work Order to the Field-team App so crews can act — reliably, without losing the incident.
**FRs:** FR62 *(1)*
**Outcome:** confirmed incident → Work Order to the Field-team App (type, priority, location, photo refs); dispatch is broker-delivered and **retried if the Field-team App is down** (NFR9), so J1 ("đã chuyển đội hiện trường FSM") demos end-to-end.
**Arch anchors:** `incident` module (FSM dispatch trigger); `GET /bff/incidents/:id`; WS `incident.dispatched`; **Field-team App port** (mock wave-1).
**Key NFRs:** NFR9 (no-loss dispatch), NFR21.
**Depends on:** Foundation; Epic 1 (intake ingestion FR1/10 + AI-tag display FR15); **Field-team App port**.
**Note:** 1-FR epic by design — a distinct operational outcome (field crews). Intake/AI-tag are Epic 1; GIS pin (FR52) is G2/Epic 9 → MVP dispatch uses address text, full geo-pin lands in G2.

### Epic 8: Supervisor Operations Dashboard *(MVP)*
Supervisors see real-time operational KPIs and reassign work to protect SLA.
**FRs:** FR53, 54 *(2)*
**Outcome:** BFF-aggregated dashboard (volume + channel mix from omnichannel; SLA + open-ticket counts from Ticketing; CSAT) updates live; supervisors reassign tickets (proxied to Ticketing).
**Arch anchors:** `GET /bff/operations/kpis` (joined); `POST /bff/tickets/:id/reassign`; WS `kpi.tick`.
**Key NFRs:** NFR2.
**Depends on:** Foundation; Epic 1; **Ticketing contract** — reads ticket/SLA state + `TicketReassignRequested` (out). *(This dependency was missing in v0.2.)*

### Epic 9: Mass-Outage Triage *(G2)*
The system auto-merges thousands of simultaneous outage reports into a single parent so the coordinator isn't flooded.
**FRs:** FR49, 50, 51, 52 *(all G2)* — *parent-incident grouping FR61 is the Ticketing service.*
**Outcome:** burst reports cluster by geo + time + type into a parent (pre-ticket triage); affected list viewable; mis-merges split; GIS pin at intake.
**Arch anchors:** `incident` module (mass-outage clustering, FR49); `GET /bff/incidents`; WS `incident.classified`.
**Key NFRs:** NFR21.
**Depends on:** Foundation; Epic 1; Epic 7 (incident intake); **Ticketing FR61** (parent-grouping, wave-2). G2 / wave-3.

---

## Cross-Cutting Foundation *(wave-1 platform — NOT an epic)*
Built **first**; every epic above runs on it. Tracked as foundation stories with their own acceptance criteria (so SOE/security value stays visible and testable).
- **FR55 (AuthN) — CONSUMED, not built:** authentication is handled by the **existing IAM** service. Our backend **validates IAM-issued sessions/tokens (JWT) and extracts identity/claims** at the API-gateway/BFF edge — an integration, not a build.
- **FR55 (AuthZ / RBAC) — built:** the backend **enforces role-based authorization** (agent/supervisor/admin) server-side at the BFF/domain boundary using the IAM identity (ADR-10). *(Role source — IAM claims vs. our own role config — see Open Items.)*
- **FR56** immutable audit trail (who/what/when) across interactions (NFR15).
- **FR57** end-to-end `trace_id` across all processing — propagated through the broker (NFR13, Arch §9).
- **FR58** role-based PII restriction (NFR15).
- **Security/compliance NFRs:** NFR14 (encryption), NFR16 (VN residency), NFR18 (12-mo log retention), NFR19 (DSAR ≤72h), NFR5 (rate-limit/DDoS).
- **Reliability/infra NFRs:** NFR7, 8, 11, 12 (scale/uptime/recovery/RPO-RTO) — reuse existing K8s/OTel/Loki/Grafana stack.
- **Consumed port:** **IAM (existing)** — AuthN / session-token validation. Wave-1 prerequisite for every epic.

---

## Dependencies & Wave Plan (corrected; aligned to Architecture §10)

**Dependency summary**
- **Foundation** → prerequisite for all epics (wave 1, first).
- **IAM (existing) port** → Foundation (AuthN / token validation) → prerequisite for all epics. *(Auth is consumed, not built.)*
- **Epic 1** → spine; Epics 2–9 build on its ingestion/realtime.
- **Ticketing contract (stub wave-1)** → consumed by **Epics 3, 6, 8** *(not Epic 3 alone)*.
- **Customer 360 port** (customer identity resolution — distinct from IAM agent auth) → Epic 2 (→ feeds 1, 3, 4, 7).
- **Field-team App port** → Epic 7. **AI vision/NLP/speech ports** → Epics 1 (FR15), 7, 4.
- **Epic 9** → depends on Epic 7 intake + Ticketing FR61 (parent-grouping, wave-2). G2.

**Waves (Architecture §10)**
- **Wave 1 — MVP demo (J1/J2/J3):** Foundation + Epic 1 + Epic 2 + Epic 3 + Epic 7 + Epic 8 + MVP parts of Epic 4 (FR32,33,35,59), Epic 5 (FR14,39), Epic 6 (FR42) — running against the **Ticketing stub**, into the delivered FE.
- **Wave 2 — real Ticketing:** cutover to the real Ticketing service behind the same contract (no rebuild our side); unlocks FR26/27/61 + real SLA engine.
- **Wave 3 — G2 depth:** real adapters + KB CMS (FR40,41) + full CSAT (FR43–48) + Epic 9 (FR49–52) + telephony G2 (FR34,36,37,38).

---

## Ticketing Stub Contract *(wave-1 — Architecture §5)*
The wave-1 stub implements the consumer side so cutover is a config swap:
- **Accepts commands:** `TicketCreateRequested`, `TicketStateChanged`, `TicketReassignRequested` (each idempotency-keyed).
- **Emits events:** `SlaWarning`, `SlaBreached`, `TicketClosed`, `TicketStateChanged`.
- **Sync reads (via BFF):** ticket state + SLA countdown for the Kanban/Inbox.
- DLQ for poisoned commands; never blocks ingestion (NFR9). Consumer-driven contract tests both sides (NFR21).
> `TicketClosed` emission is required for **Epic 6** (CSAT trigger); `SlaWarning` for **Epic 3**; reassign command for **Epic 8**. *(v0.2 listed only `SlaWarning`.)*

---

## Open items inherited from Architecture (affect stories)
- **IAM role source:** ✅ **RESOLVED** — IAM is team-owned; agent roles (agent/supervisor/admin) are embedded in **JWT claims at login**. The BFF validates the token, extracts the role from claims, and **enforces RBAC at the gateway edge** — rejecting unauthorized requests before they reach any domain service. No user-role mapping table needed in OmniCare. This simplifies the F.1 (AuthZ/RBAC) Foundation story to: JWT validation + role extraction + `@Roles()` guard.
- **WS routing (Arch §12):** SPA socket.io via API-gateway → Omnichannel gateway (current) **vs** BFF proxies the WS upgrade. Decide before Epic 1 realtime stories.
- **Architecture frontmatter staleness:** says "61 FRs · 24 NFRs"; PRD is now **62 FRs** (FR62 added). Non-blocking doc-sync.
- **Search index ownership** (ElasticSearch omnichannel-owned vs shared) — affects Epic 5 stories.
- **Hotline canonical number** (`1900 1090` vs `1900.545.520`) — IVR/screen-pop config, Epic 4.

---

*Epic list v0.3 by Bob (SM), reconciled with PRD v1.2 + Architecture v0.3. **Awaiting sign-off** before step-03 (story creation). On approval: stories per epic (Given/When/Then) + wave-1 Foundation stories first.*
