---
title: "OmniCare — Product Requirements Document"
project_name: "nestjs-project-example"
product_name: "OmniCare"
document_type: "Product Requirements Document (PRD)"
workflowType: "prd"
version: "1.2 — Backend-only scope (Omnichannel service + BFF; frontend already delivered)"
status: "Revised — PRD v1.2"
date: "2026-06-22"
revision_note: "v1.2 drops frontend from build scope. The agent workspace SPA is already delivered (5 screens). This PRD now specifies ONLY the backend — the Omnichannel service + BFF — that exposes the APIs, broker events, and WebSocket pushes the existing frontend consumes. v1.1 split Ticketing & SLA into its own microservice (consumed via contract/broker), unchanged here."
author: "Pc"
communication_language: "English"
document_output_language: "English"

# Workflow state
workflow: "prd (create mode)"
stepsCompleted: ["step-01-init", "step-02-discovery", "step-03-success", "step-04-journeys", "step-05-domain", "step-06-innovation", "step-07-project-type", "step-08-scoping", "step-09-functional", "step-10-nonfunctional", "step-11-polish", "step-12-complete"]
currentStep: "complete"
outputFile: "_bmad-output/planning-artifacts/prd.md"

# Input documents
inputDocuments:
  primary: "product-brief-omnicare-2026-06-20.md"
  supplementary: "backend-build-plan-omnicare-2026-06-20.md"
documentCounts:
  briefCount: 1
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 4

classification:
  projectType: "backend services — Omnichannel domain service + BFF (REST/gRPC + broker events + WebSocket gateway). Platform characteristics (RBAC, integrations, compliance). Frontend SPA already delivered (out of scope)."
  domain: "govtech (public-sector utility / civic customer service)"
  complexity: "high"
  projectContext: "brownfield (existing NestJS backend extended with greenfield OmniCare)"
  buildScope: "Backend only: Omnichannel service + BFF. Frontend SPA already delivered — not built here; backend exposes the APIs/events/WebSocket it consumes. Ticketing & SLA = separate microservice (own PRD/bounded context), integrated not built here."
  open_clarifications: "resolved (Step 5) — SOE operator; on-prem/VN-cloud residency; IVR consent; WCAG/Decree-13 as best-practice guidelines"
---

# Product Requirements Document — OmniCare

**Author:** Pc
**Date:** 2026-06-22

> PRD for **OmniCare — Omnichannel Customer Service Platform**. Derived from the Product Brief + Backend Build Plan + Chapter 5 business spec.
> **Status:** Revised v1.2 — capability contract. Build sequencing (omnichannel-first waves) is governed by `execution-plan-omnicare.md`.
>
> **Scope (v1.2 — backend only):** The agent workspace **frontend is already delivered** (the 5 screens). This PRD specifies **only the backend** — the **Omnichannel service + BFF** — i.e., the APIs, broker events, and WebSocket pushes that the existing frontend consumes. UI build, styling, browser/responsive/SEO concerns are **out of scope**. **Ticketing & SLA** remains a separate microservice (own bounded context), consumed via contract/broker — same status as Customer 360. FRs belonging to the Ticketing & SLA service are kept as an **integration contract** (tagged `[TKT-SVC]`), not build scope.

---

## Table of Contents

1. Executive Summary
2. Service Boundaries (Bounded Contexts)
3. Success Criteria
4. Product Scope
5. User Journeys
6. Domain-Specific Requirements
7. Innovation & Novel Patterns
8. Backend Surface, BFF & Real-time Requirements
9. Functional Requirements
10. Non-Functional Requirements

---

## Executive Summary

**OmniCare** is an omnichannel customer-service platform for a city water utility (state-owned enterprise), unifying Zalo OA, the customer mobile app, Facebook, email, and the VoIP/1900 call center into a single real-time agent workspace. It binds every inbound interaction to a ticket with enforceable SLA accountability, presents a 360° customer view alongside each conversation, and measures satisfaction (CSAT/NPS) to drive continuous improvement.

**Differentiator:** unlike generic helpdesks, OmniCare is purpose-built for utility operations — a resilient ingress that never drops a customer message, a unified agent experience, Customer 360 integration (contract / debt / consumption), and a novel **geo-clustered mass-outage triage** that merges thousands of simultaneous burst-pipe reports into a single parent incident. AI is a pluggable, externalized capability — called and displayed, never owned.

**Target users:** contact-center agents (tổng đài viên), shift supervisors, and customers (via App / Zalo / Web / VoIP).

**Build scope of this PRD (backend only):** the **Omnichannel service** (multi-channel ingestion, normalization, identity, real-time delivery, agent-workspace data, telephony events, broadcast, knowledge base, CSAT capture, field-incident intake) plus a **Backend-for-Frontend (BFF)** that the already-delivered React SPA talks to. This PRD specifies the **server-side contract** — APIs, broker events, and the WebSocket gateway — that powers the existing screens; **frontend/UI is not built here**. The BFF aggregates and fronts the sibling services. **Ticketing & SLA is a separate microservice** (own bounded context) that this scope **integrates with via the broker + contract** — the backend creates tickets in it, serves ticket state and SLA countdowns sourced from it, and relays the `SlaWarning` events it emits, but does **not** own the ticket lifecycle, SLA policy engine, or breach worker. Other sibling services consumed the same way: Customer 360, Field-team App, AI services.

---

## Service Boundaries (Bounded Contexts)

