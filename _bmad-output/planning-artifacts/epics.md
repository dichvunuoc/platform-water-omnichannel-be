---
stepsCompleted: [step-01, step-02, step-03-epic-1, step-03-epic-2, step-03-epic-3, step-03-epic-4, step-03-epic-5, step-03-epic-6, step-03-epic-7, step-04-validation]
status: 'complete'
completedAt: '2026-06-04'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
---

# IOC Customer — Module CSKH - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for IOC Customer — Module CSKH, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

- **FR1:** Customer authenticates via Phone/OTP, Zalo ID, or Social login (Google, Facebook, Apple) — no username/password required
- **FR2:** System links 1 Customer with multiple Providers (Phone, Zalo ID, Email) for cross-channel identification
- **FR3:** System issues authenticated token containing customer identity, linked providers, session reference for every authenticated KH
- **FR4:** System auto-refreshes access token on receiving 401 from downstream — KH sees no disruption
- **FR5:** BFF owns Customer Auth DB (PostgreSQL) — stores customer profiles, provider links, tokens
- **FR6:** KH views 360° profile: customer ID, identity info, usage classification, address, contact info
- **FR7:** KH views 360° interaction timeline: contracts → meters → readings → invoices → payments → complaints → multi-channel interactions, ordered chronologically
- **FR8:** KH updates contact info (phone, email, contact address)
- **FR9:** KH views relationship tree (Industrial Zone → member factories), auxiliary contacts
- **FR10:** Each downstream Microservice communicates via Port interface (30 Port Interfaces total: 14 MVP + 12 Phase 2 + 4 Phase 3)
- **FR11:** Adapter implementation is injectable — MockAdapter for development, InternalAdapter for production, ExternalAdapter for SaaS
- **FR12:** Frontend only knows Port schema — never exposed to downstream raw schema
- **FR13:** Adding a new downstream service = adding Port + Adapter — no BFF core modification
- **FR14:** Each Adapter normalizes response to Port schema before returning to frontend
- **FR15:** Mock Adapter toggle: `MOCK_MODE=true` → mock responses, `MOCK_MODE=false` → live calls. Enables parallel BFF + downstream development.
- **FR16:** KH views contract info: address, meter ID, water quota, subscription type, pricing terms, status
- **FR17:** KH views contract version history (versioning)
- **FR18:** KH downloads contract PDF
- **FR19:** System caches contract data with TTL 12-24h (static data)
- **FR20:** KH views meter info: serial, type, diameter (DN), accuracy class, manufacture year
- **FR21:** KH views meter calibration status (valid / expiring soon / expired)
- **FR22:** KH views meter replacement history
- **FR23:** KH views monthly water consumption chart (last 12 months)
- **FR24:** KH views consumption comparison current vs previous period (increase/decrease %)
- **FR25:** KH views period reading detail: previous index, current index, volume, evidence photos
- **FR26:** KH views applicable tariff for their contract (tiered residential / special pricing)
- **FR27:** KH views tiered price breakdown in invoice (m³ × price = subtotal)
- **FR28:** KH views associated fees (environmental, drainage, VAT)
- **FR29:** KH views invoice list with pagination and filter (by month, status)
- **FR30:** KH views invoice detail: line items, tiered pricing, total amount, payment status
- **FR31:** KH downloads electronic invoice PDF (with CQT code, lookup code, digital signature)
- **FR32:** System caches invoice list with TTL 5-15 minutes (dynamic data)
- **FR33:** KH selects invoice → initiates payment → receives QR code or payment link
- **FR34:** BFF receives webhook from Payment Service on successful payment → updates invoice status (cached) → sends notification
- **FR35:** ABSOLUTELY NO CACHING of payment transactions — every payment request must call Payment Service live
- **FR36:** KH views payment history
- **FR37:** KH pays multiple invoices at once
- **FR38:** KH registers automatic direct debit
- **FR39:** KH views current debt: amount, debt period, aging (0-30, 31-60, 61-90, >90 days)
- **FR40:** KH views debt history
- **FR41:** KH fills incident report form: incident type, description, photo upload, location → BFF pushes data to Ticketing Service
- **FR42:** Ticketing Service returns tracking ID → BFF displays to KH
- **FR43:** KH tracks incident status by tracking ID (timeline + ETA like Grab)
- **FR44:** BFF receives webhook from Ticketing Service on status change → sends notification to KH
- **FR45:** KH submits feedback when ticket is closed (CSAT)
- **FR46:** KH views ticket history (closed, in progress)
- **FR47:** KH searches FAQ in Vietnamese (with/without diacritics, synonyms)
- **FR48:** KH views help articles by topic: invoice, meter reading, incidents, payment, new installation
- **FR49:** KH rates article helpful/not helpful
- **FR50:** KH receives area incident notifications (water outage, repairs, quality changes)
- **FR51:** KH views active notifications affecting them
- **FR52:** KH views incident notification history
- **FR53:** KH acknowledges notification
- **FR54:** System sends notifications to KH via appropriate channel (Push, Zalo, SMS, Email) when: new invoice, payment success, incident status update, debt reminder, water cut-off warning
- **FR55:** All notification dispatches MUST route through `DispatchNotificationCommand` → rate limiter (max 2 ZNS msg/KH/ticket/day) → channel dispatcher
- **FR56:** KH manages notification preferences (select channels, enable/disable notification types)
- **FR57:** KH views received notification history
- **FR58:** KH uploads incident photos (camera capture + gallery selection)
- **FR59:** KH uploads documents (onboarding — Phase 2)
- **FR60:** System generates presigned URL for upload → does not expose storage credentials to frontend
- **FR61:** System records every KH interaction into session store with event type, timestamp, content — 100% interactions recorded within 1 second
- **FR62:** System automatically continues session when KH switches channels — based on Customer ID, not channel
- **FR63:** Session has TTL 24-48h. Redis AOF persistence mandatory — sessions survive restart.
- **FR64:** Session writes MUST be atomic — using Redis Lua script
- **FR65:** System detects downstream service down via Circuit Breaker (per-service, per-Port) → auto-fallback to cached data
- **FR66:** System always returns response to KH — even when downstream is down (cached or queued message)
- **FR67:** System caches data with tiered TTL: static 12-24h, dynamic 5-15 min, transaction no cache
- **FR68:** System logs warning when Circuit Breaker opens or fallback activates
- **FR69:** Inbound idempotency: Every NormalizedRequest must carry `idempotencyKey`. Check Redis before processing. Duplicate key → return cached result.
- **FR70:** Outbound idempotency: Every BFF → downstream POST/PUT call must include `x-idempotency-key` header.
- **FR71:** Zalo inbound webhook: HMAC SHA-256 body verification
- **FR72:** Internal webhooks (Payment/Ticketing): Static API key verification. No JWT for inter-service webhooks.

### NonFunctional Requirements

