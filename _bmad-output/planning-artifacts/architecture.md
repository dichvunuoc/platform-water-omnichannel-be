---
title: "OmniCare — Architecture Decision Document"
project_name: "nestjs-project-example"
product_name: "OmniCare"
document_type: "Architecture Decision Document"
workflowType: "architecture"
version: "0.3 — Backend-only (aligned to PRD v1.2)"
status: "Draft — backend architecture (Omnichannel service + BFF)"
date: "2026-06-22"
author: "Pc"
architect: "Winston"
communication_language: "English"
document_output_language: "English"

# Workflow state
workflow: "create-architecture (compressed — derived directly from a finalized PRD)"
stepsCompleted: [1]
currentStep: "derived (see note)"
outputFile: "_bmad-output/planning-artifacts/architecture.md"
prd_source: "c:/Download/prd (1).md (v1.2) — authoritative; copy into workspace before build"

# Input documents
inputDocuments:
  prd: "prd.md (v1.2) — BACKEND-ONLY capability contract (61 FRs · 24 NFRs)"
  product_brief: "product-brief-omnicare-2026-06-20.md"
  execution_plan: "execution-plan-omnicare.md (v3.0 — omnichannel-first waves)"
  backend_build_plan: "backend-build-plan-omnicare-2026-06-20.md (module catalog/ports/data)"
  business_spec: "chapter5-omnichannel-spec.md (§5.1–5.4)"
  ux: "6 UI mockups (delivered frontend reference) — Inbox hợp nhất · Tổng đài 1900 · Sự cố hiện trường · Ticket & SLA Kanban · Điều hành CSKH dashboard · Proactive Broadcast"

# Inherited locked decisions (from PRD v1.2 + execution plan v3.0 — not re-litigated)
inherited_decisions:
  scope: "BACKEND ONLY: Omnichannel service + BFF. Frontend SPA is already delivered — consumed client, NOT built here. Ticketing & SLA = separate microservice/PRD, consumed via contract."
  deployment: "Distributed microservices (Omnichannel service + Ticketing & SLA), own DBs, async via broker."
  broker: "RabbitMQ (Topic Exchanges) behind @core IEventBus; Kafka reserved for scale-out."
  bff: "Single HTTP entry point for the SPA — sync aggregation; no FE→domain-service HTTP call."
  realtime_gateway: "socket.io gateway lives in the Omnichannel service (PRD v1.2 §8); broker is the spine; reconnect + idempotent backfill."
  contract_first: "Omnichannel ↔ Ticketing contract defined in wave 1; idempotency + DLQ at the edge."
  fe_conformance: "Backend conforms to the APIs/events the delivered FE already calls — not the reverse."
  ai: "Fully external (mock adapters MVP → real API later); core is 100% routing & communication."
  stack: "NestJS 11 (Fastify) + Bun + Drizzle + PostgreSQL + Redis + CQRS/DDD (@core IEventBus/IOutbox); OTel/Jaeger/Prometheus/Loki/Grafana + K8s (existing in-repo)."

note: "Architecture derived directly from PRD v1.2 (BMAD step-by-step elicitation compressed — core decisions locked, PRD is a complete capability contract). v0.3 re-cuts to BACKEND-ONLY per PRD v1.2 (frontend already delivered, out of scope). Each ADR states decision + rationale + rejected alternative."
---

# Architecture Decision Document — OmniCare (Backend scope, v0.3)