> The agent-workspace **frontend is already delivered** (one SPA — see the 5 screens) and is **out of this PRD's build scope**. The sidebar modules (Điều hành CSKH, Inbox hợp nhất, Tổng đài 1900, Sự cố hiện trường, Ticket & SLA, KB, Thông báo chủ động, Khảo sát hài lòng) are served by **one BFF**. This table defines *which backend service owns the data/operations behind each module* — i.e., what this PRD builds. "Built in this PRD?" = built on the **backend** (Omnichannel service or BFF); the frontend that renders it already exists.

| Concern (backend) | Owner | Built in this PRD? |
|---|---|---|
| Multi-channel ingestion, 200-OK, idempotency, normalization | **Omnichannel service** | ✅ Yes |
| Unified-inbox data + conversation thread + real-time push gateway | **Omnichannel service** | ✅ Yes |
| Telephony events / softphone screen-pop data (Tổng đài 1900) | **Omnichannel service** (consumes VoIP/ACD) | ✅ Yes |
| Field-incident intake + AI-tag relay + GIS-pin data + FSM dispatch trigger (Sự cố hiện trường) | **Omnichannel service** | ✅ Yes |
| Knowledge Base / FAQ CMS + Vietnamese search | **Omnichannel service** | ✅ Yes |
| Proactive broadcast (Thông báo chủ động) | **Omnichannel service** | ✅ Yes |
| CSAT/NPS/CES capture + survey delivery (Khảo sát hài lòng) | **Omnichannel service** | ✅ Yes |
| Operations dashboard data (Điều hành CSKH) — aggregation | **BFF** (aggregates omnichannel + ticketing + CSAT) | ✅ Yes |
| BFF — single read/write gateway for the SPA, aggregation, fan-out | **BFF** | ✅ Yes |
| **Ticket lifecycle, ID/owner, type/priority** | **Ticketing & SLA service** | ❌ Consumed (separate microservice) |
| **SLA policy engine, breach worker, `SlaWarning` emit, escalation, auto-reopen** | **Ticketing & SLA service** | ❌ Consumed (separate microservice) |
| Ticket & SLA Kanban data + SLA countdown for the Inbox (serve to FE) | **BFF** → Ticketing service; data relayed to delivered FE | ✅ Yes (serve only; UI exists) |
| Mass-outage **detection / clustering** (geo radius + time window + type similarity) — *pre-ticket triage* | **Omnichannel service** | ✅ Yes |
| **Parent Incident as a grouping of child tickets** (attach / detach / split tickets under one parent) | **Ticketing & SLA service** | ❌ Consumed (separate microservice) |
| Affected-report / affected-customer data for a parent incident (serve to FE) | **BFF** (omnichannel reports + Ticketing grouping) | ✅ Yes (serve only; UI exists) |
| Identity resolution / Customer 360 | Customer 360 service | ❌ Consumed |
| AI vision classification, NLP intent, speech-to-text, chatbot | External AI services | ❌ Consumed |
| **Agent-workspace SPA / any UI rendering, styling, browser/responsive/SEO** | **Frontend (already delivered)** | ⛔ Out of scope |

**Integration style:** the Omnichannel service and the Ticketing & SLA service communicate **asynchronously over the message broker** (events: `MessageReceived`, `TicketCreateRequested`, `TicketStateChanged`, `SlaWarning`, `TicketClosed`, `CsatSubmitted`). The BFF performs **synchronous read aggregation** (e.g., to render a conversation it joins omnichannel thread + Customer 360 card + the ticket/SLA state from the Ticketing service). No frontend call ever reaches a backend service directly — everything goes through the BFF.

---

## Success Criteria

### User Success
- **Agents** open any conversation and view full customer context (contract, debt, consumption) within 3 seconds; advance or resolve a ticket within 5 clicks.
- **Agents never lose a message**: 100% of inbound interactions (Zalo, App, Facebook, VoIP) surface in the unified inbox.
- **Supervisors** see SLA-at-risk tickets before they breach via real-time Kanban timers.
- **Customers** receive a first response on their chosen channel within SLA and rate the experience at least 4.4/5.

### Business Success
- SLA compliance sustained at or above 94.2% (Phase-1 target; floor 92%).
- CSAT at or above 4.4/5 and NPS at or above +58.
- Deflection rate at or above 30% — automated resolution of invoice-lookup and water-cut-schedule queries, freeing agents for complex complaints (Growth-phase measured target).
- Average handle time reduced versus the pre-OmniCare baseline.
- 100% of interactions traceable end-to-end (GovTech auditability).

### Technical Success
- Ingestion resilience: 100% of partner webhooks acknowledged within partner timeout, with zero blocked ingestion — including at peak.
- Real-time delivery: a new inbound reflects on the agent screen within 2 seconds at the 95th percentile.
- Peak concurrency: sustain at least 1,000 concurrent users across the ingress and real-time layers with zero dropped messages, during meter-reading day and widespread-incident peaks.
- Idempotency: zero duplicate messages from network retries.
- Availability: 99.9% during business hours (the concern is no dropped messages and a live agent screen, not abstract uptime).
- AI insight display: AI-derived tags and transcripts surface within 3 seconds of upload (display SLA only; inference is external).

### Measurable Outcomes