- **NFR-P1:** BFF response time (excluding downstream latency) < 200ms (p95)
- **NFR-P2:** Customer Auth latency (login → token ready) < 500ms (p95)
- **NFR-P3:** Page load (KH opens App → data displays) < 3 seconds
- **NFR-P4:** Downstream timeout 3 seconds (configurable per Port)
- **NFR-P5:** Support 500 concurrent customer sessions
- **NFR-P6:** Aggregation latency (multi-service calls) < 500ms additional
- **NFR-S1:** Customer personal data encrypted at rest with AES-256
- **NFR-S2:** Data encrypted in transit with TLS 1.3
- **NFR-S3:** API keys/secrets stored in env vars — zero hardcoded secrets
- **NFR-S4:** Access token TTL 15 minutes
- **NFR-S5:** Refresh token TTL 7 days
- **NFR-S6:** Audit log for all KH data access actions
- **NFR-S7:** Audit log retention ≥ 12 months
- **NFR-S8:** PII masking via pino-redact — 100% PII paths redacted
- **NFR-R1:** Multi-channel uptime (App + Web + Zalo) ≥ 99.5%
- **NFR-R2:** Total outage 0% — KH always receives response
- **NFR-R3:** Circuit Breaker detection latency < 10 seconds
- **NFR-R4:** Session survives Redis restart — 100% preserved (AOF enabled)
- **NFR-SC1:** Horizontal scaling ≥ 0.8x throughput per additional pod
- **NFR-SC2:** Adding Port/Adapter requires 0 core code change
- **NFR-SC3:** Adapter swap has < 5% performance delta
- **NFR-I1:** Port response schema validation — 100% match OpenAPI spec (CI/CD gate)
- **NFR-I2:** Downstream API change notification before deployment
- **NFR-I3:** Zalo OA API compliance
- **NFR-I4:** Webhook verification (HMAC + API key) — 100% inbound webhooks verified
- **NFR-I5:** Mock Adapter coverage — 100% Port Interfaces have MockAdapter

### Additional Requirements

**From Architecture — Technical Infrastructure:**
- Brownfield NestJS 11 project — DDD/CQRS foundation already exists in `libs/core/` and `libs/shared/`. No greenfield starter needed.
- New `libs/shared/port/` layer: Port Registry, base adapter classes, per-port CB/cache wrapper (P0 priority)
- New `libs/shared/endpoint-config/`: YAML config + chokidar hot-reload for mock/live switching
- New `libs/shared/auth-propagation/`: JWT signing via jose library
- 30 Port Interfaces total: 14 MVP + 12 Phase 2 + 4 Phase 3, each with mock/live adapters
- Mock Data Strategy: 24 JSON datasets with Zod schema validation, CI/CD contract validation gate
- Session Store: Redis Hash + Sorted Set + Lua script for atomic session event writes
- Aggregation Service: Promise.allSettled for fan-out with partial failure handling

**From Architecture — Existing Infrastructure to Leverage (~60-70% already built):**
- DDD Core Library (`libs/core/`) — AggregateRoot, VOs, Specs, Repos
- CQRS Infrastructure (`libs/shared/cqrs/`) — Command/Query buses, event bus, idempotency
- Redis Cache Service (`libs/shared/caching/`) — Full get/set/mget/mset/delete/expire
- Drizzle ORM + PostgreSQL (`libs/shared/database/`) — Schema, UnitOfWork, Transactional Outbox
- Circuit Breaker State (`libs/shared/resilience/`) — CircuitBreakerState + FallbackProvider
- Pino Structured Logging (`libs/shared/logging/`)
- Correlation ID Middleware (`libs/shared/context/`)
- Health Check Endpoints (`libs/shared/health/`)
- OpenTelemetry (`libs/shared/observability/`)
- Reference Modules (`modules/order/`, `modules/product/`)

**From Architecture — Implementation Sequence:**
- Phase 1: Infrastructure Foundation (Week 1-2) — Docker Compose, Port Infrastructure, Endpoint Config, Auth Propagation, Mock Data
- Phase 2: MVP Domain Modules (Week 3-6) — Auth, Session, Input Adapters, Customer, Contract, Meter, Billing, Payment, Ticket, Communication, Document
- Phase 3: Integration & Testing (Week 7-8) — Webhook integration, E2E tests for Context Preservation, Port Registry, Circuit Breaker, Aggregation
- Phase 4: Growth/Phase 2 Services (Month 3-6) — 12 additional modules
- Phase 5: Vision/Phase 3 Services (Month 7+) — 4 additional modules

### FR Coverage Map

FR1: Epic 1 — Customer authenticates via Phone/OTP, Zalo, Social login
FR2: Epic 1 — Multi-provider linking for cross-channel identification
FR3: Epic 1 — Authenticated token issued with customer identity
FR4: Epic 1 — Auto-refresh access token on 401 from downstream
FR5: Epic 1 — BFF owns Customer Auth DB (PostgreSQL)
FR6: Epic 2 — KH views 360° profile
FR7: Epic 2 — KH views 360° interaction timeline
FR8: Epic 2 — KH updates contact info
FR9: Epic 2 — KH views relationship tree
FR10: Epic 1 — Each downstream Microservice communicates via Port interface (30 Ports)
FR11: Epic 1 — Adapter implementation injectable (Mock/Internal/External)
FR12: Epic 1 — Frontend only knows Port schema
FR13: Epic 1 — New service = new Port + Adapter, no core change
FR14: Epic 1 — Adapter normalizes response to Port schema
FR15: Epic 1 — Mock Adapter toggle (MOCK_MODE)
FR16: Epic 2 — KH views contract info
FR17: Epic 2 — KH views contract version history
FR18: Epic 2 — KH downloads contract PDF
FR19: Epic 2 — System caches contract data (TTL 12-24h)
FR20: Epic 2 — KH views meter info
FR21: Epic 2 — KH views meter calibration status
FR22: Epic 2 — KH views meter replacement history
FR23: Epic 3 — KH views monthly consumption chart (12 months)
FR24: Epic 3 — KH views consumption comparison vs previous period
FR25: Epic 3 — KH views period reading detail
FR26: Epic 3 — KH views applicable tariff
FR27: Epic 3 — KH views tiered price breakdown in invoice
FR28: Epic 3 — KH views associated fees
FR29: Epic 3 — KH views invoice list with pagination/filter
FR30: Epic 3 — KH views invoice detail
FR31: Epic 3 — KH downloads e-invoice PDF
FR32: Epic 3 — System caches invoice list (TTL 5-15 min)
FR33: Epic 4 — KH initiates payment, receives QR/link
FR34: Epic 4 — BFF receives payment webhook → updates invoice + notification
FR35: Epic 4 — NO CACHING of payment transactions
FR36: Epic 4 — KH views payment history
FR37: Epic 4 — KH pays multiple invoices at once
FR38: Epic 4 — KH registers auto debit
FR39: Epic 4 — KH views current debt with aging
FR40: Epic 4 — KH views debt history
FR41: Epic 5 — KH fills incident report form
FR42: Epic 5 — Ticketing Service returns tracking ID
FR43: Epic 5 — KH tracks incident status by tracking ID
FR44: Epic 5 — BFF receives ticket status webhook → notification
FR45: Epic 5 — KH submits CSAT feedback on closed ticket
FR46: Epic 5 — KH views ticket history
FR47: Epic 5 — KH searches FAQ in Vietnamese
FR48: Epic 5 — KH views help articles by topic
FR49: Epic 5 — KH rates article helpful/not helpful
FR50: Epic 6 — KH receives area incident notifications
FR51: Epic 6 — KH views active notifications
FR52: Epic 6 — KH views incident notification history
FR53: Epic 6 — KH acknowledges notification
FR54: Epic 6 — System sends multi-channel notifications
FR55: Epic 6 — DispatchNotificationCommand with rate limiter
FR56: Epic 6 — KH manages notification preferences
FR57: Epic 6 — KH views notification history
FR58: Epic 5 — KH uploads incident photos
FR59: Epic 5 — KH uploads documents (Phase 2)
FR60: Epic 5 — Presigned URL for upload
FR61: Epic 7 — Session store records every KH interaction
FR62: Epic 7 — Auto session continuation on channel switch
FR63: Epic 7 — Session TTL 24-48h, Redis AOF persistence
FR64: Epic 7 — Atomic session writes via Lua script
FR65: Epic 1 — Circuit Breaker per-service/per-Port → fallback to cached data
FR66: Epic 1 — System always returns response (even downstream down)
FR67: Epic 1 — Tiered cache TTL (static/dynamic/transaction)
FR68: Epic 1 — CB open/fallback warning logs
FR69: Epic 1 — Inbound idempotency (Redis check before processing)
FR70: Epic 1 — Outbound idempotency (x-idempotency-key header)
FR71: Epic 7 — Zalo webhook HMAC SHA-256 verification
FR72: Epic 7 — Internal webhook static API key verification

