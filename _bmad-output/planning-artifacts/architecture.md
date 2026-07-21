---
title: "OmniCare — Architecture Decision Document"
project_name: "nestjs-project-example"
product_name: "OmniCare"
document_type: "Architecture Decision Document"
workflowType: "architecture"
version: "0.4 — Backend-only, modular monolith (aligned to PRD v1.3)"
status: "Draft — backend architecture (OmniCare backend: Omnichannel + in-project Ticketing module + BFF)"
date: "2026-07-01"
author: "Pc"
architect: "Winston"
communication_language: "English"
document_output_language: "English"

# Workflow state
workflow: "create-architecture (compressed — derived directly from a finalized PRD)"
stepsCompleted: [1]
currentStep: "derived (see note)"
outputFile: "_bmad-output/planning-artifacts/architecture.md"
prd_source: "prd.md (v1.3, Vietnamese) — authoritative; ticketing merged in-project"

# Input documents
inputDocuments:
  prd: "prd.md (v1.3, Vietnamese) — BACKEND-ONLY capability contract, ticketing merged in-project (62 FRs · 24 NFRs)"
  product_brief: "product-brief-omnicare-2026-06-20.md"
  execution_plan: "execution-plan-omnicare.md (v3.0 — omnichannel-first waves)"
  backend_build_plan: "backend-build-plan-omnicare-2026-06-20.md (module catalog/ports/data)"
  business_spec: "chapter5-omnichannel-spec.md (§5.1–5.4)"
  ux: "6 UI mockups (delivered frontend reference) — Inbox hợp nhất · Tổng đài 1900 · Sự cố hiện trường · Ticket & SLA Kanban · Điều hành CSKH dashboard · Proactive Broadcast"

# Inherited locked decisions (from PRD v1.2 + execution plan v3.0 — not re-litigated)
inherited_decisions:
  scope: "BACKEND ONLY: a single OmniCare backend deployable housing the Omnichannel + Ticketing (in-project) bounded-context modules and the BFF. Frontend SPA is already delivered — consumed client, NOT built here. Ticketing & SLA = in-project module (v1.3), co-deployed — no longer a separate microservice."
  deployment: "Modular monolith — one deployable, internal bounded-context modules (Omnichannel + Ticketing) with their own PostgreSQL schemas; Omnichannel ↔ Ticketing communicate in-process."
  broker: "In-process IEventBus today (the current implementation has no broker dependency); the @core IEventBus port lets RabbitMQ/Kafka be slotted in later without module rewrites."
  bff: "Single HTTP entry point for the SPA — sync aggregation; no FE→domain-module HTTP call."
  realtime_gateway: "socket.io gateway lives in the OmniCare backend (PRD v1.3 §8); in-process event bus is the spine; reconnect + idempotent backfill."
  contract_first: "Omnichannel ↔ Ticketing module contract (commands/events) defined in wave 1; idempotency + transactional outbox at the edge."
  fe_conformance: "Backend conforms to the APIs/events the delivered FE already calls — not the reverse."
  ai: "Fully external (mock adapters MVP → real API later); core is 100% routing & communication."
  stack: "NestJS 11 (Fastify) + Bun + Drizzle + PostgreSQL + Redis + CQRS/DDD (@core IEventBus/IOutbox); OTel/Jaeger/Prometheus/Loki/Grafana + K8s (existing in-repo)."

note: "Architecture derived directly from PRD v1.3 (BMAD step-by-step elicitation compressed — core decisions locked, PRD is a complete capability contract). v0.4 re-aligns to PRD v1.3: Ticketing & SLA is built IN-PROJECT as a co-deployed bounded-context module (modular monolith), reversing the v1.1/v0.3 'separate microservice' decision. Frontend remains delivered and out of scope. Each ADR states decision + rationale + rejected alternative."
---

# Architecture Decision Document — OmniCare (Backend scope, v0.3)