| Metric | Target | Measurement |
|---|---|---|
| VoIP answer speed (80/20) | 80% of calls answered ≤ 20s | VoIP/ACD statistics |
| Chat auto-greeting first response | ≤ 3 min | Messaging timestamps |
| Chat live-agent reply | ≤ 5 min | Ticket assignment-to-reply time |
| Email / web-form response | ≤ 4 working hours | Ticket timestamps |
| SLA compliance | ≥ 94.2% (Phase-1 target; floor 92%) | Ticketing service SLA engine |
| CSAT | ≥ 4.4/5 | Post-resolution survey |
| NPS | ≥ +58 | Survey |
| Deflection rate | ≥ 30% | Chatbot/KB resolved vs agent-handled |
| Peak concurrency | ≥ 1,000 CCU, 0 dropped | Ingress + real-time load tests |
| Real-time push latency | ≤ 2s (p95) | Gateway telemetry |
| Availability (business hours) | 99.9% | APM/uptime monitoring |
| Audit trace coverage | 100% of interactions | Trace sampling |

## Product Scope

> Build sequencing (omnichannel-first waves) is governed by `execution-plan-omnicare.md`. This section defines *what* is in scope per phase.

### MVP Strategy & Philosophy
**MVP Approach:** Experience MVP — a demo-grade, end-to-end real-time omnichannel agent loop (ingestion → identity → push → ticket → SLA breach alert → CSAT) with mocked external systems, **driven by the backend (Omnichannel + BFF) into the already-delivered frontend**. Designed to be **conclusively demonstrable to an evaluation board** — a live, data-driven loop, not static UI.
**Resource Requirements:** small backend team (Omnichannel service + BFF) + DevOps, absorbed by the existing K8s/OTel/Loki stack. Frontend is already delivered (no FE build); FE↔backend integration is a contract-conformance effort only.

### MVP Feature Set (Phase 1)
**Core journeys supported:** J1 (Zalo incident), J2 (billing call), J3 (SLA firefighting) — each demo-able end-to-end.
**Must-have (Omnichannel + BFF — this scope):**
- Multi-channel ingestion + 200-OK + idempotency + normalization.
- Real-time push (Inbox + Softphone screen-pop).
- **Ticket interaction via the Ticketing service:** create a ticket from a conversation (`TicketCreateRequested` → Ticketing service), display ticket state, and **render `SlaWarning` events** consumed from the broker on the Kanban / Inbox (red-flash + countdown) — *required for the J3 demo*. The SLA engine + breach worker themselves live in the **Ticketing & SLA service** (see below), not here.
- **Backend surface for the existing FE:** REST/gRPC endpoints + WebSocket gateway + broker events that power the delivered screens — Inbox unified feed, SLA Kanban data (served from BFF → Ticketing service), Knowledge Base (FAQ) query, Field-incident intake, Softphone screen-pop, Broadcast send, CSAT survey. **No UI is built; the frontend already exists** and integrates against these contracts.
- **Call-recording URL** in interaction history (mock audio file) — *retention proof*.
- Mock adapters: Identity resolution, Customer 360, AI insight display, static Audio AI, **Ticketing & SLA service** (a stub that accepts ticket-create and emits `SlaWarning` so J3 is demo-able even before the real service ships).
- RBAC (Agent/Supervisor/Admin).

**Required from the sibling Ticketing & SLA service for the MVP demo (built under its own PRD, not here):** ticket lifecycle + SLA policy engine + breach worker that emits `SlaWarning`. This scope ships a **contract-conformant stub** so the omnichannel demo is conclusive on its own.

### Post-MVP Features
**Phase 2 (Growth):**
- Real adapters (IAM, Customer 360, VoIP, AI vision/NLP/audio).
- IVR multi-branch + skill/geo routing (§5.1).
- AI volume forecasting (§5.1 / external 10.6).
- Advanced CSAT + periodic NPS + closing-the-loop (auto-reopen on <3★) (§5.3).
- Parent-Incident triage · Customer self-tracking (J6) · deflection measurement (J4).

**Phase 3 (Vision):** advanced AI integrations · field-service depth · multi-tenant.

### Risk Mitigation Strategy
| Risk | Mitigation |
|---|---|
| Omnichannel ↔ Ticketing service boundary | contract-first + idempotency + DLQ; broker events versioned; contract tests both sides; 1,000 CCU load-tested |
| Parent-Incident clustering accuracy | shadow-mode before auto |
| Agent adoption | training + dense-desktop UX |
| Deflection depends on external chatbot | measure independently |
| Multi-service ops cost | lean on existing K8s/OTel/Loki stack |

---

## User Journeys

### Journey 1 — Zalo Incident Resolution (Speed & Identity)
**Persona:** Bác Nam (customer) + Trà (agent) · **Channel:** Zalo OA
- **Opening:** A pipe bursts outside Nam's home; he photographs it and sends it via the company's Zalo OA.
- **Rising:** The ingress acknowledges with HTTP 200 immediately (no Zalo timeout), normalizes the message to a standard format, and emits an event. Chatbot identifies the unknown contact and asks for a customer code or phone; Nam provides it; identity resolution links the Zalo ID to profile "Nguyễn Văn Nam." The message and photo push to Trà's unified inbox within 2 seconds, with a Customer 360 card (contract, debt history).
- **Climax:** Trà grasps the issue and creates an incident ticket in one click; the omnichannel workspace sends a `TicketCreateRequested` to the **Ticketing & SLA service**, which opens the ticket and starts its SLA clock. (If an external vision service is wired, an incident-classification tag may be displayed — external, not built.)
- **Resolution:** The field team resolves the issue; Trà moves the ticket to Done (the action is proxied through the BFF to the Ticketing service); a CSAT survey is sent via Zalo by the omnichannel service; Nam rates 5 stars.
- **Capabilities:** ingestion + idempotency + 200-OK resilience · identity resolution · Customer 360 · real-time push · **ticket-create + state-change via the Ticketing service** · CSAT loop.