## Epic List

### Epic 1: Customer Identity & Resilient Foundation (17 FRs)
"I can sign in securely, and every call I make is protected."
**FRs covered:** FR1–FR5, FR10–FR15, FR65–FR70

### Epic 2: My Water Account (11 FRs)
"I can see my full profile, contracts, and meter information."
**FRs covered:** FR6–FR9, FR16–FR22

### Epic 3: Consumption & Billing (10 FRs)
"I can understand my water usage, pricing, and view my invoices."
**FRs covered:** FR23–FR32

### Epic 4: Payments & Financial Management (8 FRs)
"I can pay my bills online and track my debts."
**FRs covered:** FR33–FR40

### Epic 5: Issue Reporting & Self-Service (12 FRs)
"I can report problems with photos and find answers myself."
**FRs covered:** FR41–FR49, FR58–FR60

### Epic 6: Notifications & Proactive Alerts (8 FRs)
"I stay informed about outages, payments, and what matters to me."
**FRs covered:** FR50–FR57

### Epic 7: Omnichannel Context & Security Polish (6 FRs)
"My experience continues where I left off, across any channel."
**FRs covered:** FR61–FR64, FR71–FR72

## Epic 1: Customer Identity & Resilient Foundation

**Goal:** KH can authenticate and every downstream call is protected from day one. The Port Registry ships with Circuit Breaker, tiered caching, and idempotency baked in — all future epics inherit resilient communication automatically.

### Story 1.1: Hexagonal Port Infrastructure

As a **platform developer**,
I want a centralized Port Registry with injectable adapters and endpoint configuration,
So that every downstream service call goes through a standardized, configurable interface that supports mock/live switching.

**Acceptance Criteria:**

**Given** the BFF application starts up
**When** the PortRegistry initializes
**Then** it registers all configured ports from `api-endpoints.yaml`
**And** each port resolves to either MockAdapter or InternalAdapter based on the `adapter` config field.

**Given** `MOCK_MODE=true` in the environment
**When** any module calls `PortRegistry.execute()`
**Then** the system **forces** the use of MockAdapter regardless of individual endpoint configs in `api-endpoints.yaml`, reads from `mocks/{port}/{method}.json`, validates against the Zod schema, and returns the normalized Port schema to the frontend.

**Given** the `api-endpoints.yaml` file is modified (e.g. adapter: mock → live)
**When** the chokidar file watcher detects the change
**Then** the EndpointConfigService reloads config for that port in < 100ms
**And** the next request uses the updated adapter without restart.

**Given** a developer needs to add a new downstream service
**When** they create a new Port interface + MockAdapter + config entry
**Then** the new port is available via `PortRegistry.execute()` with zero changes to BFF core
**And** the existing port infrastructure (EndpointConfig, Port module) is unaffected.

**Given** the `api-endpoints.yaml` has per-service timeout configuration
**When** a port call exceeds the configured timeout (default 3000ms)
**Then** the call is aborted and the timeout error is logged with correlation ID.

**Given** the BFF application bootstraps in a non-production environment
**When** any `mocks/*.json` file fails to match its defined Zod schema (OpenAPI contract)
**Then** the application throws a fatal error and **fails to start**, logging the exact schema mismatch details.

### Story 1.2: Resilient Communication Layer

As a **customer using the app**,
I want every API call to be protected against downstream failures and duplicate processing,
So that I always get a response even when a backend service is down, and I never get charged twice for the same payment.

**Acceptance Criteria:**

**Given** a downstream service (e.g. Invoice Service) starts returning 5xx errors or timing out
**When** the failure rate exceeds 50% within the configured window (default 10s, min 5 requests)
**Then** the per-port Circuit Breaker opens for that specific port only
**And** subsequent calls fallback to cached data (if available) or a graceful message
**And** other ports (Payment, Ticketing, etc.) remain fully operational — unaffected.

**Given** the Circuit Breaker is OPEN for a port
**When** a KH requests data from that port (e.g. invoice list)
**Then** the system returns the last cached response with a timestamp label (e.g. "updated at 14:30")
**And** a structured warning is logged with correlation ID and port name.

**Given** the Circuit Breaker is OPEN for a port
**When** the reset timeout elapses (default 10s)
**Then** the Circuit Breaker transitions to HALF-OPEN
**And** sends a single probe request — if successful, closes the circuit; if failed, re-opens.

**Given** port config specifies `cacheTier: static` (e.g. contract, tariff)
**When** a successful response is received
**Then** the response is cached with TTL 12-24h in Redis key `cache:port:{portName}:{hash}`.

**Given** port config specifies `cacheTier: dynamic` (e.g. invoice, ticket)
**When** a successful response is received
**Then** the response is cached with TTL 5-15 min in Redis.

**Given** port config specifies `cacheTier: none` (e.g. payment, document)
**When** a call is made
**Then** no caching occurs — every request hits the downstream service live.

**Given** an inbound webhook request arrives (e.g. Zalo callback)
**When** the `idempotencyKey` is extracted (hash of messageId/callId)
**Then** Redis `GET idempotency:{hash}` is checked first
**And** if EXISTS → return cached response (200 OK, no reprocessing)
**And** if NOT EXISTS → process normally → `SET idempotency:{hash} = result` with TTL 24h.

**Given** an outbound POST/PUT call from BFF to any downstream service
**When** the request is constructed
**Then** the `x-idempotency-key` header is automatically injected as `{correlationId}:{endpointHash}`
**And** the header is included in every PortHttpClient outbound call.

### Story 1.3: Customer Registration & Multi-Provider Auth

