---
title: "OmniCare — Master Execution Plan (Omnichannel-first)"
document_type: "Unified Execution Roadmap"
version: "3.1 — Backend-only waves (aligned to PRD v1.2)"
status: "Source of Truth for sequencing"
date: "2026-06-22"
author: "Pc"
supersedes: "v2.0 (microservices-day-1 phasing) → re-cut to omnichannel-first waves per PRD v1.1 scope"
related:
  - "prd.md (v1.1)"
  - "product-brief-omnicare-2026-06-20.md"
  - "backend-build-plan-omnicare-2026-06-20.md"
  - "chapter5-omnichannel-spec.md"
revision: "2026-06-22 v3.1 — PRD v1.2 drops frontend from build scope (the agent-workspace SPA is already delivered). This plan now sequences the BACKEND only: Omnichannel service + BFF FIRST (wave 1, with a Ticketing stub, integrating into the delivered FE), the real Ticketing & SLA service SECOND (wave 2, separate PRD), and measurement/knowledge/real-adapters THIRD (wave 3)."
---

# OmniCare — Master Execution Plan (Omnichannel-first)

> Governs build sequencing for the **OmniCare Omnichannel PRD (v1.1)** scope: the **Omnichannel service + BFF + unified frontend**. The backend plan's module catalog, ports, and data model remain the authoritative component reference.

---

## 0. Locked Technical Decisions

1. **Scope of this plan = BACKEND ONLY: Omnichannel service + BFF** (per PRD v1.2). The agent-workspace **frontend is already delivered** (5 screens) and is out of build scope — the backend exposes the contracts it consumes. **Ticketing & SLA is a separate microservice with its own PRD** — consumed via broker + contract, **stubbed in wave 1** so the backend demo is conclusive on its own.
2. **Contract-First:** the **Omnichannel ↔ Ticketing contract** (events + BFF reads/writes) is defined in wave 1 and honored throughout — wave 2's real Ticketing service implements the same contract the wave-1 stub exposed. Zero omnichannel rewrite on cutover.
3. **Distributed microservices** — Omnichannel service and Ticketing & SLA service are separate deployables (own DBs); they communicate **only asynchronously via the message broker** (no direct service-to-service calls).
4. **Message Broker = RabbitMQ** (Topic Exchanges) behind the `@core` `IEventBus` port. Kafka reserved as a scale-out option.
5. **Network-boundary hardening:** `TicketCreateRequested` / `TicketStateChanged` + **idempotency** + **Dead-Letter Queue** at the Omnichannel → Ticketing edge. *No interaction lost if Ticketing is down — requests queue and replay.*
6. **BFF = single entry point for the SPA.** No frontend call ever reaches a backend service directly; the BFF aggregates (sync read-join: omnichannel thread + Customer 360 + ticket/SLA state) and relays realtime (`SlaWarning` → SPA).
7. **AI fully external** (mock adapters MVP → real API later). Core is 100% routing & communication.

---

## 1. Scope Alignment (PRD v1.1)

| Built in THIS plan (Omnichannel + BFF + FE) | Separate (own PRD) — consumed |
|---|---|
| Multi-channel ingestion, normalization, idempotency, 200-OK | **Ticketing & SLA service** (ticket lifecycle, SLA engine, breach worker, escalation, auto-reopen, Parent-Incident grouping FR61) |
| Unified inbox, conversation thread, realtime push | Customer 360 / Identity (mock → real wave 3) |
| Telephony events / softphone screen-pop | AI vision/NLP/speech/chatbot (external) |
| Field-incident intake + AI-tag display + GIS pin + FSM dispatch trigger | Field-team App (Work Orders) |
| KB FAQ CMS + Vietnamese search · Broadcast · CSAT/NPS/CES capture | |
| BFF (aggregation + realtime relay) | |
| Unified React SPA (App Shell + 5 screens) | |

**Wave-1 Ticketing stub:** a contract-conformant stub that accepts `TicketCreateRequested` / `TicketStateChanged` and emits `SlaWarning` / `TicketClosed` — so **J1 (Zalo), J2 (VoIP), J3 (SLA firefighting) all demo end-to-end** before the real service exists.

---

## 2. Stack

| Layer | Choice |
|---|---|
| **Frontend** | React 18 + Vite + **Ant Design Pro** + Tailwind + TanStack Query + socket.io-client |
| **Omnichannel service** | NestJS 11 (Fastify) + Bun + Redis (idempotency/sessions) + `@nestjs/websockets`/socket.io (realtime gateway) + Drizzle ORM (omnichannel-owned tables) |
| **BFF** | NestJS 11 (Fastify) — dedicated aggregation deployable; fronts Omnichannel + Ticketing + Customer 360; socket.io relay to SPA |
| **Broker** | **RabbitMQ** (Topic Exchanges) behind `@core` `IEventBus` |
| **Ticketing & SLA (wave 2, separate PRD)** | NestJS + own PostgreSQL + background SLA worker |
| **Observability** | OpenTelemetry + Jaeger + Prometheus + Loki + Grafana *(existing in-repo)* |
| **Orchestration** | Kubernetes + HPA *(existing in-repo)* |