### Journey 2 — Billing Complaint Call (Identify Before Answering)
**Persona:** Chị Hoa (customer, frustrated) + Minh (agent) · **Channel:** VoIP 1900
- **Opening:** Hoa's bill spikes; she calls 1900, annoyed.
- **Rising:** On ring, the telephony integration sends the calling number; Minh's softphone auto-pops Hoa's profile and a consumption chart (3× this month) before he answers.
- **Climax:** Minh answers within the 80/20 target and calmly explains tiered pricing and leak-check steps, informed by the advance context. (An external speech-to-text transcript may be displayed — external, not built.)
- **Resolution:** Hoa is satisfied; Minh logs the outcome into the shared customer timeline.
- **Capabilities:** VoIP screen-pop (identify-before-answer) · Customer 360 · 80/20 SLA · shared timeline.

### Journey 3 — SLA Firefighting (Supervisor)
**Persona:** Tuấn (shift lead) · **Channel:** internal Kanban
- **Opening:** A message flood arrives on meter-reading day.
- **Rising:** The **Ticketing & SLA service's** background worker scans thousands of tickets and detects #402 (water-out) overdue by 3 hours, 15 minutes from SLA breach.
- **Climax:** The Ticketing service emits an `SlaWarning` over the broker; the **omnichannel workspace consumes it** and Tuấn's Kanban (and the holding agent's) flashes a red border with a blinking countdown.
- **Resolution:** Tuấn re-assigns #402 to a free agent — the action is proxied through the BFF to the Ticketing service; the customer is called back; the 94.2% SLA is preserved.
- **Capabilities:** **SLA breach worker (Ticketing service)** · `SlaWarning` consumed + rendered real-time (omnichannel) · Kanban visual alert · supervisor re-assignment (proxied) + permissions.

### Journey 4 — Self-Service Deflection (Automated Relief)
**Persona:** Anh Khang (customer) · **Channel:** Zalo/App
- **Opening:** Khang sees a scheduled water-cut notice and asks when water will return.
- **Rising:** The knowledge base matches "Lịch cắt nước P. Hòa Bình" and returns the schedule and an affected-area map within seconds. (The conversational handling is provided by an external chatbot — external, not built; the system integrates and measures.)
- **Climax / Resolution:** No agent is involved and no ticket is created; the interaction counts toward the ≥30% deflection target.
- **Capabilities:** knowledge-base search · deflection measurement · chatbot integration hook (external bot).

### Journey 5 — Unresolvable Identity (Error Recovery)
**Persona:** A new tenant (no profile) + agent · **Channel:** App
- **Opening:** The tenant messages, but identity resolution cannot match any existing profile.
- **Rising:** The message is flagged "unidentified" yet still captured (no message lost); it surfaces to an agent with a fallback path.
- **Climax / Resolution:** The agent creates a provisional profile / routes to onboarding, and the customer is served via the fallback.
- **Capabilities:** identity-resolution failure handling · graceful fallback · no-message-loss guarantee · manual profile creation.

### Journey 6 — Customer Self-Tracking
**Persona:** A customer · **Channel:** My Công ty App
- **Opening:** The customer wants to know the status of a reported issue without calling.
- **Rising:** The customer opens My Công ty App and enters a lookup code.
- **Climax / Resolution:** The app displays the ticket's current stage (Grab/Shopee-style tracking) — received, in progress, assigned to field team, resolved — with no agent contact needed.
- **Capabilities:** customer self-service tracking · ticket-status lookup by code · app integration (My Công ty / module 7.1).

### Journey Requirements Summary

**In build scope (Omnichannel service + BFF) → become Functional Requirements:**
- Multi-channel ingestion + idempotency + 200-OK resilience.
- Real-time push ≤ 2s (inbox + softphone).
- Identity resolution (channel ID → profile), including failure/fallback and manual creation.
- Customer 360 view (contract / debt / consumption / shared timeline) — *via Customer 360 service*.
- **Ticket-create + state-change actions proxied to the Ticketing service**, and **`SlaWarning` consumed + rendered** on Kanban/Inbox (the engine/worker itself is NOT here).
- Customer self-service ticket tracking (lookup code) — *reads ticket state from the Ticketing service via BFF*.
- CSAT survey on resolution (capture + delivery here; auto-reopen on low score is acted on by the Ticketing service).
- Auto-greeting (non-AI) + canned-response suggestions + knowledge-base search.
- Field-incident intake (photo → AI-tag display → GIS pin → FSM dispatch trigger).
- Proactive broadcast (water-cut / flush / maintenance) by area.
- Supervisor tools (Kanban alerts render, re-assignment proxied, permissions).
- VoIP screen-pop + 80/20 SLA + call recording (retention).
- AI insight display capability (a plug — renders external AI signals; never runs inference).
- Operations dashboard (BFF-aggregated KPIs).

**Consumed from sibling services (separate bounded contexts — NOT built in this PRD):**
- **Ticketing & SLA service:** ticket lifecycle, ID/owner, type/priority classification, **SLA policy engine, breach worker, escalation, auto-reopen** (own PRD).
- Customer 360 / Identity service: profile, contract, debt, consumption.
- Field-team App: Work Orders.

