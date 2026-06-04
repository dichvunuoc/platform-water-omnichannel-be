---
stepsCompleted: [step-01, step-02]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-06-04
**Project:** IOC Customer — Module CSKH (Trạm Điều phối Trung tâm)

## PRD Analysis

### Functional Requirements

FR1: Customer authenticates via Phone/OTP, Zalo ID, or Social login (Google, Facebook, Apple) — no username/password required
FR2: System links 1 Customer with multiple Providers (Phone, Zalo ID, Email) for cross-channel identification
FR3: System issues authenticated token containing customer identity, linked providers, session reference for every authenticated KH
FR4: System auto-refreshes access token on receiving 401 from downstream — KH sees no disruption
FR5: BFF owns Customer Auth DB (PostgreSQL) — stores customer profiles, provider links, tokens
FR6: KH views 360° profile: customer ID, identity info, usage classification, address, contact info
FR7: KH views 360° interaction timeline: contracts → meters → readings → invoices → payments → complaints → multi-channel interactions, ordered chronologically
FR8: KH updates contact info (phone, email, contact address)
FR9: KH views relationship tree (Industrial Zone → member factories), auxiliary contacts
FR10: Each downstream Microservice communicates via Port interface (30 Port Interfaces total: 14 MVP + 12 Phase 2 + 4 Phase 3)
FR11: Adapter implementation is injectable — MockAdapter for development, InternalAdapter for production, ExternalAdapter for SaaS
FR12: Frontend only knows Port schema — never exposed to downstream raw schema
FR13: Adding a new downstream service = adding Port + Adapter — no BFF core modification
FR14: Each Adapter normalizes response to Port schema before returning to frontend
FR15: Mock Adapter toggle: `MOCK_MODE=true` → mock responses, `MOCK_MODE=false` → live calls
FR16: KH views contract info: address, meter ID, water quota, subscription type, pricing terms, status
FR17: KH views contract version history (versioning)
FR18: KH downloads contract PDF
FR19: System caches contract data with TTL 12-24h (static data)
FR20: KH views meter info: serial, type, diameter (DN), accuracy class, manufacture year
FR21: KH views meter calibration status (valid / expiring soon / expired)
FR22: KH views meter replacement history
FR23: KH views monthly water consumption chart (last 12 months)
FR24: KH views consumption comparison current vs previous period (increase/decrease %)
FR25: KH views period reading detail: previous index, current index, volume, evidence photos
FR26: KH views applicable tariff for their contract (tiered residential / special pricing)
FR27: KH views tiered price breakdown in invoice (m³ × price = subtotal)
FR28: KH views associated fees (environmental, drainage, VAT)
FR29: KH views invoice list with pagination and filter (by month, status)
FR30: KH views invoice detail: line items, tiered pricing, total amount, payment status
FR31: KH downloads electronic invoice PDF (with CQT code, lookup code, digital signature)
FR32: System caches invoice list with TTL 5-15 minutes (dynamic data)
FR33: KH selects invoice → initiates payment → receives QR code or payment link
FR34: BFF receives webhook from Payment Service on successful payment → updates invoice status (cached) → sends notification
FR35: ABSOLUTELY NO CACHING of payment transactions — every payment request must call Payment Service live
FR36: KH views payment history
FR37: KH pays multiple invoices at once
FR38: KH registers automatic direct debit
FR39: KH views current debt: amount, debt period, aging (0-30, 31-60, 61-90, >90 days)
FR40: KH views debt history
FR41: KH fills incident report form: incident type, description, photo upload, location → BFF pushes data to Ticketing Service
FR42: Ticketing Service returns tracking ID → BFF displays to KH
FR43: KH tracks incident status by tracking ID (timeline + ETA like Grab)
FR44: BFF receives webhook from Ticketing Service on status change → sends notification to KH
FR45: KH submits feedback when ticket is closed (CSAT)
FR46: KH views ticket history (closed, in progress)
FR47: KH searches FAQ in Vietnamese (with/without diacritics, synonyms)
FR48: KH views help articles by topic: invoice, meter reading, incidents, payment, new installation
FR49: KH rates article helpful/not helpful
FR50: KH receives area incident notifications (water outage, repairs, quality changes)
FR51: KH views active notifications affecting them
FR52: KH views incident notification history
FR53: KH acknowledges notification
FR54: System sends notifications to KH via appropriate channel (Push, Zalo, SMS, Email)
FR55: All notification dispatches MUST route through `DispatchNotificationCommand` → rate limiter (max 2 ZNS msg/KH/ticket/day) → channel dispatcher
FR56: KH manages notification preferences (select channels, enable/disable notification types)
FR57: KH views received notification history
FR58: KH uploads incident photos (camera capture + gallery selection)
FR59: KH uploads documents (onboarding — Phase 2)
FR60: System generates presigned URL for upload → does not expose storage credentials to frontend
FR61: System records every KH interaction into session store with event type, timestamp, content — 100% interactions recorded within 1 second
FR62: System automatically continues session when KH switches channels — based on Customer ID, not channel
FR63: Session has TTL 24-48h. Redis AOF persistence mandatory — sessions survive restart.
FR64: Session writes MUST be atomic — using Redis Lua script
FR65: System detects downstream service down via Circuit Breaker (per-service, per-Port) → auto-fallback to cached data
FR66: System always returns response to KH — even when downstream is down (cached or queued message)
FR67: System caches data with tiered TTL: static 12-24h, dynamic 5-15 min, transaction no cache
FR68: System logs warning when Circuit Breaker opens or fallback activates
FR69: Inbound idempotency: Every NormalizedRequest must carry `idempotencyKey`. Check Redis before processing. Duplicate key → return cached result.
FR70: Outbound idempotency: Every BFF → downstream POST/PUT call must include `x-idempotency-key` header.
FR71: Zalo inbound webhook: HMAC SHA-256 body verification
FR72: Internal webhooks (Payment/Ticketing): Static API key verification. No JWT for inter-service webhooks.