As a **customer (Anh Tuấn / Cô Nguyễn)**,
I want to register and sign in using my phone number, Zalo account, or social media,
So that I can access my water service information without creating yet another username/password.

**Acceptance Criteria:**

**Given** a new customer opens the My Công ty App
**When** they choose "Sign in with Phone Number" and enter a valid Vietnamese mobile number
**Then** the system sends an OTP to that number
**And** upon successful OTP verification, a new User record is created in PostgreSQL (BFF-owned DB)
**And** the customer's phone number is stored as a linked Provider.

**Given** a customer chooses "Sign in with Zalo"
**When** Zalo OAuth flow completes and returns the Zalo ID
**Then** the system creates a User record with Zalo as linked Provider
**And** if the Zalo profile includes a verified phone number (requires explicit `phone_number` scope request during Zalo OAuth/OA flow and user consent), the system checks for an existing User with that phone number and merges the Zalo Provider under the same UserID
**And** if the phone number scope is denied or unavailable, the Zalo account is created as a standalone User — merging can be performed later via manual account linking.

**Given** a customer chooses "Sign in with Google/Facebook/Apple"
**When** the social OAuth flow completes
**Then** the system creates a User record with the social Provider linked
**And** if the social email matches an existing user, the providers are merged under the same UserID.

**Given** an existing customer has authenticated via Phone/OTP
**When** they later sign in via Zalo using the same phone number
**Then** the system recognizes the match **only if the Zalo OAuth flow successfully obtained the `phone_number` scope with user consent**
**And** if matched, links the Zalo Provider to the existing User record
**And** both Phone and Zalo now resolve to the same UserID — enabling cross-channel identification.

**Given** the BFF Auth DB (PostgreSQL) is initialized
**When** the application starts
**Then** the `users` table and `provider_links` table are migrated via Drizzle
**And** User entity follows existing DDD patterns (extends `Entity` from `libs/core/`)
**And** all PII fields (phone, email) are stored encrypted at rest (AES-256, NFR-S1).

### Story 1.4: Authenticated Token Lifecycle

As a **customer using any channel (App/Web/Zalo)**,
I want to stay authenticated without noticing token expiration,
So that I can use the service continuously without being logged out mid-task.

**Acceptance Criteria:**

**Given** a customer successfully authenticates (via any provider from Story 1.3)
**When** the auth flow completes
**Then** **better-auth** manages the frontend session: issuing and storing a 7-day refresh token for silent renewal on the BFF↔Frontend boundary
**And** when `PortHttpClient` makes a downstream call, **jose** dynamically generates a 15-minute JWT on the fly containing: `sub` (UserID), `roles`, `provider` (channel), `session_id`, `xi_nghiep`, `iat`, `exp`
**And** these are **two separate token systems**: better-auth for frontend session management, jose for BFF→downstream identity propagation — they must not be conflated.

**Given** an authenticated customer makes a request to a downstream service
**When** the downstream service returns HTTP 401 (expired/invalid token)
**Then** the BFF Auth Propagation middleware automatically refreshes the jose JWT (using better-auth session to re-issue) and retries the downstream call once
**And** the customer experiences zero disruption.

**Given** the auto-refresh attempt also fails (better-auth session expired)
**When** the retry returns 401
**Then** the system returns a structured 401 response to the frontend with a clear "session expired" message
**And** the frontend can prompt re-authentication.

**Given** a customer has an active session on Web and opens the Zalo channel
**When** both channels share the same UserID (via multi-provider linking from Story 1.3)
**Then** both channels can operate concurrently with valid tokens
**And** each channel's jose JWT carries the `provider` field identifying the source channel.

**Given** a downstream service call is made
**When** the request is constructed by PortHttpClient
**Then** the `Authorization: Bearer {joseJWT}` header is automatically injected
**And** the `x-correlation-id` header is included for distributed tracing.

## Epic 2: My Water Account

**Goal:** KH can see their full profile, contracts, and meter information — complete visibility into their water service relationship without calling the hotline.

### Story 2.1: Customer Profile 360°

As a **customer (Anh Tuấn)**,
I want to view my complete profile with all interactions in one place,
So that I have full visibility into my water service relationship without calling the hotline.

**Acceptance Criteria:**

**Given** an authenticated customer navigates to "My Profile"
**When** the BFF receives the request
**Then** it calls `ICustomerProfilePort.getProfile(customerId)` via PortRegistry
**And** returns the 360° profile: customer ID, identity info, usage classification (sinh hoạt/sản xuất/hành chính), full address, contact info
**And** the response uses the Port schema (normalized, not raw downstream format).

**Given** an authenticated customer views their profile
**When** they navigate to the "Interaction Timeline" tab
**Then** the BFF calls `ICustomerProfilePort.getTimeline(customerId, filters)` via PortRegistry
**And** returns a chronological timeline: contracts → meters → readings → invoices → payments → complaints → multi-channel interactions
**And** each timeline entry includes timestamp, event type, channel, and a brief summary.

**Given** an authenticated customer views their profile
**When** they tap "Edit Contact Info" and submit changes
**Then** the BFF sends `ICustomerProfilePort.updateProfile(customerId, data)` via PortRegistry with `useCache: false`
**And** upon success, the system **explicitly invalidates** the cached profile by calling `RedisCacheService.delete('cache:port:customer-profile:{hash}')`
**And** immediately calls `ICustomerProfilePort.getProfile(customerId)` again (with `useCache: false`) to populate Redis with fresh data
**And** returns the updated profile to the frontend — customer sees the new info immediately, not after 12 hours.

**Given** a customer belonging to an Industrial Zone (KCN) relationship tree
**When** they navigate to "Related Accounts"
**Then** the BFF calls `ICustomerProfilePort.getRelatedAccounts(customerId)`
**And** displays the relationship tree (KCN → member factories) and auxiliary contact persons.

**Given** the Customer Profile service is down
**When** the BFF attempts to fetch the profile
**Then** the Circuit Breaker (from Story 1.2) opens and returns cached profile data
**And** the customer sees their profile with a "last updated" timestamp.

### Story 2.2: Contract Lookup & Management

As a **customer (Cô Nguyễn)**,
I want to view my water service contract details including terms and history,
So that I understand what I signed up for without digging through paper documents.

**Acceptance Criteria:**

**Given** an authenticated customer navigates to "My Contracts"
**When** the BFF receives the request
**Then** it calls `IContractPort.getContracts(customerId)` via PortRegistry
**And** returns a list of contracts with: address, meter ID, water quota, subscription type, pricing terms, status (active/expired/terminated).

**Given** an authenticated customer selects a specific contract
**When** they tap "View Details"
**Then** the BFF calls `IContractPort.getContractDetail(contractId)`
**And** returns the full contract: all fields above plus detailed pricing terms and special conditions.

**Given** an authenticated customer views a contract
**When** they tap "Version History"
**Then** the BFF calls `IContractPort.getContractVersions(contractId)`
**And** returns a chronological list of contract versions with change descriptions.

**Given** an authenticated customer views a contract
**When** they tap "Download PDF"
**Then** the BFF calls `IContractPort.getContractPDF(contractId)`
**And** returns a downloadable PDF (binary stream or presigned URL).