**Out of build scope (external AI, via API later):**
- AI vision classification, NLP intent, speech-to-text, conversational chatbot.
- Note: the ≥30% deflection target and AI insight display are contingent on these external services being wired.

---

## Domain-Specific Requirements

> **Operator:** city/urban **state-owned enterprise (SOE)**. Enterprise-grade rigor (RBAC, audit logging, traceability) is applied as architecture best practice. Regulatory standards (Decree 13/2023, WCAG 2.1 AA) guide the architecture as **best-practice guidelines** rather than immediate hard-certification gates.

### Compliance & Regulatory
- **Personal Data Protection (Decree 13/2023/ND-CP):** applied as a best-practice guideline — consent, purpose-limitation, retention, and data-subject rights for all customer PII (phone, address, contract, debt, consumption, CSAT).
- **Call-recording transparency (§5.1):** an automatic **IVR announcement** ("This call may be recorded to improve service quality…") plays before routing to an agent, satisfying transparency for the 90-day recording retention.
- **Cybersecurity (Law on Cybersecurity 2018):** logging, incident reporting, and data protection applied as best practice.
- **Auditability / transparency (SOE):** 100% interaction traceability (trace_id), immutable logs, defined retention.

### Technical Constraints
- **Data residency / sovereignty:** deployment **on-premise or on a Vietnam-hosted domestic cloud**; customer PII and consumption profiles remain within national borders.
- **Security:** encryption in-transit + at-rest · RBAC (agent/supervisor/admin) · least-privilege · audit logging.
- **Privacy:** data minimization · consent management · retention policies (90-day recordings) · data-subject access/deletion handling.
- **Accessibility (WCAG 2.1 AA as guideline):** UI conformance is owned by the **delivered frontend** (out of this backend scope); the backend serves KB/self-tracking **content in a semantic, structured form** that does not block AA compliance.
- **Performance / Availability:** real-time ≤ 2s · ≥ 1,000 CCU peak · 99.9% business hours.

### Integration Requirements *(the ports — from Chapter 5)*
**Ticketing & SLA service** (sibling microservice, async via broker + BFF) · Customer 360 (1.1) · My Công ty App (7.1) · Business Dashboard (9.1) · AI Chatbot (10.1, external) · AI Forecasting (10.6, external) · Field-team Mobile App (Work Orders).

### Domain Pattern — Network Outage Triage (utility-specific)
Water networks fail geographically: a main-pipe burst triggers **thousands of near-simultaneous reports** from one area. Beyond static capacity (1,000 CCU) and idempotency, **routing rules must auto-detect and merge duplicate reports into a single "Parent Incident"** so the coordinator's Kanban is not flooded. Individual reports attach to the parent as affected customers, not as separate tickets. *(→ Functional Requirement in Step 9.)*

### Risk Mitigations

| Risk | Mitigation |
|---|---|
| PII exposure | RBAC + encryption + audit + minimization |
| Recording without consent | IVR consent announcement + retention policy |
| Identity-resolution error | fallback + manual verification, never block service |
| Mass-duplicate reports (outage) | Parent-Incident auto-merge + geographic clustering |
| Message loss at peak | idempotency + DLQ + 1,000 CCU capacity |
| Traceability gap | trace_id propagation across the async boundary |

---

## Innovation & Novel Patterns

### Detected Innovation Areas
- **Geo-clustered mass-outage triage (Parent-Incident merging):** when a main-pipe burst triggers thousands of near-simultaneous reports, the system auto-clusters by geographic radius + time window + incident-type similarity and merges them into a single **Parent Incident**, attaching individual reports as affected customers. This inverts the standard "one report = one ticket" helpdesk assumption and prevents coordinator-Kanban flooding during widespread outages. *(Genuinely novel for a contact center; domain-specific to utility networks.)*
- **Honest scope:** beyond outage triage, OmniCare is an excellent execution of proven omnichannel patterns (unified inbox, SLA management, VoIP screen-pop, CSAT) rather than breakthrough innovation.

### Market Context & Competitive Landscape
- Generic helpdesks lack utility-specific outage clustering and Customer 360 (contract / debt / consumption).
- Utility field-service tools handle outages but rarely unify them with the contact-center queue.
- OmniCare's edge = bridging **contact-center + outage-incident management** in a single queue.

### Validation Approach
- Define clustering rules (geo radius + time window + incident-type similarity) and a **confidence threshold** before auto-merge.
- Pilot in **shadow mode** (suggest merges; agent confirms) before full auto-merge.
- Measure: merge accuracy, false-merge rate, coordinator Kanban-load reduction.

### Risk Mitigation
| Risk | Mitigation |
|---|---|
| False merge (unrelated reports grouped) | confidence threshold + agent confirmation + easy un-merge |
| Missed merge (true cluster undetected) | always create individual tickets as fallback; never lose a report |
| Over-aggressive auto-merge | start in suggest-mode (human-in-the-loop), graduate to auto |

---

## Backend Surface, BFF & Real-time Requirements

> Frontend (the agent-workspace SPA) is **already delivered and out of scope**. This section specifies the **server-side surface** the existing FE depends on. Pure-frontend concerns (browser matrix, responsive layout, SEO, UI accessibility, time-to-interactive) are intentionally **not** covered here.