> **Scope:** **backend only** — the **OmniCare backend** (a single deployable housing the Omnichannel module, the **in-project Ticketing module**, and the BFF) per [PRD v1.3](./prd.md). The agent-workspace **frontend is already delivered** and is a *consumed client*, not built here. The **Ticketing & SLA** capability is built in-project as a co-deployed bounded-context module (own schema) — v0.4 reverses the prior "separate microservice" decision. This document defines the **server-side surface** (APIs, events, WebSocket gateway) + the **Omnichannel ↔ Ticketing module contract**.
>
> **Architect's stance (Winston):** boring, proven tech where stability matters (PostgreSQL, Redis, the existing `@core` ports); the backend **conforms to the delivered frontend's contracts**; every choice tied to business value. The event bus stays in-process today behind the `IEventBus` port — a real broker is deferred until a split is actually warranted.

---

## 1. System Context

```
                       ┌──────────────────────────────────────────────┐
   Zalo OA ──webhook──▶│                                              │
   App/FB/Email ───────▶│           API GATEWAY (rate-limit, auth)     │
   VoIP/ACD ──event────▶│                                              │
                       └──────┬───────────────────────┬───────────────┘
                  HTTPS (BFF) │                       │ WebSocket (socket.io)
                              ▼                       ▼
        ┌─────────────────────────────────────────────────────────────────┐
        │              OMNICARE BACKEND  (single deployable)              │
        │                    NestJS + Fastify + Bun                        │
        │  ┌──────────────────┐        ┌───────────────────────────────┐  │
        │  │       BFF         │       │   OMNICHANNEL MODULE          │  │
        │  │ • HTTP aggregation│       │   • ingress/normalize/200OK   │  │
        │  │ • write fan-out   │◀─────▶│   • idempotency (Redis)       │  │
        │  │ • auth/RBAC       │ sync  │   • conversation/incident/    │  │
        │  │ • bootstrap ≤1s   │ reads │     KB/broadcast/CSAT         │  │
        │  └────────┬──────────┘       │   • socket.io realtime gw    │  │
        │           │                  │   • outage clustering         │  │
        │           │      ┌───────────┴──────────────┐                 │  │
        │           │      │  TICKETING MODULE [TKT]   │                 │  │
        │           │      │  • ticket lifecycle/SLA   │                 │  │
        │           │      │  • breach worker→SlaWarn  │                 │  │
        │           │      │  • escalation / reopen    │                 │  │
        │           │      │  • parent-incident (FR61) │                 │  │
        │           │      │  (own schema: tickets)    │                 │  │
        │           │      └─────────────▲────────────┘                 │  │
        │           └────────────────────┘                               │  │
        │   in-process IEventBus (port; broker pluggable, deferred)      │  │
        │   PostgreSQL (shared instance, per-module schemas) · Redis     │  │
        └──────────────────────────────────┬─────────────────────────────┘
                                           │ HTTPS / WebSocket (the delivered SPA)
        ┌──────────────────────────────────┴───────────────────────────┐
        │  FRONTEND SPA — ALREADY DELIVERED ⛔                           │ (5 screens; consumed client)
        │  Inbox · Tổng đài · Sự cố · Kanban · Dashboard
        └────────────────────────────────────────────────────────────────┘
   External ports (mock → real): Customer 360 · Identity/IAM · AI (vision/NLP/speech) · FSM/GIS · Field-team App
```

> The delivered SPA talks to **two backend surfaces**: the **BFF** (HTTPS — aggregation, writes, auth) and the **Omnichannel realtime gateway** (WebSocket — push). Both sit behind the same API gateway (auth, rate-limit).

---

## 2. Architectural Decisions (ADRs)