**Given** contract data is fetched successfully
**When** the response is cached
**Then** the cache key follows `cache:port:contract:{hash}` with TTL 12-24h (static tier, per Story 1.2).

### Story 2.3: Meter Information & History

As a **customer (Anh Tuấn)**,
I want to see my water meter details and calibration status,
So that I know my meter is working correctly and legally compliant.

**Acceptance Criteria:**

**Given** an authenticated customer navigates to "My Meter"
**When** the BFF receives the request
**Then** it calls `IMeterPort.getMeterByCustomer(customerId)` via PortRegistry
**And** returns meter info: serial number, type, diameter (DN), accuracy class, manufacture year.

**Given** an authenticated customer views their meter info
**When** the calibration section loads
**Then** the BFF calls `IMeterPort.getCalibrationStatus(meterId)`
**And** returns the calibration status: valid / expiring soon / expired
**And** if expired or expiring soon, a warning badge is displayed to the customer.

**Given** an authenticated customer views their meter info
**When** they tap "Replacement History"
**Then** the BFF calls `IMeterPort.getMeterHistory(meterId)`
**And** returns a chronological list of meter installations, removals, and replacements with dates.

**Given** meter data is fetched successfully
**When** the response is cached
**Then** the cache key follows `cache:port:meter:{hash}` with TTL 12-24h (static tier).

## Epic 3: Consumption & Billing

**Goal:** KH can understand their water usage patterns, see how pricing works, and view/download official invoices. BFF performs data aggregation & transformation (e.g. calculating percentage change from raw consumption numbers) — this is presentation logic, not business logic.

### Story 3.1: Consumption History & Charts

As a **customer (Anh Tuấn)**,
I want to see my water consumption over time with visual charts and comparisons,
So that I can spot trends, detect unusual usage, and understand my water bill.

**Acceptance Criteria:**

**Given** an authenticated customer navigates to "Water Consumption"
**When** the BFF receives the request
**Then** it calls `IMeterReadingPort.getReadings(customerId, 12)` via PortRegistry
**And** returns 12 months of consumption data suitable for chart rendering (month, volume in m³).

**Given** an authenticated customer views their consumption chart
**When** the comparison data loads
**Then** the BFF calls `IMeterReadingPort.getComparison(customerId, currentPeriod, previousPeriod)`
**And** returns: current period volume, previous period volume, and the percentage change (↑/↓)
**And** if the Backend returns raw volumes only (e.g. 18m³ vs 20m³), BFF calculates the percentage: `(current - previous) / previous × 100` — this is presentation transformation, not business logic.

**Given** an authenticated customer selects a specific month in the chart
**When** they tap to view detail
**Then** the BFF calls `IMeterReadingPort.getReadingDetail(customerId, period)`
**And** returns: previous index, current index, volume consumed, and evidence photo URLs (if available).

**Given** the Meter Reading service is down
**When** the BFF attempts to fetch consumption data
**Then** the Circuit Breaker returns cached data with a "last updated" timestamp
**And** if no cache exists, returns a graceful "Consumption data temporarily unavailable" message.

### Story 3.2: Tariff & Pricing Display

As a **customer (Cô Nguyễn)**,
I want to understand how my water bill is calculated — the tiered pricing, fees, and total breakdown,
So that I'm never surprised by my bill amount.

**Acceptance Criteria:**

**Given** an authenticated customer navigates to "My Pricing"
**When** the BFF receives the request
**Then** it calls `ITariffPort.getTariffPlan(contractId)` via PortRegistry
**And** returns the applicable tariff plan: tiered pricing table (residential bậc thang or special pricing for industrial), tier ranges (m³), price per tier.

**Given** an authenticated customer views an invoice with tiered pricing
**When** they tap "Price Breakdown"
**Then** the BFF calls `ITariffPort.getTariffBreakdown(invoiceId)`
**And** returns each tier: volume (m³) × price = subtotal, total before fees.

**Given** an authenticated customer views the tariff breakdown
**When** the fees section loads
**Then** the BFF calls `ITariffPort.getApplicableFees(contractId)`
**And** returns: environmental fee, drainage fee, VAT percentage, and any special surcharges.

**Given** tariff data is fetched successfully
**When** the response is cached
**Then** the cache key follows `cache:port:tariff:{hash}` with TTL 12-24h (static tier).

### Story 3.3: Invoice List, Detail & Download

As a **customer (Anh Tuấn)**,
I want to view my invoices, see the full breakdown, and download the official e-invoice PDF,
So that I can review what I owe and keep records for tax/business purposes.

**Acceptance Criteria:**

**Given** an authenticated customer navigates to "My Invoices"
**When** the BFF receives the request with pagination params and optional filters (month, status)
**Then** it calls `IInvoicePort.getList(customerId, filters)` via PortRegistry
**And** returns a paginated list of invoices: invoice ID, period, total amount, payment status, issue date.

**Given** an authenticated customer selects an invoice from the list
**When** they tap "View Detail"
**Then** the BFF calls `IInvoicePort.getById(invoiceId)`
**And** returns: full line items with tiered pricing breakdown, total amount, payment status, CQT code, lookup code.

**Given** an authenticated customer views an invoice detail
**When** they tap "Download PDF"
**Then** the BFF calls `IInvoicePort.getPDF(invoiceId)`
**And** returns the electronic invoice PDF with: CQT code, lookup code, digital signature — compliant with Nghị định 123/2020/NĐ-CP.

**Given** invoice data is fetched successfully
**When** the response is cached
**Then** the cache key follows `cache:port:invoice:{hash}` with TTL 5-15 minutes (dynamic tier)
**And** when a payment webhook is received (Epic 4), the invoice cache for that customer is invalidated.

## Epic 4: Payments & Financial Management

**Goal:** KH can pay bills online and track their debts — the money flow. Payment transactions are NEVER cached. Cache invalidation on payment events uses pattern-based purge (SCAN + DEL) to ensure zero stale data.

### Story 4.1: Payment Initiation & QR Generation

As a **customer (Anh Tuấn)**,
I want to select an invoice and get a QR code or payment link to pay instantly,
So that I can settle my water bill in under 60 seconds.

**Acceptance Criteria:**

**Given** an authenticated customer views an unpaid invoice
**When** they tap "Pay Now"
**Then** the BFF calls `IInvoicePort.getById(invoiceId)` with `useCache: false` to verify the invoice exists and is unpaid
**And** then calls `IPaymentPort.createPayment(invoiceId, method)` via PortRegistry
**And** returns the payment QR code or payment link to the frontend.

**Given** a payment request is made
**When** the PortRegistry processes the call
**Then** the payment port uses `cacheTier: none` — the request **always** hits the Payment Service live (FR35: ABSOLUTELY NO CACHING)
**And** no payment data is ever stored in Redis cache.

**Given** the Payment Service is down or times out
**When** the BFF attempts to create a payment
**Then** the Circuit Breaker opens for the payment port
**And** returns a graceful error: "Payment service temporarily unavailable. Please try again in a moment."
**And** does NOT return any cached payment data (because none exists).

**Given** the BFF makes an outbound payment creation call
**When** the request is constructed
**Then** the `x-idempotency-key` header is injected (per Story 1.2, FR70)
**And** duplicate payment creation requests with the same idempotency key return the original payment result.