### Service-Type Overview
Two backend deployables: the **Omnichannel domain service** (ingestion, normalization, identity, channels, real-time gateway, KB, broadcast, CSAT capture, field-incident intake, outage detection) and the **BFF** (single aggregation gateway for the SPA). Both extend the existing NestJS estate. Sibling services (Ticketing & SLA, Customer 360, Field-team App, AI) are consumed, not built.

### API & Contract Surface
- **BFF is the single entry point** for the SPA — no frontend call reaches a domain service directly. The BFF exposes read-aggregation endpoints (e.g., a conversation view = omnichannel thread + Customer 360 card + ticket/SLA state from the Ticketing service) and write endpoints that fan out to the right service.
- **Contracts are versioned and contract-tested** on both sides of every boundary (esp. Omnichannel ↔ Ticketing). Breaking changes require a version bump; consumer-driven contract tests gate releases.
- **API shapes match what the delivered FE already calls** — this PRD conforms the backend to the existing screens, not the reverse. (Field mapping per screen is tracked in the FE integration contract, not duplicated here.)

### Real-time Gateway
- **WebSocket (socket.io)** gateway in the Omnichannel service: new-inbound push, screen-pop signal, and relay of `SlaWarning`/ticket-state events originating in the Ticketing service.
- Delivery target: a server-emitted event reaches the connected client within **2 seconds (p95)** of the backend receiving/producing it.
- Reconnection + backfill: on socket reconnect the client can request missed events without message loss (idempotent replay).

### Backend Performance Targets
- BFF read aggregation: ≤ **500ms (p95)** under normal load (NFR2).
- Webhook acknowledgement: ≤ **200ms** (NFR4).
- Real-time push: ≤ **2s (p95)** (NFR1).
- Peak: ≥ **1,000 CCU** across ingress + real-time layers with zero dropped messages (NFR6).
> (Frontend time-to-interactive is a delivered-FE concern and is no longer an NFR here.)

### Role-Based Access Control (RBAC)
Agent / Supervisor / Admin enforced **server-side** at the BFF/domain-service boundary — ticket handling, re-assignment (proxied), SLA-data read, configuration. The backend is the authority; the FE only reflects granted permissions.

### Integration List (the ports)
Ticketing & SLA service (sibling) · Customer 360 · My Công ty App · Business Dashboard · AI Chatbot (external) · AI Forecasting (external) · Field-team App — all via the BFF/ports.

---

## Functional Requirements

> **Read as backend capabilities (v1.2).** The frontend is delivered; each FR below is the **backend** capability that fulfills it — the API, query, broker event, or WebSocket push. Phrasings like "Agents can view / reply / move…" mean the backend **serves the data and exposes the operation** the existing FE renders; they do **not** imply building UI. **Phase tags:** [MVP] (Phase 1) / [G2] (Phase 2 Growth). **Ownership tags:** [OMNI] = built here (Omnichannel + BFF); [TKT-SVC] = Ticketing & SLA microservice contract (consumed, not built here). Untagged-for-ownership FRs default to [OMNI]. Every downstream artifact (UX, architecture, epics) derives from this list. (62 FRs total — **55 [OMNI]** in this build scope + **7 [TKT-SVC]** documented as the Ticketing-service contract: FR21, FR22, FR23, FR24, FR26, FR27, FR61. Note FR25 & FR60 are display/consume actions and FR62 is a dispatch action — all [OMNI].)

### 1. Multi-Channel Ingestion & Messaging
- **FR1** [MVP] The system can receive inbound messages from multiple channels (Zalo OA, mobile app, Facebook, email) into a single normalized stream.
- **FR2** [MVP] The system can acknowledge each inbound message immediately upon receipt, independent of downstream processing.
- **FR3** [MVP] The system can detect and discard duplicate inbound messages caused by network retries.
- **FR4** [MVP] The system can normalize messages from different channels into a single common format.
- **FR5** [MVP] The system can send outbound messages to customers on the channel of the original conversation.
- **FR6** [G2] The system can send proactive broadcast notifications to groups of customers across channels.
- **FR7** [MVP] The system can safely retain and automatically retry processing of interactions if ticket creation or routing fails, ensuring no interaction is lost.
- **FR8** [MVP] The system can present conversation messages in their correct chronological order within a thread.

### 2. Unified Agent Workspace
- **FR9** [MVP] Agents can view all inbound conversations across channels in a single unified inbox.
- **FR10** [MVP] Agents can open a conversation and view its full message history and attachments.
- **FR11** [MVP] Agents can reply to a customer within the conversation thread.
- **FR12** [MVP] Agents can see new inbound messages appear in real time without refreshing.
- **FR13** [MVP] Agents can view a consolidated interaction timeline per customer across channels and calls.
- **FR14** [MVP] Agents can access internal knowledge-base articles from within the workspace.
- **FR15** [MVP] The system can display context classification tags (e.g., urgency, topic) and speech-to-text transcripts supplied by external AI assistants directly on the conversation screen.
- **FR16** [MVP] Agents can set their availability status, and the system can route and assign work based on agent availability.
- **FR17** [MVP] Agents can search and filter conversations in the inbox by channel, status, customer, and priority.
- **FR18** [MVP] Agents can close or archive a conversation (distinct from ticket resolution).

### 3. Ticket & SLA (split across two services)

> **Ownership legend:** **[OMNI]** = built in this PRD (Omnichannel service + BFF). **[TKT-SVC]** = owned by the separate **Ticketing & SLA microservice**, documented here as the integration **contract** (built under its own PRD — *not* in this scope). The omnichannel workspace acts on tickets by sending broker events / BFF calls and by consuming events back; it never owns the ticket store, SLA engine, or breach worker.

