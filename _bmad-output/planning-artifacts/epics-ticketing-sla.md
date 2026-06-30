---
title: "OmniCare Ticketing & SLA Service — Epic Breakdown"
product_name: "Ticketing & SLA Service"
document_type: "Epic Breakdown"
version: "0.1 — Wave-2 scope"
status: "Epic list proposed"
date: "2026-06-30"
author: "Pc"
source:
  prd: "prd-ticketing-sla-service.md (v1.0)"
  architecture: "architecture.md (v0.3)"
---

# Ticketing & SLA Service — Epic Breakdown

> Decomposes the [Ticketing PRD v1.0](./prd-ticketing-sla-service.md) into user-value epics.
> All built within `omichannel_be/src/modules/ticketing/` following the **same DDD + CQRS + Hexagonal pattern** as `modules/messaging/`.
> Shares `libs/core` + `libs/shared` + `contracts/`.

## Epic List

### Epic T-1: Ticket Aggregate + Lifecycle State Machine *(FR-T1, FR-T2)*

**User outcome:** Tickets are created with unique IDs, classified by type/priority, and flow through a strict lifecycle (RECEIVED → IN_PROGRESS → WAITING → RESOLVED → CLOSED). Auto-transition on first agent response.

**FRs covered:** FR-T1.1–1.4, FR-T2.1–2.4

**DDD structure:**
```
modules/ticketing/
  domain/
    entities/ticket.entity.ts         (AggregateRoot: lifecycle, SLA fields, escalation flag)
    value-objects/ticket-id.vo.ts    (SC-XXXXXX format)
    value-objects/ticket-priority.vo.ts (P0-P3 + schedule type)
    value-objects/ticket-stage.vo.ts (stage + valid transitions)
    events/ticket-created.event.ts
    events/ticket-stage-changed.event.ts
    events/ticket-closed.event.ts
    repositories/ticket.repository.interface.ts
  application/
    commands/create-ticket.command.ts + handler
    commands/advance-stage.command.ts + handler
    queries/get-ticket.query.ts + handler
    dtos/create-ticket.dto.ts
    dtos/advance-stage.dto.ts
```

**Dependencies:** Foundation (`libs/core` + `libs/shared`), DB schema (`tickets` table).

---

### Epic T-2: Dual-Clock SLA Engine *(FR-T3)*

**User outcome:** The system tracks TWO SLA countdowns (acknowledge + resolve) per ticket, with P0/P1 counting 24/7 and P2/P3 counting business hours. A background worker emits warnings/breaches.

**FRs covered:** FR-T3.1–3.4

**DDD structure:**
```
modules/ticketing/
  domain/
    value-objects/sla-policy.vo.ts        (ackMs + resolveMs + schedule)
    services/sla-calculator.service.ts    (business-hours vs 24/7 computation)
  infrastructure/
    sla-worker/sla-worker.service.ts      (@Cron EVERY_MINUTE — scans + emits)
```

**Key logic:**
- `SlaCalculator`: given `createdAt`, `acknowledgedAt?`, `priority`, returns remaining ack/resolve ms. Business-hours mode skips 17:00–08:00 + weekends.
- `SlaWorker`: every 60s, queries open tickets, computes remaining, emits `SlaWarning` / `SlaBreached`.

**Dependencies:** Epic T-1 (tickets exist).

---

### Epic T-3: Escalation Engine *(FR-T4)*

**User outcome:** When SLA warning/breach fires or CSAT <3, the ticket auto-escalates to team lead / dept head.

**FRs covered:** FR-T4.1–4.3

**DDD structure:**
```
modules/ticketing/
  domain/
    services/escalation.service.ts   (rule engine: warning→lead, breach→head, CSAT→immediate)
  application/
    commands/escalate.command.ts + handler
```

**Dependencies:** Epic T-2 (SLA worker triggers escalation).

---

### Epic T-4: CSAT Reopen *(FR-T5)*

**User outcome:** A CLOSED ticket with CSAT <3 reopens to IN_PROGRESS with escalated flag + new 24h SLA. Time-limited to 30 days.

**FRs covered:** FR-T5.1–5.3

**DDD structure:**
```
modules/ticketing/
  domain/
    ticket.entity.ts           (reopen() method: CLOSED→IN_PROGRESS + reset SLA + escalate)
  application/
    commands/handle-csat.command.ts + handler  (receives CsatSubmitted → reopen logic)
```

**Dependencies:** Epic T-1 (lifecycle), Epic T-3 (escalation).

---

### Epic T-5: Parent-Incident Grouping *(FR-T6)*

**User outcome:** Tickets can be grouped under a Parent-Incident. Wave-2: manual attach/detach + mock GIS. Wave-3: auto-merge via pipe-segment isolation.

**FRs covered:** FR-T6.1–6.2 (wave-2), FR-T6.3–6.4 (wave-3 G2)

**DDD structure:**
```
modules/ticketing/
  domain/
    entities/parent-incident.entity.ts     (AggregateRoot: child ticket IDs)
    events/child-attached.event.ts
    events/child-detached.event.ts
  application/
    commands/attach-to-parent.command.ts + handler
    commands/detach-from-parent.command.ts + handler
    commands/split-from-parent.command.ts + handler
```

**Dependencies:** Epic T-1 (tickets exist).

---

### Epic T-6: Contract Integration + Cutover

**User outcome:** The real Ticketing service replaces the stub. OmniCare calls it via HTTP. Zero OmniCare rewrite.

**Tasks:**
- Shared `contracts/` module (event/command DTOs shared between both services)
- `apps/ticketing/main.ts` — separate NestJS bootstrap on port 3001
- `apps/ticketing/ticketing-app.module.ts` — imports only TicketingModule + SharedInfra
- OmniCare BFF: switch from `TicketingStubService` to HTTP calls to port 3001
- Contract tests: both services agree on event/command shapes

**Dependencies:** All epics T-1 to T-5.

---

## FR Coverage Map

```
FR-T1.1–1.4 → Epic T-1
FR-T2.1–2.4 → Epic T-1
FR-T3.1–3.4 → Epic T-2
FR-T3.5     → G2 (holiday calendar)
FR-T4.1–4.3 → Epic T-3
FR-T5.1–5.3 → Epic T-4
FR-T6.1–6.2 → Epic T-5
FR-T6.3–6.4 → G2 (GIS auto-merge)
```

## Build Order

```
Foundation (shared libs already exist)
  ↓
Epic T-1 (Ticket aggregate + state machine)
  ↓
Epic T-2 (SLA engine — needs tickets to exist)
  ↓
Epic T-3 (Escalation — needs SLA worker triggers)
  ↓
Epic T-4 (CSAT reopen — needs lifecycle + escalation)
  ↓
Epic T-5 (Parent-Incident — independent of T-2/3/4)
  ↓
Epic T-6 (Contract + cutover — needs all epics)
```