| # | Decision | Rationale | Rejected alternative |
|---|---|---|---|
| **ADR-1** | **Modular monolith (single deployable)** — Omnichannel + Ticketing as internal bounded-context modules (own schemas) co-deployed in the OmniCare backend | One deployable = simpler ops for the demo/đồ án scope; bounded contexts preserved at the module/schema level; extractable later if scale demands | Distributed microservices day-1 (v0.3/v1.1 choice — rejected: doubles ops for unproven scale; the stub/broker were never actually wired) |
| **ADR-2** | **In-process event bus between modules** (Omnichannel ↔ Ticketing over `@core` `IEventBus`); no inter-process network hop | Ingress resilience still holds (200 OK, FR2/NFR4 via outbox); no cross-process failure modes; modules stay decoupled behind the port | Sync command calls only (tighter coupling); async-over-broker day-1 (rejected: a broker was never deployed) |
| **ADR-3** | **BFF = single HTTP entry point for the SPA** | One HTTP contract for FE; aggregates conversation = omnichannel thread + Customer 360 + ticket/SLA state; shields FE from topology | FE calls domain modules directly over HTTP (chatty, leaks topology) |
| **ADR-4** | **`@core` `IEventBus` port, in-process implementation today** (broker pluggable later) | Boring, proven port; current implementation needs no broker dependency; RabbitMQ/Kafka slot in behind the port if/when a split happens | Mandating RabbitMQ day-1 (heavier ops; no cross-process boundary to justify it) |
| **ADR-5** | **AI fully external** (mock adapters → real API) | Core stays pure routing/comms; no heavy-model ops risk; pluggable | Building AI in-house (out of scope, `ai_strategy`) |
| **ADR-6** | **Transactional Outbox + idempotency** around ticket-create and other module-spanning writes | No message lost on process crash (FR7/NFR9); dedup on retries (FR3); poisoned messages quarantined via DLQ when a broker is added | Direct publish-and-pray (message loss on crash) |
| **ADR-7** | **Backend conforms to the delivered FE's contracts** | FE already shipped (5 screens); backend matches the API shapes/screens it calls — conformance, not greenfield API design | Service-first API design that the FE must be rewritten to call |
| **ADR-8** | **socket.io realtime gateway in the OmniCare backend** (PRD v1.3 §8) | Gateway owns the realtime domain (push, screen-pop, `SlaWarning` relay); in-process `IEventBus` is the spine feeding it | Realtime in the BFF (BFF stays HTTP-only; cleaner separation) |
| **ADR-9** | **Reconnect + idempotent backfill** on the WS gateway | No message loss across reconnects; client requests missed events by last-seen id | Fire-and-forget push (lost events on flaky connections) |
| **ADR-10** | **AuthN via IAM (JWT), AuthZ at BFF edge** — BFF validates token + extracts role from JWT claims + enforces RBAC before forwarding | IAM (team-owned) embeds roles in claims; BFF = security checkpoint; no user-role mapping in OmniCare (FR55 simplified) | Trusting client-side checks / managing role-mapping locally |
| **ADR-11** | **Anti-Corruption Layer (ACL) adapter** for external ports (Customer 360, FSM, future) — a dedicated adapter in the BFF/domain translates between OmniCare's model and the external service's model | Isolates OmniCare from external schema/API drift; enables clean fallback (e.g. "Khách Vô Danh" when Customer 360 is down, FR30) without polluting domain logic | Calling external APIs directly from handlers (couples domain to external contracts; no clean fallback) |
| **ADR-12** | **Async job queue (BullMQ/Redis)** for AI inference with webhook-callback return; **outbound webhook + retry + DLQ** for downstream writes (FSM dispatch, Customer writes) | AI is slow → never block the event loop (NFR22 safe-degradation); downstream 5xx → retry via DLQ, no lost dispatch (FR62) | Sync AI calls (blocks event loop under load); fire-and-forget outbound (lost dispatch on downstream failure) |
| **ADR-13** | **Telephony = signaling-only** via PBX webhooks (`call.ringing` / `call.ended`) — NestJS never handles RTP/media; routing left to the PBX; recording fetched as a URL | NestJS stays free of real-time media complexity; PBX vendors (Stringee/VCCall) optimize queue/routing/recording | In-process SIP/media handling (huge complexity, poor fit for NestJS) |

> **Integration hookup flows** — Telephony PBX webhooks, Customer-360 ACL + fallback, AI async-queue + webhook callback, FSM outbound + retry/DLQ — are detailed end-to-end in [PRD §8.5 "Giải pháp móc nối kỹ thuật"](./prd.md) (Vietnamese).

---

## 3. Component Architecture (backend-only build)

