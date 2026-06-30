---
title: "OmniCare Ticketing & SLA Service — Product Requirements Document"
product_name: "OmniCare Ticketing & SLA Service"
document_type: "Product Requirements Document (PRD)"
version: "1.0 — Approved"
status: "Complete — Open Questions Resolved"
date: "2026-06-30"
author: "Pc"
source_brief: "Chapter 5 §5.2 + OmniCare PRD v1.2 §3b [TKT-SVC] + User clarifications"
---

# Product Requirements Document — OmniCare Ticketing & SLA Service

> **Scope:** Real Ticketing & SLA microservice (Wave-2), replacing the wave-1 stub.
> Monorepo module within `omichannel_be/` — shares `libs/core` + `libs/shared` + `contracts/`.
> Separate bootstrap (`src/apps/ticketing/`) on port 3001.

## 1. Executive Summary

The Ticketing & SLA Service owns **ticket lifecycle, dual-clock SLA enforcement, breach escalation, CSAT-driven reopen, and GIS-based Parent-Incident grouping**. It replaces the wave-1 in-memory stub with a real NestJS DDD module backed by PostgreSQL.

## 2. Business Logic Decisions (RESOLVED)

### 2.1 SLA Calculation — Dual Clock + Priority-Based Schedule

| Priority | Acknowledge SLA | Resolve SLA | Schedule |
|---|---|---|---|
| **P0** (khẩn cấp: rò rỉ ngập đường) | **1 giờ** | **4 giờ** | **24/7** (đếm liên tục) |
| **P1** (cao) | 2 giờ | 8 giờ | 24/7 |
| **P2** (thường: lắp đặt mới) | **24 giờ** | **7 ngày** | **Giờ hành chính** (8:00–17:00, T2–T6) |
| **P3** (thấp) | 48 giờ | 14 ngày | Giờ hành chính |

**Hai đồng hồ SLA chạy song song:**
1. **Acknowledge clock** — đếm từ lúc tạo ticket → dừng khi agent đầu tiên tương tác (auto RECEIVED→IN_PROGRESS).
2. **Resolve clock** — đếm từ lúc tạo ticket → dừng khi ticket RESOLVED/CLOSED.

P0/P1 = **24/7 countdown** (không dừng cuối tuần/đêm). P2/P3 = **business-hours countdown** (tạm dừng ngoài 8:00–17:00 T2–T6 + nghỉ lễ).

### 2.2 State Machine

```
RECEIVED → (auto: agent first response) → IN_PROGRESS
IN_PROGRESS → WAITING (giao đội/bên thứ 3)
WAITING → IN_PROGRESS (nhận phản hồi)
IN_PROGRESS → RESOLVED
RESOLVED → CLOSED (xác nhận KH hài lòng)
CLOSED → IN_PROGRESS (REOPEN: CSAT <3★, kèm Escalate + SLA 24h mới)
```

**Auto-transition:** RECEIVED → IN_PROGRESS khi agent gửi phản hồi đầu tiên (best-practice, tự động dừng Acknowledge clock).

**Reopen:** CLOSED → IN_PROGRESS (chỉ qua CSAT <3★). Không reopen qua channel khác.

### 2.3 Parent-Incident (FR61) — GIS Network-Based Auto-Merge

**Không dùng radius đơn thuần.** Dựa trên **cơ sở hạ tầng mạng lưới cấp nước**:
1. Agent chọn **đoạn ống cô lập** (isolation segment) trên GIS.
2. Hệ thống tính toán **tự động** các khách hàng cấp nước qua đoạn ống đó.
3. Tất cả tickets từ KH trong vùng ảnh hưởng → **auto-merge** vào Parent-Incident.

**Cơ chế:** Auto-merge (không suggest). Agent chỉ cần chọn đoạn ống → hệ thống gộp.

**Wave-2 implementation:** Mock GIS port (trả về tọa độ giả lập); wave-3 nối GIS thật.

### 2.4 Escalation (FR26) — Dual Trigger

| Trigger | Action |
|---|---|
| SlaWarning (<30 min remaining) | Escalate lên team lead |
| SlaBreached (past deadline) | Escalate lên cấp cao hơn (dept head) |
| CSAT <3/5 | Immediate escalate + reopen (24h SLA mới) |

### 2.5 CSAT Reopen (FR27)

- **Threshold:** <3/5 sao.
- **Reopen:** CLOSED → IN_PROGRESS (kèm cờ `escalated=true`).
- **New SLA:** **24 giờ resolve** (24/7, cứng — biến phản hồi tiêu cực thành cơ hội khôi phục trong 24h).
- **Time limit:** Reopen chỉ trong vòng **30 ngày** sau CLOSE. Quá 30 ngày → tạo ticket mới.