### Story 4.2: Payment Webhook & Confirmation

As a **customer (Anh Tuấn)**,
I want to receive instant confirmation when my payment succeeds,
So that I know my bill is settled without waiting or calling to check.

**Acceptance Criteria:**

**Given** the Payment Service completes a payment transaction
**When** it sends a webhook to `POST /webhooks/payment/ipn`
**Then** the BFF verifies the webhook using `InterServiceApiKeyGuard` (static API key, FR72)
**And** extracts: payment ID, invoice ID, amount, status (success/failed).

**Given** a successful payment webhook is received
**When** the BFF processes it
**Then** it performs a **pattern-based cache purge**: `SCAN` + `DEL` matching `cache:port:invoice:{customerId}:*` and `cache:port:debt:{customerId}:*` to wipe **all** invoice and debt cache keys for that customer (not just a single hash — a customer may have dozens of cached keys from different filter combinations)
**And** records a session event: `{ type: "payment_completed", invoiceId, amount }`
**And** dispatches a notification to the customer via `DispatchNotificationCommand` (Epic 6).

**Given** a failed payment webhook is received
**When** the BFF processes it
**Then** it logs the failure with correlation ID and payment details (PII redacted)
**And** dispatches a "payment failed" notification to the customer.

**Given** a duplicate payment webhook arrives (same payment ID)
**When** the idempotency check runs (FR69)
**Then** the BFF returns 200 OK without reprocessing — no duplicate notifications, no duplicate cache invalidation.

### Story 4.3: Payment History & Multi-Invoice Payment

As a **customer (KCN Cẩm Phả — business customer)**,
I want to view my payment history and pay multiple invoices at once,
So that I can manage my business's water bills efficiently.

**Acceptance Criteria:**

**Given** an authenticated customer navigates to "Payment History"
**When** the BFF receives the request
**Then** it calls `IPaymentPort.getPaymentHistory(customerId, filters)` via PortRegistry
**And** returns a paginated list: payment ID, invoice IDs, amount, method, status, timestamp.

**Given** an authenticated customer selects multiple unpaid invoices
**When** they tap "Pay All"
**Then** the BFF calls `IPaymentPort.createBatchPayment(invoiceIds, method)` via PortRegistry
**And** returns a single QR code or payment link covering all selected invoices.

**Given** a batch payment webhook is received
**When** the BFF processes it
**Then** it invalidates cache for all invoices in the batch via pattern-based purge (per Story 4.2)
**And** dispatches a single notification summarizing the total amount paid.

### Story 4.4: Auto Debit Registration

As a **customer (Cô Nguyễn)**,
I want to register my bank account for automatic bill payment,
So that I never miss a payment deadline and avoid late fees.

**Acceptance Criteria:**

**Given** an authenticated customer navigates to "Auto Debit Setup"
**When** they submit their bank account details
**Then** the BFF calls `IPaymentPort.setupAutoDebit(customerId, bankAccount)` via PortRegistry with `cacheTier: none`
**And** returns the registration status (pending verification / active).

**Given** auto debit registration uses sensitive bank data
**When** the request is processed
**Then** the dev **must update the global pino-redact paths** in the Pino configuration (defined in Architecture → Security Measures) to include: `*.bankAccount`, `*.cardNumber`, `*.cvv` — not just handle masking locally in this handler
**And** all bank account fields are redacted as `[REDACTED]` in every log across the entire application
**And** the outbound call includes `x-idempotency-key` to prevent duplicate registrations.

### Story 4.5: Debt Overview & History

As a **customer (Anh Tuấn)**,
I want to see what I owe, how overdue it is, and my full debt history,
So that I can prioritize which bills to pay first.

**Acceptance Criteria:**

**Given** an authenticated customer navigates to "My Debt"
**When** the BFF receives the request
**Then** it calls `IDebtPort.getOutstandingDebt(customerId)` via PortRegistry
**And** returns: total outstanding amount, broken down by aging bucket (0-30 days, 31-60 days, 61-90 days, >90 days)
**And** each debt entry includes: invoice reference, amount, due date, aging bucket.

**Given** an authenticated customer navigates to "Debt History"
**When** the BFF receives the request
**Then** it calls `IDebtPort.getDebtHistory(customerId)` via PortRegistry
**And** returns a chronological list of all debt records with payment status.

**Given** debt data is fetched successfully
**When** the response is cached
**Then** the cache key follows `cache:port:debt:{hash}` with TTL 5-15 minutes (dynamic tier)
**And** when a payment webhook is received (Story 4.2), **all** debt cache keys for that customer are purged via pattern `cache:port:debt:{customerId}:*`.

## Epic 5: Issue Reporting & Self-Service

**Goal:** KH can report problems with photos and find answers themselves — the support ecosystem. BFF is a pass-through shell: it does NOT own search logic, file lifecycle management, or business rules. Document upload uses presigned URLs (BFF never touches file binary). Cache invalidation uses pattern-based purge.

### Story 5.1: Incident Report Submission

As a **customer (Anh Tuấn)**,
I want to report a water issue with photos and get a tracking ID immediately,
So that I know my problem is being handled without waiting on hold.

**Acceptance Criteria:**

**Given** an authenticated customer taps "Report Issue"
**When** the incident form loads
**Then** they can select incident type (water outage, leak, water quality, meter issue, other), enter description, and optionally attach photos.

**Given** a customer attaches photos to the incident report
**When** they select images (camera capture or gallery)
**Then** the BFF calls `IDocumentPort.getUploadUrl(fileType, metadata)` to get presigned URLs pointing to a **temporary storage bucket** (Document Service responsibility)
**And** the frontend uploads directly to storage — BFF never handles file binary (FR60: storage credentials never exposed to frontend)
**And** if the customer abandons the form without submitting, orphaned files are auto-cleaned by Document Service via TTL (24h temp bucket) — **this is NOT BFF's responsibility**. Only when `createTicket` is called does the downstream service move files to permanent storage.

**Given** a customer submits the completed incident form
**When** the BFF processes the submission
**Then** it calls `ITicketPort.createTicket(type, description, imageUrls, customerId, priority)` via PortRegistry with `useCache: false`
**And** the Ticketing Service returns a tracking ID (e.g. `TK-2026-002`)
**And** the BFF records a session event: `{ type: "ticket_created", ticketId, channel }`.

**Given** the ticket creation succeeds
**When** the response returns to the frontend
**Then** the customer sees: "Incident reported! Your tracking ID: TK-2026-002"
**And** the tracking ID is available for future lookup (Story 5.2).

### Story 5.2: Ticket Tracking & Timeline

As a **customer (Cô Nguyễn)**,
I want to track my reported issue with a real-time timeline like Grab/Shopee order tracking,
So that I know exactly what's happening without calling the hotline.

**Acceptance Criteria:**

**Given** an authenticated customer enters a tracking ID or taps "My Tickets"
**When** the BFF receives the request
**Then** it calls `ITicketPort.getTicketStatus(ticketId)` via PortRegistry
**And** returns: current status, full timeline (submitted → assigned → in progress → resolved → closed), estimated completion time (ETA), and assigned team info.