---

## 3. Phased Roadmap (Omnichannel-first waves)

### Wave 1 — Omnichannel Core + BFF + Frontend *(demo J1, J2, J3)*
- **Omnichannel service:** webhook ingress (Zalo/App/FB/email/VoIP) with **HTTP 200 OK immediately**; normalization (`OmniMessage`); idempotency (Redis); realtime gateway (socket.io); conversation/thread store; telephony screen-pop events; field-incident intake; KB search; broadcast; CSAT capture.
- **BFF:** single SPA gateway; sync aggregation (conversation = omnichannel thread + Customer 360 mock + ticket/SLA state); fan-out writes; socket.io relay (`SlaWarning` → SPA).
- **Frontend (already delivered — out of build scope):** the backend exposes the BFF REST endpoints + the Omnichannel-service socket.io gateway that the existing 5-screen SPA consumes (contract-conformance; see ADR-7 in architecture.md).
- **Mock adapters:** Identity resolution, Customer 360, AI insight display, static Audio AI.
- **Ticketing & SLA stub** (contract-conformant): accepts `TicketCreateRequested`/`TicketStateChanged`, emits `SlaWarning`/`TicketClosed`.
- **🔒 Lock-in:** Omnichannel ↔ Ticketing **contract defined here** (events + BFF endpoints); idempotency + DLQ at the edge.
- **Exit:** J1, J2, J3 demo-able end-to-end against mocks + stub; 5 screens live.

### Wave 2 — Real Ticketing & SLA Service *(separate PRD; replace stub)*
- New NestJS microservice, **own PostgreSQL** (tickets, workflows, sla_policies, parent-incidents).
- **SLA background worker** → emits `SlaWarning`/`SlaBreached`; escalation; auto-reopen on low CSAT (`CsatSubmitted`).
- **Parent-Incident grouping** (FR61) — attach/detach/split child tickets under a parent.
- **Implements the wave-1 contract** — omnichannel side unchanged; cutover = swap stub → real service behind the same contract.
- **Exit:** real ticket lifecycle + SLA breach worker live; Kanban SLA timers + red-flash fed by the real service.

### Wave 3 — Measurement, Knowledge & Real Adapters
- Real adapters replacing mocks: **IAM, Customer 360, VoIP telephony, AI vision/NLP/speech**.
- **KB CMS depth** (author→edit→approve→publish + versioning) + Vietnamese smart search.
- **Full CSAT/NPS/CES** + closing-the-loop (auto-reopen wired to real Ticketing); **customer self-tracking (J6)**; **deflection measurement (J4)**; **Parent-Incident clustering** (real geo-detection FR49).
- **Exit:** closed CX loop + KB + real integrations; deflection ≥30% measurable.

---

## 4. Contracts *(defined wave 1, honored throughout)*
- **Omnichannel ↔ Ticketing contract (keystone):**
  - *Omnichannel → Ticketing (commands):* `TicketCreateRequested`, `TicketStateChanged`, `TicketReassignRequested`.
  - *Ticketing → Omnichannel (events):* `SlaWarning`, `SlaBreached`, `TicketClosed`, `TicketStateChanged`.
  - *BFF reads:* ticket state + SLA countdown (sync, for SPA rendering).
- **Port interfaces (mock adapters):** Identity, Customer 360, AI Vision, Audio AI, NLP, Chatbot, VoIP, FSM/GIS.
- **Data model (omnichannel-owned):** `conversations`, `messages`, `interactions_timeline`, `incidents_intake`, `broadcast_campaigns`, `csat_surveys`, `kb_articles`, `outbox`, `idempotency_keys`.

---

## 5. Open Items / Decisions
- **Hotline number:** dashboard UI `1900 1090` vs Chapter 5 §5.1 `1900.545.520` — confirm canonical.
- **Kafka swap trigger:** throughput threshold to migrate off RabbitMQ.
- **Ticketing & SLA PRD:** create the separate PRD for the wave-2 service (lifecycle, SLA policies, breach worker, FR61 Parent-Incident).
- **5-screen canonical list:** confirm the exact 5 delivered screens ( Inbox hợp nhất / Tổng đài 1900 / Sự cố hiện trường / Ticket & SLA Kanban / Điều hành CSKH ) vs KB/Broadcast/CSAT placement.

---

*Authored 2026-06-22 (v3.0). Governs build sequencing for the OmniCare Omnichannel scope (PRD v1.1).*