**3a — Omnichannel-side ticket interaction (built here)**
- **FR19** [MVP·OMNI] Agents can create a ticket from a conversation; the workspace sends a creation request (`TicketCreateRequested`) to the Ticketing & SLA service with conversation + customer context.
- **FR20** [MVP·OMNI] Agents can advance a ticket through its workflow stages (received → in progress → waiting → resolved) from the workspace UI; the state change is proxied through the BFF to the Ticketing & SLA service.
- **FR25** [MVP·OMNI] The system can consume `SlaWarning` events (near/at breach) emitted by the Ticketing & SLA service and surface them in real time to supervisors and the responsible agent (Kanban red-flash + countdown; Inbox SLA chip).
- **FR60** [MVP·OMNI] Agents and supervisors can view a ticket's current state and SLA countdown alongside the conversation and on the Kanban, with data sourced from the Ticketing & SLA service via the BFF.

**3b — Ticketing & SLA service contract (NOT built in this scope — separate microservice)**
- **FR21** [TKT-SVC] The Ticketing & SLA service assigns a unique identifier and responsible owner to each ticket.
- **FR22** [TKT-SVC] The Ticketing & SLA service classifies tickets by type and priority level.
- **FR23** [TKT-SVC] The Ticketing & SLA service applies SLA policies to tickets based on type and priority.
- **FR24** [TKT-SVC] The Ticketing & SLA service continuously monitors open tickets and detects those approaching SLA breach (background breach worker), emitting `SlaWarning`.
- **FR26** [TKT-SVC·G2] The Ticketing & SLA service automatically escalates tickets that breach SLA to a higher authority.
- **FR27** [TKT-SVC·G2] The Ticketing & SLA service automatically reopens a ticket when it receives a `CsatSubmitted` event reporting a rating below threshold.

### 4. Customer Identity & 360° Context
- **FR28** [MVP] The system can resolve a customer's identity from a channel identifier (e.g., Zalo ID, phone number) to a unified customer profile.
- **FR29** [MVP] Agents can view a customer's 360° profile (contract, receivables, consumption history, address) alongside a conversation.
- **FR30** [MVP] The system can handle unrecognized customers via a fallback identification flow without losing the inbound message.
- **FR31** [MVP] Agents can create or link a provisional customer profile when identity cannot be resolved.

### 5. Call Center & Telephony
- **FR32** [MVP] The system can receive incoming calls and route them to available agents.
- **FR33** [MVP] The system can present the caller's customer profile to the agent before the call is answered.
- **FR34** [G2] The system can record calls and retain recordings for a defined period.
- **FR35** [MVP] Agents can access the recording reference of a past call from the interaction history.
- **FR36** [G2] The system can present an interactive voice menu (IVR) and route calls by caller selection.
- **FR37** [G2] The system can route calls by caller geography and agent skill.
- **FR38** [G2] Customers can request a callback from the app and receive it within a target time.

### 6. Knowledge Base & Self-Service
- **FR39** [MVP] Agents can search internal knowledge-base articles by keyword, including Vietnamese diacritics and synonyms.
- **FR40** [G2] Content editors can manage articles through an author → edit → approve → publish workflow with versioning.
- **FR41** [G2] Customers can self-serve answers from the knowledge base without contacting an agent.

### 7. Customer Experience Measurement
- **FR42** [MVP] The system can request a satisfaction (CSAT) rating from a customer after a ticket is closed (triggered by a `TicketClosed` event from the Ticketing service) and emit a `CsatSubmitted` event (consumed by the Ticketing service for auto-reopen — see FR27).
- **FR43** [G2] The system can collect satisfaction ratings across multiple channels.
- **FR44** [G2] The system can measure Net Promoter Score (NPS) through periodic surveys.
- **FR45** [G2] The system can measure Customer Effort Score (CES) for key processes.
- **FR46** [G2] The system can trigger a follow-up contact when a customer rates below threshold (closing the loop).
- **FR47** [G2·OMNI] Customers can track the status of their own ticket via a lookup code (My Công ty App / customer web), with ticket state read from the Ticketing & SLA service via the BFF.
- **FR48** [G2] The system can measure and report the deflection rate (requests resolved via knowledge-base self-service without a ticket or agent).

### 8. Mass-Outage Triage
> **Ownership split:** *detection / clustering* is pre-ticket triage built here **[OMNI]**; the *Parent Incident as a grouping of child tickets* belongs to the **[TKT-SVC]** contract. Agent merge/split actions are OMNI UI actions proxied to the Ticketing service when tickets are involved.
- **FR49** [G2·OMNI] The omnichannel service can detect clusters of near-simultaneous reports from a geographic area (geo radius + time window + incident-type similarity) and propose a parent-incident grouping — pre-ticket triage; the actual grouping of tickets is executed by the Ticketing service (see FR61).
- **FR50** [G2·OMNI] Agents can view all affected reports/customers attached to a parent incident in the workspace (UI; list aggregated via BFF from omnichannel reports + the Ticketing-service grouping).
- **FR51** [G2·OMNI] Agents can split a mis-merged report out of a parent incident from the workspace; when the report has an associated ticket, the regrouping is proxied through the BFF to the Ticketing service.
- **FR52** [G2·OMNI] The system can attach and resolve a geographic location to incident reports at intake (GIS pin); ticket-level geo is persisted by the Ticketing service.
- **FR61** [TKT-SVC·G2] The Ticketing & SLA service maintains the Parent Incident as a grouping of child tickets — attaching, detaching, splitting, and resolving child tickets under a single parent.
- **FR62** [MVP·OMNI] The system can dispatch a Work Order to the Field-team App when a field incident is confirmed — including incident type, priority, geographic location, and photo references — so the field team can act on it. *(MVP — required for the J1 demo and the Sự cố hiện trường screen; the Field-team App is a consumed port.)*