**Given** an authenticated customer navigates to "Ticket History"
**When** the BFF receives the request
**Then** it calls `ITicketPort.getTicketHistory(customerId, filters)` via PortRegistry
**And** returns a list of all tickets with: tracking ID, type, status, creation date, last update.

**Given** the Ticketing Service sends a status change webhook to `POST /webhooks/ticket/status`
**When** the BFF receives it
**Then** it verifies the webhook using `InterServiceApiKeyGuard` (static API key, FR72)
**And** records a session event: `{ type: "ticket_status_changed", ticketId, oldStatus, newStatus }`
**And** invalidates the ticket cache via pattern `cache:port:ticket:{customerId}:*`
**And** dispatches a notification to the customer (Epic 6).

**Given** the Ticketing Service is down
**When** the customer tries to track a ticket
**Then** the Circuit Breaker returns cached ticket data with a "last updated" timestamp
**And** if no cache exists, shows "Ticket tracking temporarily unavailable."

### Story 5.3: Ticket Feedback (CSAT)

As a **customer (Anh Tuấn)**,
I want to rate my experience when a ticket is closed,
So that the water company knows how they're doing and can improve.

**Acceptance Criteria:**

**Given** an authenticated customer has a ticket with status "Closed"
**When** they view the ticket detail
**Then** a CSAT feedback form is displayed: 1-5 star rating + optional text comment.

**Given** a customer submits CSAT feedback
**When** the BFF processes it
**Then** it calls `ITicketPort.submitFeedback(ticketId, score, comment)` via PortRegistry
**And** returns success confirmation to the customer.

**Given** a ticket with CSAT score < 3 stars is submitted
**When** the BFF processes the feedback
**Then** the system flags the ticket for follow-up in the session event log
**And** note: Phase 2 auto-reopen if < 3/5 stars is a downstream responsibility — BFF only sends the feedback score.

### Story 5.4: Knowledge Base & FAQ Search

As a **customer (Bà Lan)**,
I want to search for help articles in Vietnamese and browse by topic,
So that I can find answers myself without calling anyone.

**Acceptance Criteria:**

**Given** an authenticated customer navigates to "Help & FAQ"
**When** the BFF receives the request
**Then** it calls `IKnowledgeBasePort.getCategories()` via PortRegistry
**And** returns a list of topic categories: hóa đơn, ghi chỉ số, sự cố, thanh toán, lắp đặt mới.

**Given** a customer types a search query in Vietnamese
**When** they submit the search (with or without diacritics, e.g. "hoa don" or "hóa đơn")
**Then** the BFF calls `IKnowledgeBasePort.searchArticles(query)` via PortRegistry as a **pure pass-through** — BFF does NOT implement any search logic (no regex, no string matching, no NLP)
**And** the Knowledge Base Service downstream handles Vietnamese language processing (diacritics normalization, synonyms, Elasticsearch or equivalent)
**And** returns matching articles with title, summary, and relevance score from the downstream service.

**Given** a customer taps on an article
**When** the article detail loads
**Then** the BFF calls `IKnowledgeBasePort.getArticle(articleId)`
**And** returns the full article content with category, author, and last updated date.

**Given** a customer finishes reading an article
**When** they tap "Helpful" or "Not Helpful"
**Then** the BFF calls `IKnowledgeBasePort.rateArticle(articleId, helpful)` via PortRegistry
**And** records the rating without requiring additional authentication beyond the session.

**Given** knowledge base data is fetched successfully
**When** the response is cached
**Then** the cache key follows `cache:port:knowledge-base:{hash}` with TTL 12-24h (static tier).

## Epic 6: Notifications & Proactive Alerts

**Goal:** KH stays informed about outages, payments, and what matters to them — with rate-limited, multi-channel dispatch. Critical notifications (payment confirmation, water cutoff, widespread incident) NEVER get dropped — they follow a Channel Fallback chain: ZNS → Push → In-App Inbox. Non-critical (promotional) notifications may be dropped when rate-limited.

### Story 6.1: Proactive Area Alerts

As a **customer (Cô Nguyễn)**,
I want to receive alerts about water outages and maintenance in my area,
So that I can prepare and not be caught off guard.

**Acceptance Criteria:**

**Given** a water outage or maintenance event affects a customer's area
**When** the BFF receives the data via `IProactiveNotificationPort`
**Then** it calls `IProactiveNotificationPort.getActiveAlerts(customerId)` via PortRegistry
**And** returns alerts affecting that customer: type (outage/maintenance/quality), description, affected area, expected start/end time, current status.

**Given** an authenticated customer navigates to "Active Alerts"
**When** the BFF receives the request
**Then** it calls `IProactiveNotificationPort.getActiveAlerts(customerId)`
**And** returns only alerts currently active and relevant to the customer's service address.

**Given** an authenticated customer navigates to "Alert History"
**When** the BFF receives the request with optional date filters
**Then** it calls `IProactiveNotificationPort.getAlertHistory(customerId, filters)`
**And** returns a chronological list of past alerts with resolution status.

**Given** an authenticated customer views an active alert
**When** they tap "Acknowledge"
**Then** the BFF calls `IProactiveNotificationPort.acknowledgeAlert(alertId, customerId)`
**And** records the acknowledgement — the customer won't see the "new alert" badge for this alert again.

### Story 6.2: Multi-Channel Notification Dispatch

As a **customer (Anh Tuấn)**,
I want to receive timely notifications through my preferred channels without being spammed,
So that I stay informed but not annoyed.

**Acceptance Criteria:**

**Given** any module dispatches a `DispatchNotificationCommand`
**When** the `DispatchNotificationHandler` evaluates the rate limiter
**Then** it checks: `Redis INCR ratelimit:notification:{userId}:{date}` for the target channel
**And** if the notification carries `isCritical: true` (payment confirmation, water cutoff, widespread incident) → the system implements **Channel Fallback**: Zalo ZNS rate-limited → **auto-downgrade to Push Notification (free)** → Push failed → **In-App Inbox**. Critical notifications are NEVER dropped.
**And** if the notification is non-critical (promotional, informational) and all channels hit rate limits → **DROP** with a log entry for audit.
**And** multiple modules triggering notifications for the same customer independently each pass through this rate limiter — no module can bypass the funnel.

**Given** the rate limiter allows the notification (or fallback succeeds)
**When** the dispatch proceeds
**Then** the handler routes to the appropriate channel dispatcher (Push via FCM/APNs, Zalo OA, SMS, Email) based on the notification type and customer preferences
**And** calls `INotificationPort.dispatchNotification(command)` via PortRegistry.

**Given** a notification is dispatched via `INotificationPort`
**When** the downstream Notification Service processes it
**Then** the BFF records a session event: `{ type: "notification_sent", channel, notificationType, timestamp }`
**And** the notification appears in the customer's history (Story 6.3).

**Given** multiple modules trigger notifications for the same customer simultaneously
**When** the rate limiter evaluates each
**Then** the Zalo ZNS channel respects the 2 msg/KH/ticket/day limit — excess ZNS messages trigger the fallback chain for critical notifications or are dropped for non-critical
**And** other channels (Push, SMS) follow their own rate limits independently.