> **Scope:** **backend only** — the **Omnichannel service + BFF** (per [PRD v1.2](./prd.md)). The agent-workspace **frontend is already delivered** and is a *consumed client*, not built here. The **Ticketing & SLA microservice** is a consumed sibling (own architecture/PRD). This document defines the **server-side surface** (APIs, broker events, WebSocket gateway) + the **Omnichannel ↔ Ticketing contract**.
>
> **Architect's stance (Winston):** boring, proven tech where stability matters (RabbitMQ, PostgreSQL, Redis, the existing `@core` ports); the backend **conforms to the delivered frontend's contracts**; every choice tied to business value.

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
                   ┌──────────────────┐   ┌──────────────────────────┐
                   │       BFF         │   │  OMNICHANNEL SERVICE       │
                   │ (NestJS gateway)  │   │  (NestJS + Fastify)        │
                   │ • HTTP aggregation│   │  • ingress/normalize/200OK │
                   │ • write fan-out   │◀──│  • idempotency (Redis)     │
                   │ • auth/RBAC       │   │  • conversation/incident/  │
                   │ • bootstrap ≤1s   │   │    KB/broadcast/CSAT       │
                   └─────────┬──────────┘   │  • socket.io realtime gw  │
                             │              │  • outage clustering       │
                             │ sync reads   └─────────────┬─────────────┘
                             ▼                            │ events
                   ┌──────────────────┐                   ▼
                   │ TICKETING & SLA   │◀─────┌──────────────────┐
                   │ service (sibling) │      │  MESSAGE BROKER   │
                   │ • stub wave 1     │      │  RabbitMQ          │
                   │ • real svc wave 2 │      │  (@core IEventBus) │
                   │ • own PostgreSQL  │      └─────────────────────┘
                   └──────────────────┘
                                     ▲
                                     │ HTTPS (the delivered SPA)
              ┌──────────────────────┴────────────────┐
              │  FRONTEND SPA — ALREADY DELIVERED ⛔    │  (5 screens; consumed client)
              │  Inbox · Tổng đài · Sự cố · Kanban · Dashboard
              └────────────────────────────────────────┘
   Sibling ports (mock → real): Customer 360 · Identity/IAM · AI (vision/NLP/speech) · FSM/GIS · Field-team App