### 9. Operations Dashboard & Supervision
- **FR53** [MVP·OMNI] Supervisors can view real-time operational KPIs on a dashboard (Điều hành CSKH), BFF-aggregated from interaction volume + channel mix (omnichannel), SLA compliance + open-ticket counts (Ticketing service), and CSAT/NPS (omnichannel capture).
- **FR54** [MVP·OMNI] Supervisors can reassign tickets between agents from the workspace; the reassignment is proxied through the BFF to the Ticketing & SLA service.

### 10. Security, Access & Audit
- **FR55** [MVP] The system can authenticate agents and enforce role-based permissions (agent, supervisor, admin).
- **FR56** [MVP] The system can record an audit trail of who did what and when across all interactions.
- **FR57** [MVP] The system can trace a customer interaction end-to-end across all processing steps.
- **FR58** [MVP] The system can restrict access to customer personal data by role.
- **FR59** [MVP] The system can notify callers that a call may be recorded before connecting to an agent.

---

## Non-Functional Requirements

> **How WELL** the system performs — each NFR measurable and testable. Vague quality words from FRs ("real time", "continuously", "target time") are resolved into concrete thresholds here. (24 NFRs across 6 categories; NFR10 split into a [TKT-SVC contract] emit and an [OMNI] render.)

### Performance
- **NFR1** The system shall push a new inbound message to the agent screen within 2 seconds at the 95th percentile.
- **NFR2** The system shall respond to BFF read requests within 500ms at the 95th percentile under normal load.
- **NFR3** The BFF shall return the agent-workspace bootstrap aggregation (session + inbox first page + counters) within 1 second at the 95th percentile, so the delivered frontend can reach interactivity quickly. *(Frontend time-to-interactive itself is owned by the delivered FE — out of scope.)*
- **NFR4** The system shall acknowledge partner webhooks within 200 milliseconds of receipt.
- **NFR5** The system shall enforce rate limiting at the API Gateway (max 50 requests/second per IP or Channel ID) and auto-lock IPs exhibiting anomalous scanning behavior, protecting the public webhook ingress from DDoS and spam.

### Scalability
- **NFR6** The system shall sustain at least 1,000 concurrent users across the ingress and real-time layers with zero dropped messages — during both meter-reading day and widespread-incident peaks.
- **NFR7** The system shall handle 10× load growth with under 10% performance degradation via auto-scaling.

### Reliability & Availability
- **NFR8** The system shall maintain 99.9% uptime during business hours.
- **NFR9** The system shall lose zero inbound messages even when the **Ticketing & SLA service** (or any sibling) is unavailable — via idempotency + DLQ + reconciliation; ticket-create requests queue and replay when the service recovers.
- **NFR10** [TKT-SVC contract] The **Ticketing & SLA service** shall scan open tickets and emit an `SlaWarning` within 60 seconds of a breach threshold being crossed.
- **NFR10b** [OMNI] The omnichannel service shall consume an `SlaWarning` and render it to the agent/supervisor screen within 2 seconds (p95) of receipt from the broker.
- **NFR11** The system shall recover from a single-service failure within 5 minutes via container restart or failover.
- **NFR12** The system shall guarantee RPO < 5 minutes and RTO < 1 hour for core databases via automated backup and Point-in-Time Recovery.
- **NFR13** The system shall carry an end-to-end trace_id across 100% of interactions and emit structured logs for 100% of services.

### Security & Privacy
- **NFR14** The system shall encrypt 100% of customer data in transit (TLS 1.2+) and at rest.
- **NFR15** The system shall enforce role-based access on 100% of customer-data access and record an immutable audit trail for 100% of data-access and state-change events.
- **NFR16** The system shall keep 100% of customer PII and consumption data within Vietnam (on-premise or domestic cloud).
- **NFR17** The system shall retain call recordings for 90 days then auto-purge, and precede 100% of recorded calls with a consent notification.
- **NFR18** The system shall retain all system and audit logs (login, employee PII access) immutably for at least 12 months (Cybersecurity Law 2018).
- **NFR19** The system shall handle customer data access/erasure requests within 72 hours (Decree 13 guideline).

### Accessibility (backend obligation only)
- **NFR20** UI-level WCAG 2.1 AA conformance is owned by the **delivered frontend** and is out of this backend scope. The backend shall serve Knowledge Base and self-tracking **content in a structured, semantic form** (headings, labels, alt-text fields, language tags) that does not preclude the frontend from meeting WCAG 2.1 AA.

### Integration
- **NFR21** The system shall integrate with sibling services (**Ticketing & SLA**, Customer 360, My Công ty, Business Dashboard, Field-team App) via versioned, contract-tested API + broker-event contracts, with consumer-driven contract tests on both sides of the Omnichannel ↔ Ticketing boundary.
- **NFR22** The system shall consume external AI services via adapters with safe degradation (circuit-breaker), and integration failures shall never block inbound message handling.
- **NFR23** The system shall fulfill customer callback requests within 60 seconds.