### 3.1 Omnichannel service (built — NestJS + Fastify + Bun)
Mirrors the existing NestJS DDD pattern (`@core`/`@shared` + feature modules). DDD + CQRS + Hexagonal:
- **messaging** — webhook ingress, normalization (`OmniMessage`), idempotency (Redis), outbound send.
- **conversation** — unified-inbox data, conversation/thread aggregate, interaction timeline.
- **telephony** — VoIP/ACD events, screen-pop signal emission.
- **incident** — field-incident intake, AI-tag relay (port), GIS-pin data, FSM dispatch trigger, **mass-outage clustering (FR49, pre-ticket triage)**.
- **kb** — FAQ CMS + Vietnamese search (ElasticSearch).
- **broadcast** — proactive notification campaigns.
- **csat** — CSAT/NPS/CES capture + survey delivery; emits `CsatSubmitted`.
- **realtime-gateway** — socket.io server; subscribes to in-process bus events → pushes to agent rooms; reconnect/backfill.
- **publisher** — publishes domain events via `IEventBus` (in-process; broker pluggable behind the port); outbox processor.

### 3.2 BFF (built — NestJS gateway)
- **aggregation** — sync read-joins per screen (conversation + Customer 360 + ticket/SLA state).
- **bootstrap** — single call returning session + inbox first page + counters ≤ 1s (NFR3) for fast FE interactivity.
- **write-fanout** — SPA writes proxied to the right module (ticket-create → Ticketing command; reassign → Ticketing).
- **auth/rbac** — agent session, server-side role enforcement (FR55, ADR-10), rate limiting (NFR5).
- **ticketing-client** — the Omnichannel↔Ticketing module adapter (commands out, events in, sync reads — all in-process).

### 3.3 Frontend SPA — ⛔ NOT built (delivered)
Already shipped (5 screens). The backend exposes the **contract** it consumes (§4). FE↔backend integration = contract-conformance only.

### 3.4 Ticketing & SLA module (in-project, co-deployed — built here per v1.3)
- **Now:** a real bounded-context module (`src/modules/ticketing`) co-deployed in the OmniCare backend — `Ticket` aggregate + dual-clock SLA engine + breach worker (`SlaWarning`/`SlaBreached`) + escalation + CSAT reopen + parent-incident grouping (FR61). Own PostgreSQL schema (`tickets`), reached in-process via command bus / `IEventBus`.
- **The wave-1 in-memory stub** (`src/modules/ticketing-stub`) is retained only as a local-dev/demo fallback toggle; it is superseded by the real module in the default config.
- **Extraction path:** because the contract (commands/events) and the `IEventBus` port are preserved, Ticketing can be split into its own deployable later behind the same contract if scale demands — no omnichannel-side rewrite.

---

## 4. Backend Surface for the Delivered FE (contract-conformance — ADR-7)
*The 5 delivered screens define the backend surface they already call. The backend conforms to these — REST endpoints (BFF) + WebSocket channels (Omnichannel realtime gateway).*

| Delivered screen | BFF REST (HTTPS) | Realtime (socket.io, Omnichannel gw) |
|---|---|---|
| **Inbox hợp nhất** | `GET /bff/inbox` · `GET /bff/conversations/:id` (thread + Customer 360 + ticket/SLA chip) | `interaction.received` · `message.sent` · `sla.chip` |
| **Tổng đài 1900** (softphone) | `GET /bff/softphone/active` · `GET /bff/customers/by-phone/:n` (screen-pop) | `call.ring` · `call.answer` · `call.hangup` |
| **Sự cố hiện trường** | `GET /bff/incidents` · `GET /bff/incidents/:id` (AI tag via port + GIS pin) | `incident.classified` · `incident.dispatched` |
| **Ticket & SLA Kanban** | `GET /bff/tickets/kanban` (via Ticketing module) · `POST /bff/tickets/:id/reassign` | `ticket.moved` · `sla.warning` (from Ticketing) · `sla.tick` |
| **Điều hành CSKH** (dashboard) | `GET /bff/operations/kpis` (BFF-joined: omnichannel + Ticketing SLA + CSAT) | `kpi.tick` |
| **Bootstrap (all screens)** | `GET /bff/bootstrap` (session + inbox p1 + counters) ≤ 1s (NFR3) | — |

*Secondary:* KB query `GET /bff/kb/search?q=`, Broadcast `GET/POST /bff/broadcast`, CSAT `POST /bff/csat`.

> **Field-level mapping** between these endpoints and the delivered FE's actual calls is tracked in a separate **FE integration contract** (not duplicated here) — ADR-7.