---

## 3. Functional Requirements

### FR-T1: Ticket Creation (FR21-23)
- **FR-T1.1** [MVP] The service assigns a unique ticket ID (`SC-XXXXXX`) on creation.
- **FR-T1.2** [MVP] The service classifies by type + priority (P0–P3) from the request.
- **FR-T1.3** [MVP] The service applies the dual SLA policy (ack + resolve) per §2.1.
- **FR-T1.4** [MVP] The service persists to PostgreSQL (`tickets`, `ticket_events`, `sla_policies`).

### FR-T2: Lifecycle State Machine (FR20)
- **FR-T2.1** [MVP] The service enforces valid transitions per §2.2.
- **FR-T2.2** [MVP] Invalid transitions rejected with `INVALID_TRANSITION` error.
- **FR-T2.3** [MVP] Auto-transition: RECEIVED→IN_PROGRESS on first agent response (stops Ack clock).
- **FR-T2.4** [MVP] Each transition emits `TicketStateChanged`.

### FR-T3: SLA Monitoring (FR24)
- **FR-T3.1** [MVP] Background worker scans every 60s.
- **FR-T3.2** [MVP] Ack clock breach (<ack SLA) → `SlaWarning` severity=ACK.
- **FR-T3.3** [MVP] Resolve clock breach (<resolve SLA) → `SlaWarning` severity=RESOLVE or `SlaBreached`.
- **FR-T3.4** [MVP] P0/P1: 24/7 countdown. P2/P3: business-hours countdown (skip weekends/nights).
- **FR-T3.5** [G2] Holiday calendar integration (Vietnamese public holidays).

### FR-T4: Escalation (FR26)
- **FR-T4.1** [MVP] SlaWarning → escalate to team lead.
- **FR-T4.2** [MVP] SlaBreached → escalate to dept head.
- **FR-T4.3** [MVP] CSAT <3 → immediate escalate + reopen.

### FR-T5: CSAT Reopen (FR27)
- **FR-T5.1** [MVP] Rating <3/5 → CLOSED reopens to IN_PROGRESS.
- **FR-T5.2** [MVP] Reopen sets `escalated=true` + new 24h SLA (24/7).
- **FR-T5.3** [MVP] Reopen time limit: 30 days after CLOSE.

### FR-T6: Parent-Incident Grouping (FR61)
- **FR-T6.1** [MVP] Attach child tickets to a parent.
- **FR-T6.2** [MVP] Detach/split a child from parent.
- **FR-T6.3** [G2] Auto-merge based on GIS pipe-segment isolation (§2.3).
- **FR-T6.4** [G2] GIS port (mock wave-2, real wave-3).

## 4. Non-Functional Requirements

- **NFR-T1** The service responds within 500ms p95.
- **NFR-T2** SLA worker runs every 60s (NFR10 contract).
- **NFR-T3** Runs on port 3001.
- **NFR-T4** Own PostgreSQL database (`omnicare_ticketing`).
- **NFR-T5** Shares `libs/core` + `libs/shared` + `contracts/` via monorepo.
- **NFR-T6** Emits events to OmniCare via HTTP webhook (wave-2) → RabbitMQ (wave-3).

## 5. SLA Policy Table (seed data)

```typescript
const SLA_POLICIES = {
  P0: { ackMs: 1 * 3600 * 1000,     resolveMs: 4 * 3600 * 1000,    schedule: '24/7' },
  P1: { ackMs: 2 * 3600 * 1000,     resolveMs: 8 * 3600 * 1000,    schedule: '24/7' },
  P2: { ackMs: 24 * 3600 * 1000,    resolveMs: 7 * 24 * 3600 * 1000, schedule: 'BUSINESS_HOURS' },
  P3: { ackMs: 48 * 3600 * 1000,    resolveMs: 14 * 24 * 3600 * 1000, schedule: 'BUSINESS_HOURS' },
};
```

## 6. Contract (unchanged from Wave-1)

### Commands IN: `TicketCreateRequested`, `TicketStateChanged`, `TicketReassignRequested`
### Events OUT: `SlaWarning`, `SlaBreached`, `TicketClosed`, `TicketStateChanged`
### Sync Reads: `GET /bff/tickets/kanban`, `GET /bff/tickets/:id`, `GET /bff/conversations/:convId/ticket`

## References
- **Chapter 5 §5.2:** SLA policies + workflow
- **OmniCare PRD v1.2 §3b:** [TKT-SVC] FR21-24, FR26, FR27, FR61
- **Architecture.md §5:** Contract definition
