---
title: "OmniCare — Wave-3 G2 Stories (Epic 9 + G2 slices of Epics 4, 5, 6)"
document_type: "Dev-ready stories (Growth / Phase 2)"
version: "1.0"
date: "2026-06-24"
source:
  epics: "epics.md (v0.3.2)"
  prd: "prd.md (v1.2)"
  architecture: "architecture.md (v0.3)"
scope: "Wave-3 (G2). Assumes the REAL Ticketing & SLA service is live (wave-2 cutover) — esp. FR61 parent-grouping for Epic 9. Security/auth OUT OF SCOPE (descoped)."
legend: "[G2] phase · FRxx/NFRxx = traceability to PRD · 'Arch' = endpoint/event/module from architecture.md"
note: "Story-file IDs are proposed (extend sprint-status.yaml). Epic 9 stories are newly broken out (were 'not yet broken out')."
---

# Wave-3 G2 Stories

> Prereqs: all wave-1 MVP stories done; **real Ticketing service** live (wave-2). Epic 9 also needs **FR61** (parent-incident grouping) from the Ticketing service.

---

## Epic 4 — Voice Call Handling (G2)
*Covers FR34, FR36, FR37, FR38.*

### Story 4-3 — Call recording capture & retention `[G2]`
**FR34 · (NFR17 descoped)** · Size: M
**As an** operator, **I want** calls recorded and stored with a retention setting, **so that** interactions are reviewable.

**Acceptance Criteria**
- **Given** a connected call, **when** it proceeds, **then** the call is recorded and the recording is stored with a reference on the interaction; agents cannot silently disable recording.
- **Given** a stored recording, **when** retention is configured, **then** records age out per the configured window.

**Tasks**
- Recording capture hook in `telephony`; store + link `recordingRef`.
- Configurable retention job.

**Note:** the 90-day retention *compliance target* (NFR17) is **out of scope** — retention here is a configurable feature, not a validated compliance control.

### Story 4-4 — IVR multi-branch + skill/geo routing `[G2]`
**FR36 · FR37** · Size: L
**As a** caller, **I want** the IVR to route me to the right team, **so that** I reach a relevant agent fast.

**Acceptance Criteria**
- **Given** an inbound call, **when** the caller selects an IVR branch (press 1 incident / 2 billing / 3 new connection / 4 complaint / 0 operator), **then** the call is routed to the matching queue (FR36).
- **Given** a routed call, **when** an agent is selected, **then** routing prefers agent skill and/or the caller's geographic area where available (FR37).

**Tasks**
- IVR branch model + routing rules; queue mapping.
- Skill/geo routing strategy in `telephony`.

**Arch:** `telephony` module; ACD/IVR integration.

### Story 4-5 — App callback (click-to-call) `[G2]`
**FR38 · NFR23** · Size: M
**As a** customer, **I want** to request a callback from the app, **so that** I don't wait on hold.

**Acceptance Criteria**
- **Given** a customer taps "call me back" in the app, **when** the request is received, **then** the system initiates an outbound callback within **60 seconds** (NFR23) at no cost to the customer.
- **Given** all agents busy, **when** callback can't connect, **then** it queues and retries with status visible.

**Tasks**
- Callback request endpoint + queue; outbound dial trigger; SLA timer (≤60s).

**Arch:** `telephony` module; callback queue.

---

## Epic 5 — Knowledge Base (G2)
*Covers FR40, FR41.*

### Story 5-2 — KB CMS authoring workflow `[G2]`
**FR40 · NFR20** · Size: M
**As a** KB editor, **I want** an author→edit→approve→publish workflow with versioning, **so that** content is governed and consistent.

**Acceptance Criteria**
- **Given** a draft article, **when** it moves through author → review → approve → publish, **then** each transition is enforced and the published version is the one served to search.
- **Given** an edited article, **when** republished, **then** prior versions are retained (versioning) and "helpful/not-helpful" feedback is recordable.

**Tasks**
- `kb` CMS state machine + versioning tables; publish → reindex ES.
- Article feedback capture.

### Story 5-3 — Customer self-serve KB `[G2]`
**FR41** · Size: S
**As a** customer, **I want** to search FAQs myself on web/app, **so that** I avoid calling for basic questions.

**Acceptance Criteria**
- **Given** a published KB, **when** a customer searches on the public surface, **then** results are returned with the same Vietnamese-aware search, scoped to customer-visible articles.

**Tasks**
- Public KB search endpoint (customer scope); visibility flag on articles.

---

## Epic 6 — Customer Feedback & Measurement (G2)
*Covers FR43, FR44, FR45, FR46, FR47, FR48.*

### Story 6-2 — Multi-channel CSAT + NPS + CES `[G2]`
**FR43 · FR44 · FR45** · Size: L
**As a** quality owner, **I want** to run CSAT across channels plus periodic NPS and process-level CES, **so that** I measure experience at every touchpoint.