---

## 5. Omnichannel ↔ Ticketing Module Contract *(keystone — in-process)*

> v0.4: this is now an **in-module** contract, not an inter-service one. Both sides live in the same process and talk over the command bus / `IEventBus` port. The shapes are unchanged from v0.3 so that a future split (ADR-1 extraction path) is a config/port swap.

| Direction | Channel | Payloads |
|---|---|---|
| **OMNI → TKT (commands)** | in-process command bus / `IEventBus` | `TicketCreateRequested` · `TicketStateChanged` · `TicketReassignRequested` |
| **TKT → OMNI (events)** | in-process `IEventBus` | `SlaWarning` · `SlaBreached` · `TicketClosed` · `TicketStateChanged` |
| **OMNI ↔ TKT (sync reads)** | in-process call (BFF → Ticketing module) | ticket state + SLA countdown (for SPA rendering) |

- **Idempotency:** every command carries an idempotency key; the Ticketing module dedups.
- **Transactional outbox:** module-spanning writes are persisted + replayed on crash; never block ingestion (NFR9). (A DLQ is added only if/when a real broker is introduced.)
- **Versioning:** events schema-versioned; contract tests at the module boundary (NFR21).
- **Shared contract types** live in `src/modules/messaging/domain/contracts/ticketing-contract.ts` (to be promoted to `src/contracts/` if/when split).

---

## 6. Data Architecture (Omnichannel-owned)

| Store | Engine | Tables / Use |
|---|---|---|
| **Primary (write/read)** | PostgreSQL + Drizzle (shared instance) | Omnichannel schema: `conversations`, `messages`, `interactions_timeline`, `incidents_intake`, `broadcast_campaigns`, `csat_surveys`, `kb_articles`, `outbox`. Ticketing schema: `tickets` (+ `sla_policies`/`parent_incidents` as the module grows). |
| **Cache / idempotency / session** | Redis | idempotency keys, Customer-360 profile cache, agent presence/session, WS backfill cursors |
| **Search** | ElasticSearch | KB article search (Vietnamese diacritics/synonyms), message history search |
| **Outbox** | PostgreSQL (same tx) | transactional outbox → in-process publisher (no lost events on crash) |

> **Each module owns its own schema** within the shared PostgreSQL instance (ADR-1 modular-monolith): Ticketing owns `tickets` etc., Omnichannel owns its tables. No shared tables across modules; cross-module data is joined only at the BFF read layer. (If Ticketing is later extracted, its schema moves with it.)

---

## 7. Realtime Architecture (ADR-8 + ADR-9)
- **socket.io gateway in the OmniCare backend** (PRD v1.3 §8). It owns push, screen-pop, and `SlaWarning`/ticket-state relay.
- **Spine = in-process `IEventBus`.** Domain events (`MessageReceived`, `SlaWarning`, `IncidentClassified`, …) flow on the in-process bus → the gateway subscribes → emits to **agent rooms** (by `agentId`/`supervisorId`). (The port allows a real broker to become the spine later without gateway changes.)
- **Ticketing's** `SlaWarning` takes the same path (TKT module → `IEventBus` → Omnichannel gateway → SPA). NFR10b: render ≤ 2s p95 from event receipt.
- **Reconnect + backfill (ADR-9):** on socket reconnect the client requests missed events by last-seen id; the gateway replays from the event log (idempotent) — no message loss across drops.
- **Optimistic UI** on ticket-create is a delivered-FE concern; the backend just emits `TicketStateChanged` promptly.

---

## 8. Security & Compliance (maps to NFR14–19, Domain §)
- **AuthN/Z:** agent session (JWT), **RBAC** agent/supervisor/admin enforced **server-side** at the BFF/domain boundary (ADR-10, FR55).
- **Encryption:** TLS 1.2+ in transit, at-rest encryption (NFR14).
- **Data residency:** on-prem / Vietnam cloud — PII + consumption stay in-country (NFR16).
- **Audit:** immutable audit trail, 100% data-access logged (NFR15); **system/audit logs 12 months** (NFR18).
- **Rate limiting / DDoS:** API gateway, 50 req/s per IP/Channel ID, auto-lock (NFR5).
- **Consent:** IVR announcement before recording (NFR17/FR59); recordings 90-day retention.
- **Privacy ops:** DSAR (access/erasure) within 72h (NFR19).
- **Accessibility (backend obligation, NFR20):** backend serves KB/self-tracking content in **structured, semantic form** (headings, labels, alt-text fields, language tags); UI-level WCAG 2.1 AA is the delivered FE's responsibility.