**Total FRs: 72**

### Non-Functional Requirements

**Performance (6):**
NFR-P1: BFF response time (excluding downstream latency) < 200ms (p95)
NFR-P2: Customer Auth latency (login → token ready) < 500ms (p95)
NFR-P3: Page load (KH opens App → data displays) < 3 seconds
NFR-P4: Downstream timeout 3 seconds (configurable per Port)
NFR-P5: Support 500 concurrent customer sessions
NFR-P6: Aggregation latency (multi-service calls) < 500ms additional

**Security (8):**
NFR-S1: Customer personal data encrypted at rest with AES-256
NFR-S2: Data encrypted in transit with TLS 1.3
NFR-S3: API keys/secrets stored in env vars — zero hardcoded secrets
NFR-S4: Access token TTL 15 minutes
NFR-S5: Refresh token TTL 7 days
NFR-S6: Audit log for all KH data access actions
NFR-S7: Audit log retention ≥ 12 months
NFR-S8: PII masking via pino-redact — 100% PII paths redacted

**Reliability (4):**
NFR-R1: Multi-channel uptime (App + Web + Zalo) ≥ 99.5%
NFR-R2: Total outage 0% — KH always receives response
NFR-R3: Circuit Breaker detection latency < 10 seconds
NFR-R4: Session survives Redis restart — 100% preserved (AOF enabled)

**Scalability (3):**
NFR-SC1: Horizontal scaling ≥ 0.8x throughput per additional pod
NFR-SC2: Adding Port/Adapter requires 0 core code change
NFR-SC3: Adapter swap has < 5% performance delta

**Integration (5):**
NFR-I1: Port response schema validation — 100% match OpenAPI spec (CI/CD gate)
NFR-I2: Downstream API change notification before deployment
NFR-I3: Zalo OA API compliance
NFR-I4: Webhook verification (HMAC + API key) — 100% inbound webhooks verified
NFR-I5: Mock Adapter coverage — 100% Port Interfaces have MockAdapter

**Total NFRs: 28**

### Additional Requirements

**Domain Compliance:**
DR-1: Customer data protection per Nghị định 13/2023/NĐ-CP
DR-2: Audit logging for all KH data access (12-month retention)
DR-3: PII masking mandatory (pino-redact)
DR-4: SLA compliance for public services (complaint response 24h, incident 2-6h by area)
DR-5: Electronic invoice compliance per Nghị định 123/2020/NĐ-CP
DR-6: Meter calibration compliance per Nghị định 86/2012/NĐ-CP
DR-7: eContract compliance per Nghị định 130/2018/NĐ-CP

**Technical Constraints:**
DR-8: API Contract First (OpenAPI/Swagger mandatory)
DR-9: Hexagonal Port isolation (interface-only Ports)
DR-10: Secret management via env vars, rotation strategy
DR-11: Never die because downstream died — 3-tier fallback

**Integration Requirements (32 systems):**
IR-1 to IR-32: 30 downstream service integrations + Redis + PostgreSQL

**BFF-Specific:**
PT-1 to PT-14: API Contract, Port schemas, Customer Auth, Resilience, Mock Adapter toggle

### PRD Completeness Assessment

**Strengths:**
- Extremely detailed: 72 FRs + 28 NFRs + 11 DRs + 32 IRs + 14 PTs
- Full traceability matrix linking Mota_Tinh_Nang → Services → Ports → FRs
- 10 user journeys with service call chains documented
- 4 personas with clear behavioral profiles
- Success criteria with 6/12/24 month targets (CS, BS, TS metrics)
- Clear MVP vs Phase 2 vs Phase 3 phasing
- 30 downstream services cataloged with port interfaces, mock priority, and methods

**Potential Gaps (to validate in epic coverage):**
- No explicit error response format standard across all ports
- No explicit rate limiting on customer-facing API endpoints (only on notification dispatch)
- No explicit API versioning strategy in PRD (PT-3 mentions URL path versioning but no detail)