### Story 6.3: Notification Preferences & History

As a **customer (Anh Tuấn)**,
I want to choose which notifications I receive and through which channels,
So that I get only the information I care about, how I want it.

**Acceptance Criteria:**

**Given** an authenticated customer navigates to "Notification Settings"
**When** the BFF receives the request
**Then** it calls `INotificationPort.getNotificationPreferences(customerId)` via PortRegistry
**And** returns current preferences with a clear distinction: **Optional** channels (Zalo, SMS, marketing) can be toggled by the customer, but **Critical** notification types (water cutoff, payment status, widespread incident) are always enabled and cannot be disabled — the UI shows these as locked/read-only with a tooltip explaining why.

**Given** an authenticated customer updates their notification preferences
**When** they save changes
**Then** the BFF calls `INotificationPort.updateNotificationPreferences(customerId, preferences)` via PortRegistry
**And** notifications with `isCritical: true` **bypass** customer preferences entirely — they are always dispatched regardless of opt-out settings
**And** critical notifications prefer non-intrusive channels (Push, In-App Inbox) to respect customer experience while ensuring delivery.

**Given** an authenticated customer navigates to "Notification History"
**When** the BFF receives the request with pagination
**Then** it calls `INotificationPort.getNotificationHistory(customerId)` via PortRegistry
**And** returns a paginated list: notification type, channel, content summary, timestamp, delivery status (sent/delivered/failed).

**Given** notification data is fetched successfully
**When** the response is cached
**Then** the cache key follows `cache:port:notification:{hash}` with TTL 5-15 minutes (dynamic tier).

## Epic 7: Omnichannel Context & Security Polish

**Goal:** KH's experience continues seamlessly across channels via Redis Event Sourcing (Hash + Sorted Set + Lua atomic writes), and all inbound webhooks are cryptographically verified. The "clear coat" layer applied after all business flows are running smoothly.

### Story 7.1: Session Store & Event Recording

As a **customer (Anh Tuấn)**,
I want every interaction I have with the water company to be recorded,
So that when I switch channels, the company remembers everything without me repeating myself.

**Acceptance Criteria:**

**Given** an authenticated customer performs any interaction (view invoice, submit ticket, make payment, etc.)
**When** the BFF processes the request
**Then** a session event is recorded in Redis within 1 second: `{ type, timestamp, content, metadata, channel }`
**And** the write uses the **atomic Lua script** (`SESSION_APPEND_LUA`) that performs `ZADD` + `EXPIRE` + `HSET` + `EXPIRE` in a single Redis round-trip — no separate commands.

**Given** a session event is written
**When** the data is stored in Redis
**Then** the session key `session:{userId}` (Hash) stores: sessionId, userId, createdAt, updatedAt
**And** the events key `session:{userId}:events` (Sorted Set) stores events with timestamp as score
**And** both keys have TTL 24-48h (configurable), AOF persistence enabled (NFR-R4: sessions survive restart).

**Given** a customer has 100+ session events
**When** the BFF queries their session
**Then** the Sorted Set allows O(log N) time-range queries (e.g. "show events from the last 2 hours")
**And** the Hash allows O(1) full session metadata read.

**Given** the Redis instance restarts
**When** it comes back online
**Then** all session data is preserved (AOF persistence, NFR-R4)
**And** active customers can continue their sessions without re-authentication.

### Story 7.2: Cross-Channel Session Continuation

As a **customer (Anh Tuấn)**,
I want to start a conversation on Zalo in the morning and continue on the Web portal in the afternoon without repeating myself,
So that my time is respected and my issue is handled seamlessly.

**Acceptance Criteria:**

**Given** a customer chatted via Zalo at 9:00 AM and received tracking ID `TK-2026-002`
**When** they open the Web Portal at 2:00 PM and authenticate with the same UserID (via multi-provider linking from Epic 1)
**Then** the BFF loads the session from `session:{userId}:events`
**And** the Web Portal displays the full history: Zalo chat at 9:00 AM + tracking ID + current ticket status
**And** the customer does NOT need to re-enter any information.

**Given** a customer switches from App to Zalo mid-conversation
**When** they send a Zalo message
**Then** the Zalo Adapter resolves the UserID from the Zalo ID (via provider linking)
**And** loads the existing session context
**And** the new Zalo message is appended to the same session event stream — not a new session.

**Given** a customer's session has expired (TTL 24-48h elapsed)
**When** they return to any channel
**Then** a new session is created automatically
**And** the old session events remain in Redis until TTL expires (for audit purposes)
**And** the customer sees a fresh context — no stale data from yesterday.

**Given** an authenticated customer requests their session history
**When** the BFF calls the session query handler
**Then** it returns events from `session:{userId}:events` with time-range filtering
**And** each event includes: type, timestamp, channel, and a content summary.

### Story 7.3: Webhook Security Guards

As a **platform security officer**,
I want every inbound webhook to be cryptographically verified before processing,
So that no unauthorized party can inject fake payment confirmations or ticket updates.

**Acceptance Criteria:**

**Given** a Zalo webhook arrives at `POST /webhooks/zalo/callback`
**When** the `ZaloSignatureGuard` processes the request
**Then** it computes HMAC SHA-256 of the raw request body using `ZALOA_SECRET_KEY` env var
**And** compares the result with the `X-ZECA-Signature` header value
**And** if mismatch → returns 403 Forbidden immediately with a security audit log entry
**And** if match → allows the request to proceed to the Zalo Adapter handler.

**Given** an internal webhook arrives (Payment IPN, Ticket status, Notification delivery)
**When** the `InterServiceApiKeyGuard` processes the request
**Then** it validates the `x-api-key` header against `INTER_SERVICE_API_KEY` env var
**And** this is a **static shared secret** — NOT JWT (per FR72: internal webhooks do not use JWT)
**And** if mismatch → returns 403 Forbidden with security audit log
**And** if match → allows the request to proceed.

**Given** a webhook endpoint receives a request without any authentication header
**When** either guard evaluates the request
**Then** it returns 403 Forbidden — zero unauthenticated webhook endpoints allowed.

**Given** both guards are implemented
**When** the application starts
**Then** every webhook controller (`webhooks/payment/*`, `webhooks/ticket/*`, `webhooks/zalo/*`, `webhooks/notification/*`) has the appropriate guard applied via NestJS `@UseGuards()` decorator
**And** this is enforced at the infrastructure layer — no handler code needs to check security manually.

**Given** the ZaloSignatureGuard requires HMAC computation on the raw request body
**When** the NestJS + Fastify stack processes the request
**Then** the dev must install and configure `fastify-raw-body` (or register a custom `addContentTypeParser` hook) for the `/webhooks/zalo/*` endpoint to preserve `request.rawBody` as the original unparsed string
**And** the HMAC verification function **must** use `request.rawBody` — NOT the parsed JSON object — because Fastify's default body parsing alters whitespace/field ordering, causing valid Zalo signatures to fail verification
**And** this configuration is applied only to webhook endpoints, not globally — normal API endpoints continue using standard JSON parsing.