```

> The delivered SPA talks to **two backend surfaces**: the **BFF** (HTTPS — aggregation, writes, auth) and the **Omnichannel realtime gateway** (WebSocket — push). Both sit behind the same API gateway (auth, rate-limit).

---

## 2. Architectural Decisions (ADRs)

| # | Decision | Rationale | Rejected alternative |
|---|---|---|---|
| **ADR-1** | **Distributed microservices** — Omnichannel service + Ticketing & SLA as separate deployables (own DBs) | Clean bounded contexts; independent scaling; Conway seam | Modular monolith → extract (rejected: ship final shape from day 1) |
| **ADR-2** | **Async-only between services via RabbitMQ** | Ingress resilience (200 OK, FR2/NFR4); decouples omnichannel from Ticketing downtime (NFR9) | Sync service-to-service (couples uptime; blocks ingestion) |
| **ADR-3** | **BFF = single HTTP entry point for the SPA** | One HTTP contract for FE; aggregates conversation = omnichannel thread + Customer 360 + ticket/SLA state; shields FE from topology | FE calls domain services directly over HTTP (chatty, leaks topology) |
| **ADR-4** | **RabbitMQ behind `@core` `IEventBus`** (Topic Exchanges) | Boring, proven, low-opex pub/sub; port allows Kafka swap later | Kafka day-1 (heavier ops; throughput not yet needed) |
| **ADR-5** | **AI fully external** (mock adapters → real API) | Core stays pure routing/comms; no heavy-model ops risk; pluggable | Building AI in-house (out of scope, `ai_strategy`) |
| **ADR-6** | **Transactional Outbox + idempotency + DLQ** at the Omnichannel→Ticketing edge | No message lost on downstream failure (FR7/NFR9); dedup on retries (FR3); poisoned messages quarantined | Direct publish-and-pray (message loss on crash) |
| **ADR-7** | **Backend conforms to the delivered FE's contracts** | FE already shipped (5 screens); backend matches the API shapes/screens it calls — conformance, not greenfield API design | Service-first API design that the FE must be rewritten to call |
| **ADR-8** | **socket.io realtime gateway in the Omnichannel service** (PRD v1.2 §8) | Gateway owns the realtime domain (push, screen-pop, `SlaWarning` relay); broker is the spine feeding it | Realtime in the BFF (BFF stays HTTP-only; cleaner separation) |
| **ADR-9** | **Reconnect + idempotent backfill** on the WS gateway | No message loss across reconnects; client requests missed events by last-seen id | Fire-and-forget push (lost events on flaky connections) |
| **ADR-10** | **AuthN via IAM (JWT), AuthZ at BFF edge** — BFF validates token + extracts role from JWT claims + enforces RBAC before forwarding | IAM (team-owned) embeds roles in claims; BFF = security checkpoint; no user-role mapping in OmniCare (FR55 simplified) | Trusting client-side checks / managing role-mapping locally |

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
- **realtime-gateway** — socket.io server; subscribes to broker events → pushes to agent rooms; reconnect/backfill.
- **publisher** — publishes domain events to the broker (via `IEventBus`); outbox processor.

### 3.2 BFF (built — NestJS gateway)
- **aggregation** — sync read-joins per screen (conversation + Customer 360 + ticket/SLA state).
- **bootstrap** — single call returning session + inbox first page + counters ≤ 1s (NFR3) for fast FE interactivity.
- **write-fanout** — SPA writes proxied to the right service (ticket-create → broker command; reassign → Ticketing).
- **auth/rbac** — agent session, server-side role enforcement (FR55, ADR-10), rate limiting (NFR5).
- **ticketing-contract-client** — the Omnichannel↔Ticketing adapter (commands out, events in, sync reads).

### 3.3 Frontend SPA — ⛔ NOT built (delivered)
Already shipped (5 screens). The backend exposes the **contract** it consumes (§4). FE↔backend integration = contract-conformance only.

### 3.4 Ticketing & SLA service (sibling — NOT built here)
- **Wave 1:** contract-conformant **stub** (accepts commands, emits `SlaWarning`/`TicketClosed`).
- **Wave 2:** real service (own PostgreSQL, SLA breach worker, escalation, auto-reopen, Parent-Incident grouping FR61). Cutover = swap behind the same contract.

---

## 4. Backend Surface for the Delivered FE (contract-conformance — ADR-7)
*The 5 delivered screens define the backend surface they already call. The backend conforms to these — REST endpoints (BFF) + WebSocket channels (Omnichannel realtime gateway).*

| Delivered screen | BFF REST (HTTPS) | Realtime (socket.io, Omnichannel gw) |
|---|---|---|
| **Inbox hợp nhất** | `GET /bff/inbox` · `GET /bff/conversations/:id` (thread + Customer 360 + ticket/SLA chip) | `interaction.received` · `message.sent` · `sla.chip` |
| **Tổng đài 1900** (softphone) | `GET /bff/softphone/active` · `GET /bff/customers/by-phone/:n` (screen-pop) | `call.ring` · `call.answer` · `call.hangup` |
| **Sự cố hiện trường** | `GET /bff/incidents` · `GET /bff/incidents/:id` (AI tag via port + GIS pin) | `incident.classified` · `incident.dispatched` |
| **Ticket & SLA Kanban** | `GET /bff/tickets/kanban` (via Ticketing service) · `POST /bff/tickets/:id/reassign` | `ticket.moved` · `sla.warning` (from Ticketing) · `sla.tick` |
| **Điều hành CSKH** (dashboard) | `GET /bff/operations/kpis` (BFF-joined: omnichannel + Ticketing SLA + CSAT) | `kpi.tick` |
| **Bootstrap (all screens)** | `GET /bff/bootstrap` (session + inbox p1 + counters) ≤ 1s (NFR3) | — |

*Secondary:* KB query `GET /bff/kb/search?q=`, Broadcast `GET/POST /bff/broadcast`, CSAT `POST /bff/csat`.

> **Field-level mapping** between these endpoints and the delivered FE's actual calls is tracked in a separate **FE integration contract** (not duplicated here) — ADR-7.

---

## 5. Omnichannel ↔ Ticketing Contract *(keystone — defined wave 1)*

| Direction | Channel | Payloads |
|---|---|---|
| **OMNI → TKT (commands)** | broker | `TicketCreateRequested` · `TicketStateChanged` · `TicketReassignRequested` |
| **TKT → OMNI (events)** | broker | `SlaWarning` · `SlaBreached` · `TicketClosed` · `TicketStateChanged` |
| **OMNI ↔ TKT (sync reads)** | BFF→TKT HTTP | ticket state + SLA countdown (for SPA rendering) |

- **Idempotency:** every command carries an idempotency key; Ticketing dedups.
- **DLQ:** poisoned/unprocessable commands quarantined; never block ingestion (NFR9).
- **Versioning:** events schema-versioned; consumer-driven contract tests on **both** sides (NFR21).
- **Wave-1 stub** implements the consumer side identically → cutover is a config swap.

---

## 6. Data Architecture (Omnichannel-owned)

| Store | Engine | Tables / Use |
|---|---|---|
| **Primary (write/read)** | PostgreSQL + Drizzle | `conversations`, `messages`, `interactions_timeline`, `incidents_intake`, `broadcast_campaigns`, `csat_surveys`, `kb_articles`, `outbox` |
| **Cache / idempotency / session** | Redis | idempotency keys, Customer-360 profile cache, agent presence/session, WS backfill cursors |
| **Search** | ElasticSearch | KB article search (Vietnamese diacritics/synonyms), message history search |
| **Outbox** | PostgreSQL (same tx) | transactional outbox → broker publisher (no lost events on crash) |

> **Ticketing service owns its own DB** (`tickets`, `workflows`, `sla_policies`, `parent_incidents`) — no shared schema (ADR-1). Cross-service data is joined only at the BFF read layer.

---

## 7. Realtime Architecture (ADR-8 + ADR-9)
- **socket.io gateway in the Omnichannel service** (PRD v1.2 §8). It owns push, screen-pop, and `SlaWarning`/ticket-state relay.
- **Spine = broker.** Domain events (`MessageReceived`, `SlaWarning`, `IncidentClassified`, …) flow on RabbitMQ → the gateway subscribes → emits to **agent rooms** (by `agentId`/`supervisorId`).
- **Ticketing's** `SlaWarning` takes the same path (TKT → broker → Omnichannel gateway → SPA). NFR10b: render ≤ 2s p95 from broker receipt.
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

## 10. Deployment & Sequencing (backend deployables; aligned to execution-plan v3.0)
- **K8s** (existing base + overlays): separate Deployments for **Omnichannel service** and **BFF** (wave 1), and **Ticketing service** (wave 2). **HPA** on Omnichannel + BFF for meter-reading / outage peaks (NFR6). The delivered FE is deployed/hosted separately (out of this scope).
- **Local dev:** `docker-compose` (PostgreSQL + Redis + RabbitMQ + ElasticSearch).
- **Waves:** wave 1 = Omnichannel service + BFF + Ticketing **stub** (J1/J2/J3 demo into the delivered FE); wave 2 = real Ticketing service (cutover behind contract); wave 3 = real adapters + KB CMS + full CSAT.

---

## 11. Technology Selection (boring-tech-first)

| Concern | Choice | Why |
|---|---|---|
| Backend framework | **NestJS 11 (Fastify) + Bun** | matches existing repo; Fastify perf; CQRS/DDD via `@core` |
| ORM | **Drizzle** | matches existing repo; schema-first; type-safe |
| Broker | **RabbitMQ** | boring, proven pub/sub; low opex (ADR-4) |
| Cache/idempotency | **Redis** | matches existing; sub-ms idempotency; WS backfill cursors |
| Search | **ElasticSearch** | Vietnamese NLP search (diacritics/synonyms) |
| Realtime | **socket.io** (in Omnichannel service) | rooms, reconnect, backfill (ADR-8/9) |
| Observability | **OTel + Jaeger + Prometheus + Loki + Grafana** | already in-repo |
| Orchestration | **Kubernetes + HPA** | already in-repo |
| Frontend | *(delivered — React 18 + Vite + Ant Design Pro)* | out of build scope; only its contract matters |

---

## 12. Open Architectural Items
- **Copy PRD v1.2 into the workspace** — the authoritative PRD is at `c:/Download/prd (1).md`; replace `_bmad-output/planning-artifacts/prd.md` with it so the repo holds the v1.2 source of truth.
- **WS routing** — confirm the SPA's socket.io connects via the API gateway to the Omnichannel gateway (current design), **or** whether the BFF should proxy the WS upgrade to keep "single entry point" literal.
- **Hotline number** canonical (`1900 1090` vs `1900.545.520`) — IVR/screen-pop config.
- **Kafka swap trigger** — throughput threshold (ADR-4).
- **Ticketing & SLA architecture/PRD** — produce the sibling service's own architecture (lifecycle, SLA policies, breach worker, FR61).
- **Search index ownership** — confirm ElasticSearch is omnichannel-owned vs. a shared cluster.

---

*Authored 2026-06-22 (v0.3) by Winston, derived from PRD v1.2 + execution-plan v3.0. Governs the OmniCare **backend** build (Omnichannel service + BFF); frontend is delivered and out of scope.*
