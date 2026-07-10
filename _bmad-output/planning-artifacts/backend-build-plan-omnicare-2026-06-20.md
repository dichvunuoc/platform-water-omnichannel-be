---
title: "OmniCare — Backend Build Plan"
document_type: "Backend Architecture & Build Plan"
version: "0.2 — Revised: Distributed Microservices (Day 1)"
arch_note: "Architecture reversed 2026-06-20 to distributed microservices from Day 1 per leadership direction. Authoritative sequencing now in execution-plan-omnicare.md (v2.0); this doc's module catalog, ports, and data model remain valid."
status: "Approved approach"
date: "2026-06-20"
author: "Pc"
related: "product-brief-omnicare-2026-06-20.md"

stack:
  runtime: "Bun 1.1"
  framework: "NestJS 11 (Fastify)"
  orm: "Drizzle ORM + PostgreSQL (pg)"
  cache: "Redis 5"
  architecture: "DDD + CQRS (@nestjs/cqrs) + Hexagonal (Ports & Adapters)"
  validation: "Zod 4 + class-validator"
  logging: "nestjs-pino"
  observability: "OpenTelemetry + Jaeger + Prometheus + Loki + Grafana"
  orchestrator: "Kubernetes (HPA)"

locked_approach:
  deployment: "Distributed microservices from Day 1 — Omni-Messaging Core (µservice 1) + Ticketing & SLA Engine (µservice 2, own DB). No monolith phase; no later extraction. (Reversed from Option A per leadership direction 2026-06-20.)"
  realtime: "@nestjs/websockets + socket.io (Fastify-compatible) behind an IRealtimePush port — lives in µservice 1 (Messaging Core), the FE-facing BFF"
  event_bus: "RabbitMQ-backed IEventBus from Day 1 (Topic Exchanges, async pub/sub between the two services; Kafka reserved as scale-out)"
  ai: "100% external — mock adapters only; core is pure routing & communication"
---

# OmniCare — Backend Build Plan

> Companion to the [Product Brief](./product-brief-omnicare-2026-06-20.md). Implements **Part 1 (built core)** of the MVP. The **frontend (6 screens) follows this** — it consumes only the BFF.

---

## 0. Locked Approach (decisions)

| Decision | Choice | Rationale |
|---|---|---|
| Deployment path | **Modular monolith → extract** | Reuses existing single NestJS app; honors bounded contexts via ports; low MVP opex; `@core` `IEventBus` makes extraction a config swap |
| Realtime | **socket.io** behind `IRealtimePush` | Rooms/namespaces, auto-reconnect, Fastify-compatible — fits agent push + Optimistic-UI reconcile |
| Event bus | **In-process now → Kafka later** | `IEventBus` port abstracts it; no call-site rewrite on extraction |
| AI | **External (mock adapters)** | Locked `ai_strategy`: core is 100% routing |

---

## 1. Existing Foundation (reuse — do NOT rebuild)

| Asset | Location | What it gives us |
|---|---|---|
| `IEventBus`, `IOutboxRepository`, `ICacheService`, `IUnitOfWork` | `@core` (libs/core) | Event-driven backbone + Transactional Outbox already abstracted |
| CQRS buses (`ICommandBus`/`IQueryBus`) + Hexagonal ports | `@core` + product module | Canonical module pattern to mirror |
| Drizzle ORM + PostgreSQL | package.json, `drizzle/` | Schema-first migrations for new CSKH tables |
| OpenTelemetry + Jaeger + Prometheus + Loki + Grafana | `monitoring/`, deps | Observability layer ~80% done |
| Kubernetes + HPA + ingress + network-policy | `k8s/` (base + overlays) | Auto-scale for peak already scaffolded |
| Redis, Fastify, Bun, Zod, pino | package.json | High-perf runtime + structured logging |

---

## 2. Architecture (Modular Monolith, Phase 1)

