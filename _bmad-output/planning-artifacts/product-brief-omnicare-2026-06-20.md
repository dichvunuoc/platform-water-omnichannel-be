---
title: "OmniCare — Omnichannel Customer Service Platform"
product_name: "OmniCare"
project_name: "nestjs-project-example"
document_type: "Enterprise Product Brief"
version: "0.3 — Draft (Backend Approach Locked)"
status: "In Progress — Collaborative Discovery"
date: "2026-06-20"
author: "Pc"
communication_language: "English"
document_output_language: "English"

# Workflow state
workflow: "create-product-brief"
stepsCompleted: [1]
currentStep: "step-02-vision (pending)"
outputFile: "_bmad-output/planning-artifacts/product-brief-omnicare-2026-06-20.md"

# Input documents (from Step 01 discovery)
inputDocuments:
  primary: "User-provided 5-layer Omnichannel architecture description + in-chat collaborative discovery transcript"
  background_available_not_loaded:
    - "README.md (project root)"
    - "src/libs/core/README.md"
    - "src/libs/shared/README.md"
    - "src/modules/product/README.md"
  brainstorming_reports: "None found"
  research_documents: "None found"
  project_context: "None found (no project-context.md)"

# Locked product & architectural decisions (from discovery)
locked_decisions:
  product_identity: "Omnichannel Customer Service (contact-center) platform; field-operations (FSM/GIS) treated as a downstream integration, not a core product capability"
  architecture_style: "Modular monolith (strict bounded contexts) + Ports & Adapters (hexagonal); mock-first MVP; designed for clean extraction to microservices"
  deployment_strategy: "Distributed microservices from Day 1 — Omni-Messaging Core + Ticketing & SLA Engine as two separate services (own DBs), communicating asynchronously via RabbitMQ. No monolith phase; no later extraction. (Revised from modular-monolith plan per leadership direction 2026-06-20.)"
  ai_strategy: "Core system is 100% routing and communication. All AI logic (vision, NLP, speech-to-text) is explicitly externalized behind Mock Adapters for Phase 1."
  message_to_ticket_link: "Event-driven (asynchronous) — Ingress-layer resilience is non-negotiable; Zalo webhooks must never block on a Ticket DB insert"
  eventual_consistency_ux: "Optimistic UI updates at the BFF layer (optimistic render, reconcile on push)"
  ticketing_sla_service: "Separate bounded-context module now → extracted microservice later; SLA runs as a background worker emitting SlaWarning/SlaBreached events"
  trade_acknowledged: "Consciously trading the earlier macro-service (low-latency/low-opex) principle for bounded-context clarity + deploy independence"

revision_history:
  - "2026-06-20 r1: initial scaffold (v0.1)."
  - "2026-06-20 r2: AI scope clarified — all AI externalized (call & display only); removed OCR/meter-reading (YOLOv8/Bayesian) remnants; added AudioAI + NLP ports; §1 realigned to remove owned-AI framing."
  - "2026-06-20 r3: backend approach locked (modular monolith → extract; in-process event bus → Kafka; socket.io); §5.5 observability refined to actual Loki+Prometheus+Grafana stack. See backend-build-plan-omnicare-2026-06-20.md."
  - "2026-06-20 r4: architecture reversed to distributed microservices from Day 1 (2 services + RabbitMQ) per leadership direction. See execution-plan-omnicare.md v2.0."
---

# Product Brief: OmniCare
## Omnichannel Customer Service Platform

> **Legend:** 🔒 = **locked** by mutual decision · 🔍 = **open**, to be captured in subsequent guided workflow steps.
> **Status:** Draft v0.2 — AI scope clarified on 2026-06-20.

---

## 1. Product Identity & Vision 🔒

**Product Name:** OmniCare  *(proposed — confirmable)*
**Tagline:** *One inbox. Every channel. Every customer — served in real time.*
**Category:** Omnichannel Customer Service (CS) Platform, purpose-built for utility operations.

**Vision Statement:**
OmniCare unifies a water utility's fragmented customer touchpoints — **Zalo Official Account (OA), the Customer Mobile App, Email, and the VoIP/1900 call center** — into a single real-time agent workspace. Every inbound conversation is normalized into one format, bound to a ticket with enforceable **SLA accountability**, and presented alongside a **360° customer view** and **AI insights** (tags, transcripts) surfaced from external adapters. The result: faster resolution, measurable service quality (CSAT/NPS), and a resilient contact center that **never drops a customer message at the door**.