---

## 9. Observability (existing stack — reused)
- **Tracing:** OpenTelemetry → Jaeger; **trace_id propagated through the broker** (event metadata) so an interaction traces end-to-end across Omnichannel ↔ Ticketing (NFR13, FR57).
- **Metrics:** Prometheus; **Logs:** Loki (structured, pino); **Dashboards/Alerts:** Grafana.
- SLOs: push latency p95, webhook ack < 200ms, SLA-warning render, broker DLQ depth, BFF bootstrap ≤ 1s.

---

## 10. Deployment & Sequencing (single backend deployable)
- **K8s** (existing base + overlays): **one Deployment** for the OmniCare backend (Omnichannel + Ticketing modules + BFF in one process). **HPA** on it for meter-reading / outage peaks (NFR6). The delivered FE is deployed/hosted separately (out of this scope). (Ticketing can be split into its own Deployment later via the ADR-1 extraction path.)
- **Local dev:** `docker-compose` (PostgreSQL + Redis + ElasticSearch). No broker required for the default config (in-process bus); RabbitMQ is added only to exercise the broker-backed `IEventBus` implementation.
- **Waves (revised v1.3):** wave 1 = Omnichannel module + BFF + the real **Ticketing module** (replaces the stub) — J1/J2/J3 demo into the delivered FE; wave 2 = real adapters (Customer 360, VoIP, AI) + KB CMS + full CSAT/NPS + parent-incident depth (FR61). (The old "wave-2 Ticketing service cutover" is gone — Ticketing is built in-project from wave 1.)

---

## 11. Technology Selection (boring-tech-first)

| Concern | Choice | Why |
|---|---|---|
| Backend framework | **NestJS 11 (Fastify) + Bun** | matches existing repo; Fastify perf; CQRS/DDD via `@core` |
| ORM | **Drizzle** | matches existing repo; schema-first; type-safe |
| Event bus | **In-process `IEventBus`** (RabbitMQ/Kafka pluggable behind the port) | zero broker dependency today; low opex; port preserves the future option (ADR-4) |
| Cache/idempotency | **Redis** | matches existing; sub-ms idempotency; WS backfill cursors |
| Search | **ElasticSearch** | Vietnamese NLP search (diacritics/synonyms) |
| Realtime | **socket.io** (in OmniCare backend) | rooms, reconnect, backfill (ADR-8/9) |
| Observability | **OTel + Jaeger + Prometheus + Loki + Grafana** | already in-repo |
| Orchestration | **Kubernetes + HPA** | already in-repo |
| Frontend | *(delivered — React 18 + Vite + Ant Design Pro)* | out of build scope; only its contract matters |

---

## 12. Open Architectural Items
- ✅ **PRD in workspace** — resolved; `_bmad-output/planning-artifacts/prd.md` is now the v1.3 (Vietnamese) source of truth.
- ✅ **Ticketing architecture** — resolved by v1.3; Ticketing & SLA is an in-project module governed by this doc (§3.4, §5) + PRD §9.3. No sibling architecture/PRD is needed.
- **WS routing** — confirm the SPA's socket.io connects via the API gateway to the OmniCare realtime gateway (current design), **or** whether the BFF should proxy the WS upgrade to keep "single entry point" literal.
- **Hotline number** canonical (`1900 1090` vs `1900.545.520`) — IVR/screen-pop config.
- **Broker-less → broker swap trigger** — the throughput/ops threshold at which a real broker (or a Ticketing split) is justified (ADR-1/ADR-4).
- **Search index ownership** — confirm ElasticSearch is omnichannel-owned vs. a shared cluster.

---

*Authored 2026-07-01 (v0.4) by Winston, aligned to PRD v1.3. Governs the OmniCare **backend** build — a single deployable (Omnichannel + in-project Ticketing module + BFF); frontend is delivered and out of scope.*