```
                 ┌─────────────────────────────────────────────┐
  Webhooks ─────▶│  messaging  │  ticketing  │  incident  │ cx │
  (Zalo/FB/App)  │  broadcast  │  kb         │            │    │
                 └─────────────────────────────────────────────┘
                          │   ▲  (Domain Events)
                 InProcessEventBus  ◀── implements @core IEventBus
                 + Transactional Outbox (existing pattern)
                          │
                 ┌────────▼────────┐
                 │   bff (+ realtime gateway)  ──▶ FE (6 screens)
                 │   aggregation + socket.io push
                 └────────┬────────┘
                          │ reads via IQueryBus; calls ports
        ┌───────┬─────────┼──────────┬──────────┬─────────┐
        ▼       ▼         ▼          ▼          ▼         ▼
   AiVision  NLP  AudioAi/Customer360  IAM  VoIP  FsmGis   (MOCK adapters)
   └───────────────────── extraction arrow (later) ───────────────▶
                         KafkaEventBus + Ticketing as separate service
```

---

## 3. Module Catalog (mirror the `product` module: `domain/ application/ infrastructure/` + `*.module.ts`)

| Module | Bounded context / Aggregates | Key events | Screens served | Phase |
|---|---|---|---|---|
| `messaging` | Omni-Messaging Router — `Conversation`, `Message`; normalization, **idempotency** (Redis), inbound webhooks + outbound | `NewInteractionReceived`, `MessageNormalized`, `OutboundMessageSent` | **Inbox hợp nhất**, Softphone | 1 |
| `ticketing` | `Ticket` lifecycle (Mới→Đang xử lý→Chờ khách→Đã xử lý→Đóng); **SLA worker** | `TicketCreated/Moved/Closed`, `SlaWarning`, `SlaBreached` | **Ticket & SLA Kanban** | 2 |
| `bff` | Aggregation queries + **realtime gateway** (socket.io); Optimistic-UI reconcile | (consumes all; pushes to WS) | **ALL 6 screens** (FE's sole backend) | 3 |
| `broadcast` | `Campaign` (scheduled→sending→sent); batch queue | `BroadcastQueued/Sent/Opened` | **Thông báo chủ động** | 5 |
| `incident` | `Incident` (pending→classified→dispatched); AI Vision + GIS **display** | `IncidentReported/Classified/Dispatched` | **Sự cố hiện trường** | 5 |
| `cx` | `Survey`/`Metric`; CSAT/NPS; reacts to `TicketClosed` | `SurveyRequested`, `CsatSubmitted`, `LowCsatAlert` | **Operations Dashboard**, Survey | 5 |
| `kb` | `Article` (canned responses/FAQ); `/` search | — | canned responses | 5 |

---

## 4. Ports (Mock Adapters) — interfaces in `@core`/`application`, mock impls in `@shared`

| Port | Method | Mock returns | Real later |
|---|---|---|---|
| `IAiVisionPort` | `classify(imageUrl)` | `{tag, confidence, rationale}` | external vision µservice |
| `INlpPort` | `classifyIntent(text)` | `{intent, confidence}` | external NLP |
| `IAudioAiPort` | `transcribe(audioUrl)` | `{transcript}` | STT service |
| `IChatbotPort` | `handle(message)` | `{reply, escalate}` | conversational AI |
| `ICxPort` / `ISurveyPort` | `getStats()`, `sendSurvey()` | `{csat_score, csat_total}` | CX service |
| `IKbPort` | `search(query)` | canned responses | KB CMS + ElasticSearch |
| `IIamPort` | `decodeAgentToken()`, `resolveCustomerId(zaloId)` | `GlobalCustomerId` | existing IAM |
| `ICustomer360Port` | `getProfile(id)` | `{contracts, debt, consumption, type, address}` | existing Customer 360 |
| `IVoipPort` | webhook events | ring/answer/hangup | VoIP/1900 provider |
| `IFsmGisPort` | `dispatch()`, `getCoords()` | simulated coords | field-ops system |

---

## 5. Cross-Cutting Foundations to Add (`@core` / `@shared`)

- **`InProcessEventBus`** implementing `IEventBus` (NestJS event emitter backed) — → `KafkaEventBus` later.
- **`IRealtimePush` port** + `SocketIoRealtimeAdapter` (agent rooms by `agentId`, reconcile channel).
- **`IdempotencyService`** (Redis-backed key store) — critical for Ingress resilience (§5.2).
- **Outbox processor** wired to publish domain events to `IEventBus` (pattern already documented).
- **Drizzle schemas** (see §6).

---

## 6. Data Model (Drizzle schemas)

`conversations`, `messages`, `tickets`, `ticket_stage` (enum), `sla_policies`, `sla_timers`, `broadcast_campaigns`, `broadcast_recipients`, `incidents`, `incident_classifications`, `csat_surveys`, `kb_articles`, `agents`, `agent_sessions`, `outbox` (existing), `idempotency_keys`.

---

## 7. Event Catalog

`NewInteractionReceived` · `MessageNormalized` · `OutboundMessageSent` · `TicketCreated` · `TicketMoved` · `TicketAssigned` · `TicketClosed` · `SlaWarning` · `SlaBreached` · `IncidentReported` · `IncidentClassified` · `IncidentDispatched` · `SurveyRequested` · `CsatSubmitted` · `LowCsatAlert` · `BroadcastQueued` · `BroadcastSent` · `BroadcastOpened`.

---

## 8. BFF API Surface (serves the 6 screens — FE's only contract)

| Screen | BFF endpoints | WS events |
|---|---|---|
| **Inbox hợp nhất** | `GET /api/bff/inbox`, `GET /api/bff/conversations/:id` (+ Customer 360) | `interaction.received`, `message.sent` |
| **Tổng đài 1900** | `GET /api/bff/softphone/active` | `call.ring/answer/hangup` (VoIP mock) |
| **Điều hành CSKH** | `GET /api/bff/operations/{kpis,channels,topics,hours,sla-trend,csat}` | `kpi.tick` |
| **Ticket & SLA** | `GET /api/bff/tickets/kanban`, `GET /api/bff/tickets/:id` | `ticket.moved`, `sla.tick` |
| **Sự cố hiện trường** | `GET /api/bff/incidents`, `GET /api/bff/incidents/:id` (AI + GIS) | `incident.classified` |
| **Thông báo chủ động** | `GET /api/bff/broadcast/campaigns`, `POST /api/bff/broadcast` | `broadcast.progress` |

---

## 9. Phased Roadmap (MVP-first; unblock FE by end of Phase 3)

| Phase | Build | Exit criteria |
|---|---|---|
| **0 — Foundations** | `InProcessEventBus`, `IRealtimePush` + socket.io adapter, `IdempotencyService`, refresh `docker-compose` (PG+Redis), config | Spine runnable locally |
| **1 — Messaging Core** | Inbound webhooks + normalization + idempotency; emit `NewInteractionReceived`; **200 OK immediate** | Ingress resilience live (§5.2) |
| **2 — Ticketing & SLA** | Ticket aggregate + lifecycle; reacts to events; SLA worker emits warnings | Core business logic live |
| **3 — Agent BFF + Realtime** | Aggregation endpoints (Inbox/Dashboard/Kanban) + WS push + Optimistic-UI reconcile | **👉 FE unblocked** |
| **4 — Mock Adapters** | All 10 ports returning realistic data | BFF has data |
| **5 — Feature modules** | broadcast, incident, cx, kb | All screens served |
| **6 — Extract + Real bus** | Extract Ticketing → separate service; swap `KafkaEventBus`; real adapters | Final architecture |

---

## 10. Testing Strategy

- **Unit:** domain entities/value-objects/aggregate invariants (pure TS, no Nest).
- **Integration:** repositories + outbox against PostgreSQL (testcontainers).
- **Contract:** each port interface has mock-adapter + real-adapter contract tests.
- **E2E:** BFF endpoints + WS events via supertest + socket.io-client.

---

## 11. Open Items / Follow-ups
- Confirm `product` module is implemented (not just documented) — mirror its real structure.
- SLA **policy values** per channel/priority (open item from Product Brief §7).
- Identity-resolution rules (`zalo_user_id → GlobalCustomerId`) — see Brief §7.
- Extraction trigger criteria (when does Ticketing become its own service? RPS / HA target).

---

*Authored 2026-06-20. Next action: **Phase 0 — Foundations** (or review this plan first).*