**Why this exists (the differentiator):**
The spine is **ultra-resilient message routing + a unified, real-time agent experience + a utility-specific integration fabric** — Customer 360 (contracts, receivables, consumption history) and identity resolution. Critically, **AI is a pluggable, externalized capability** (vision, NLP, speech) *called via adapters* — not a heavy model the platform must host. This keeps OmniCare fast and operationally light where generic SaaS is rigid, and avoids the risk of drowning the project under heavy AI models.

---

## 2. Target Users & Personas 🔍 *(to refine)*
- **Agent (Tổng đài viên):** primary user of the Agent Workspace — handles conversations across all channels in one inbox.
- **Team Lead / Supervisor:** monitors SLA compliance, dashboard KPIs, escalations.
- **Customer:** contacts via Zalo OA / App / Web / VoIP 1900.
- *(Field technician — downstream, not a direct OmniCare user.)*

---

## 3. Problem Statement 🔒
Today's customer interactions are **siloed** across Zalo, App, Email, and the call center, with no unified agent view, **no SLA accountability**, manual triage, and **no closed-loop CSAT measurement**. Agents lack customer context (contract, debt, consumption) at the moment of interaction, and there is no resilience guarantee against partner webhook timeouts.

---

## 4. Scope Boundary 🔒

| In Scope (Core Product) | Out of Scope (Downstream / Integrated via Ports) |
|---|---|
| Channel unification (Zalo OA, App, Email, VoIP) | Field operations / FSM / GIS dispatch (called out, not owned) |
| Unified agent workspace (Inbox, Kanban, Dashboard, Softphone) | All AI logic — vision classification, NLP, speech-to-text (called via Mock Adapters, not owned) |
| Ticket lifecycle + SLA monitoring | Billing & Customer 360 source systems (read-only integration) |
| Customer 360 *view* (integrated) | Telephony carrier infrastructure (VoIP provider) |
| CSAT/NPS measurement | Chatbot / conversational-AI model hosting (behind Chatbot Port) |
| Displaying AI Insights on UI (Tags, Transcripts) fetched via Adapters | |

---

## 5. Architecture (Locked Decisions) 🔒

### 5.1 Architectural Style
**Microservices + Ports & Adapters (Hexagonal)**, with a **mock-first MVP**. Core orchestration is built directly; complex / external / volatile capabilities sit behind **Port interfaces** (mocked in Phase 1, swapped for real adapters later).

### 5.2 🔒 LOCKED — Message → Ticket Link is EVENT-DRIVEN
> **Decision:** The Omni-Messaging Router does **not** synchronously call the Ticketing service on inbound. It accepts the webhook (e.g., from Zalo), persists/normalizes the message, **emits an event** (`NewInteractionReceived`), and **returns `200 OK` immediately**.
> **Rationale:** Ingress-layer resilience is non-negotiable. A Zalo webhook must never block on a Ticket DB insert — partner timeout windows are not ours to spend.
> **Consistency model:** Eventual consistency. The Ticketing service reacts to the event asynchronously.
> **UX contract:** **Optimistic UI at the BFF** — the agent sees the incoming message immediately; the ticket binding reconciles via real-time push (WebSocket/SSE) within the brief async window.
> **Source of truth** for ticket state (Open / In Progress / Closed) = the **Ticketing service**.