**Acceptance Criteria**
- **Given** a closed interaction, **when** CSAT is sent, **then** the customer can respond via their preferred channel — SMS / Zalo / in-app / email (FR43).
- **Given** the NPS cycle (e.g. 6-monthly), **when** due, **then** an NPS survey is sent to the customer base and scored (FR44).
- **Given** a key process (e.g. new-connection registration), **when** completed, **then** a CES question is asked (FR45).

**Tasks**
- Channel-abstracted survey delivery; NPS scheduler + scoring; CES hooks on key processes.

### Story 6-3 — Closing-the-loop on low scores `[G2]`
**FR46** · Size: M
**As a** CSKH agent, **I want** low scorers flagged for follow-up, **so that** we recover unhappy customers.

**Acceptance Criteria**
- **Given** a CSAT/NPS rating below threshold, **when** submitted, **then** a follow-up task is created for a callback within 24h, and the loop is tracked to closure.

**Tasks**
- Threshold rule → follow-up task; loop-status tracking + reporting.

### Story 6-4 — Customer self-track ticket `[G2]`
**FR47** · Size: S
**As a** customer, **I want** to track my ticket via a lookup code, **so that** I don't have to call to check status.

**Acceptance Criteria**
- **Given** a ticket lookup code, **when** the customer queries (app/web), **then** the current ticket state is read from the Ticketing service via the BFF and shown.

**Tasks**
- BFF customer-scoped ticket-status read; lookup-code resolution.

### Story 6-5 — Deflection measurement `[G2]`
**FR48** · Size: S
**As a** product owner, **I want** to measure KB/self-serve deflection, **so that** I can show reduced call volume.

**Acceptance Criteria**
- **Given** self-serve interactions, **when** a customer resolves via KB/chatbot without an agent, **then** the deflection is recorded and reportable on the dashboard.

**Tasks**
- Deflection event capture; dashboard metric.

---

## Epic 9 — Mass-Outage Triage `[G2]`
*Depends on: Epic 7 intake + Ticketing **FR61** (parent-grouping). Covers FR49, FR50, FR51, FR52.*

### Story 9-1 — Outage detection & clustering `[G2]`
**FR49 · NFR6** · Size: L
**As a** coordinator, **I want** simultaneous reports from one area auto-clustered into a parent, **so that** a burst doesn't flood the queue.

**Acceptance Criteria**
- **Given** a burst of near-simultaneous reports, **when** they share geo radius + time window + incident type, **then** the omnichannel `incident` module clusters them (pre-ticket triage) and proposes a parent grouping; the actual ticket grouping is executed by the Ticketing service (FR61).
- **Given** scale (meter-reading/outage peak), **when** thousands arrive, **then** clustering keeps up under ≥1,000 CCU (NFR6).

**Tasks**
- Clustering by geo+time+type; emit parent-grouping proposal; hand off to Ticketing (FR61) via command.

**Arch:** `incident` (mass-outage clustering); WS `incident.classified`.

### Story 9-2 — Affected-report view on a parent `[G2]`
**FR50** · Size: S
**As a** coordinator, **I want** to see every report attached to a parent incident, **so that** I grasp the blast radius.

**Acceptance Criteria**
- **Given** a parent incident, **when** opened, **then** `GET /bff/incidents` / `:id` returns the affected reports/customers — BFF-joined from omnichannel reports + the Ticketing parent-grouping.

**Tasks**
- BFF join for affected list; pagination for large parents.

### Story 9-3 — Split a mis-merged report `[G2]`
**FR51** · Size: S
**As a** coordinator, **I want** to split a wrongly-merged report out of a parent, **so that** distinct incidents aren't conflated.

**Acceptance Criteria**
- **Given** a report mis-merged into a parent, **when** the coordinator splits it, **then** the regrouping is proxied via the BFF to the Ticketing service (when a ticket is involved) and the affected list updates.

**Tasks**
- BFF split action → Ticketing regroup command; refresh affected view.

### Story 9-4 — GIS pin at intake `[G2]`
**FR52** · Size: M
**As a** coordinator, **I want** incidents pinned on a GIS map, **so that** I can see spatial patterns.

**Acceptance Criteria**
- **Given** a field incident at intake, **when** a location is provided/derived, **then** the omnichannel service attaches and resolves a geo location (GIS pin); ticket-level geo is persisted by the Ticketing service.

**Tasks**
- Geo resolution at intake; GIS-pin data in `GET /bff/incidents/:id`; pass geo to Ticketing.

---

## Wave-3 coverage check
Epic 4 G2: FR34, 36, 37, 38 · Epic 5 G2: FR40, 41 · Epic 6 G2: FR43–48 · Epic 9: FR49–52 → **all G2 FRs in Epics 4–9 mapped.** (FR61 parent-grouping is the Ticketing service's own story, not here.)