### 5.3 🔒 LOCKED — Ticketing & SLA is a Separate Bounded-Context Service
> **Decision:** Ticketing & SLA is its own microservice, not part of the Messaging Core.
> **Justification:** (a) distinct bounded context (ticket aggregate vs. message); (b) distinct runtime shape — SLA monitoring is a **continuous background worker**, not request/response; (c) deploy independence; (d) team boundary (Conway's Law).
> **Trade-off acknowledged:** consciously departs from the earlier macro-service principle (low latency / low opex) in favor of bounded-context clarity + deploy isolation.
> **SLA engine:** background worker emitting `SlaWarning` / `SlaBreached` events onto the bus; SLA policies (per channel/priority) stored as **data**, not code.

### 5.4 Service Decomposition (Phase 1)
- **Messaging Core** (build directly): Omni-Messaging Router (inbound webhooks, normalization, idempotency, outbound), Broadcast Engine (proactive batch queue).
- **Agent BFF & Real-time Gateway** (build directly): internal API gateway, aggregation, WebSocket/SSE push, Optimistic UI reconciliation.
- **Ticketing & SLA Service** (separate service; mocked CRUD + static SLA timer in MVP).
- **Ports (mocked adapters):** AI Vision (vision classification), NLP (chat intent classification), AudioAI (1900 call transcription), Chatbot (auto-handling), CX & Feedback, Knowledge Base, IAM, Customer 360, VoIP Telephony, FSM & GIS.

### 5.5 Data & Infrastructure
PostgreSQL + PgBouncer (connection pooling) + Read Replica (heavy reporting); Redis (sessions, customer-profile cache, idempotency keys); ElasticSearch (KB + message full-text search); Kafka/RabbitMQ (event-bus backbone). **Observability:** Loki (logs) + Prometheus (metrics) + Grafana (dashboards) + Jaeger/OpenTelemetry (trace_id propagated across the async/event boundary) + Kubernetes (auto-scale Core at meter-reading peak — *chốt chỉ số nước*). All already scaffolded in-repo.

### 5.6 🔒 LOCKED — AI is Fully External (Calls & Displays Only)
> **Decision:** OmniCare's core is **100% routing and communication**. The system does **not** own or execute any AI model. All AI logic — vision classification, NLP intent, speech-to-text — is **externalized behind Mock Adapters** in Phase 1 (and behind real external microservices later). The core only **calls and displays** AI insights (tags, transcripts) on the UI.
> **Why:** keeps the platform a lightweight, ultra-fast messaging/routing core with a smooth UX — immune to the cost, latency, and operational risk of hosting heavy AI models.

---

## 6. Phase 1 — MVP Scope 🔒

**MVP Definition:** *Part 1 (built core) + Part 2 (mocked ports) = a complete, demonstrable, end-to-end agent experience with realistic data — no hard external dependencies.*

### Part 1 — Built Directly (Core Orchestration + UX)
- **Frontend Agent Workspace:** Unified Inbox, Operations Dashboard, Softphone UI, Kanban UI (data via BFF).
- **Agent BFF & Real-time Gateway:** Internal API gateway, aggregation for Dashboard, WebSocket/SSE for zero-latency message/event push + Optimistic UI reconciliation.
- **Omni-Messaging Router:** Inbound webhook ingress (Zalo, FB, App), normalization to a common message format, **idempotency** (dedup on network retry), outbound message send.
- **Broadcast Engine:** Queue-managed proactive batch notifications.

### Part 2 — Mock Adapters (External Ports)
- **AI Vision Port** *(NEW):* mock — image URL → JSON (e.g., `{"tag":"Vỡ / bể ống","confidence":0.97}`).
- **NLP Port** *(NEW):* mock — chat message → intent classification result.
- **AudioAI Port** *(NEW):* mock — 1900 call audio → transcript.
- **CX & Feedback Port:** mock dashboard stats (e.g., `{"csat_score":4.4,"csat_total":150}`); reacts to `TicketClosed` to simulate survey send.
- **Knowledge Base Port:** mock canned responses on `/` in chat.
- **Ticket & SLA Port:** mock CRUD + static SLA countdown ("Còn 1.6h").
- **IAM Port:** mock agent token decode + Zalo ID → Customer ID resolution.
- **Customer 360 Port:** mock profile (receivables, customer type, address).
- **VoIP Telephony Port:** mock 1900 call webhooks (ring, answer).
- **FSM & GIS Port:** mock field-tech dispatch + simulated map coords.
- **Chatbot Port:** mock AI auto-handling before escalation to a human.

### Deferred to Later Phases
- Real **Ticketing & SLA Service** (with live SLA-breach background worker).
- Real **AI Integrations** — Replace Mock Adapters with external AI/NLP microservices for vision classification and call transcription.
- Real **CX survey delivery** (SMS/Push), real **KB CMS + search**, real integrations (IAM, Customer 360, VoIP, FSM/GIS, Chatbot), field-service depth.

---

## 7. Open Items for Guided Discovery 🔍
*(To be captured in subsequent workflow steps)*
- **Success Metrics / KPIs:** CSAT/NPS targets, SLA compliance %, first-response time, agent handle time, KB deflection.
- **Competitive Analysis:** build-vs-buy deep-dive (Zendesk / Freshdesk / Zalo OA vs. OmniCare).
- **SLA Policies:** concrete targets per channel & priority; escalation paths.
- **Identity Resolution design:** golden record, dedup, multi-account / multi-contract handling.
- **Risks & Mitigations:** event-ordering / dedup, transient-inconsistency UX edge cases.
- **Non-Functional Requirements:** peak RPS targets, capacity/cost envelope, HA/DR.
- **Roadmap / Timeline / Phasing detail.**
- **Assumptions & Constraints** (incl. brownfield: existing IAM + Customer 360 maturity).

---

*Document scaffolded 2026-06-20 via the BMAD `create-product-brief` workflow, Step 01. Next guided step: **step-02-vision** (formal vision validation & refinement).*
