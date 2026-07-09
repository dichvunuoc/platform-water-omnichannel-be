---
doc: 'app-tu-phuc-vu — Re-planned Architecture & PRD (from overall diagram)'
status: 'draft-for-review'
createdAt: '2026-07-06'
sourceOfTruth: 'sơ đồ tổng thể app-tu-phuc-vu (ER, 4 bounded-context)'
related:
  - prd.md (v4.0 — customer self-service slice, current state)
  - architecture.md (v2 — self-service BFF, current state)
note: 'Bản này dựng lại kế hoạch theo sơ đồ tổng thể. KHÔNG ghi đè prd.md/architecture.md — tạo song song để review.'
---

# app-tu-phuc-vu — Re-planned Architecture & PRD

## 0. Positioning (theo sơ đồ)

app-tu-phuc-vu là **app cho khách hàng tương tác với các dịch vụ** (KH dùng app để giao tiếp/trải nghiệm dịch vụ). **KHÔNG phải** nền tảng omnichannel/contact-center.

Sơ đồ tổng thể là **blueprint build**, chia **4 bounded-context** (DDD):

1. **platform** — IAM/RBAC/Audit nội bộ
2. **omnichannel** — tương tác KH: liên kết kênh, snapshot hồ sơ, hội thoại, tin nhắn, gọi, KB, AI, broadcast, khảo sát, sự cố, lệnh công việc
3. **ticketing** — ticket + SLA (2 đồng hồ) + escalation + sự cố cha
4. **external (EXT)** — hệ ngoài

### Nguyên tắc build (theo chỉ đạo)
**Chỉ xây 2 loại, đúng như biểu đồ — không mở rộng ngoài biểu đồ:**

| Loại | Phạm vi | Nghĩa |
|---|---|---|
| **(1) Adapter** | `EXT_*` + các downstream service | Chỉ xây **adapter nối** (Hexagonal Port, dùng lại `libs/shared/port` hiện có). KHÔNG build logic hệ ngoài. |
| **(2) Mới** | các entity nội bộ trong biểu đồ (`PLAT_*`, `OMNI_*`, `TKT_*`) | Build mới đúng theo biểu đồ (data + component của app). |

> **Định danh khách hàng** = `EXT_Customer360` (external) → adapter; app chỉ cache (`OMNI_customer_snapshots`) + liên kết kênh (`OMNI_customer_links`), không sở hữu data KH.

## 1. Kiến trúc — Bounded Contexts

### 1.1 platform.* (IAM/RBAC/Audit — staff)
| Entity | Vai trò |
|---|---|
| `PLAT_users` | agent/supervisor/admin (username, full_name, role, is_active) |
| `PLAT_agent_presence` | trạng thái agent (AVAILABLE/BUSY/AWAY/OFFLINE) + active_conversations |
| `PLAT_audit_log` | actor_id (soft→users), action, entity_type, entity_id, trace_id |

### 1.2 omnichannel.* (lõi tương tác KH)
| Nhóm | Entity | Ghi chú |
|---|---|---|
| Liên kết KH | `OMNI_customer_links`, `OMNI_customer_snapshots` | link channel (zalo/sđt…) → customer_ref (soft→C360); snapshot profile jsonb (hợp đồng/công nợ/tiêu thụ) có TTL |
| Hội thoại | `OMNI_conversations`, `OMNI_messages`, `OMNI_message_attachments` | conversation gán agent; message có provider_message_id UNIQUE (idempotency), direction IN/OUT |
| AI | `OMNI_ai_annotations` | label (tag/intent) + transcript (STT) trên message/attachment — async qua EXT_AI_Service webhook |
| Gọi | `OMNI_calls` | provider_call_id, status RINGING/ANSWERED/ENDED, recording_url TTL 90 ngày — qua EXT_PBX webhook |
| KB/Deflection | `OMNI_kb_articles`, `OMNI_kb_article_versions`, `OMNI_deflection_events` | FTS tiếng Việt (tsvector), versioning, đo giải quyết tự động |
| Broadcast | `OMNI_broadcasts` (target_area Polygon), `OMNI_broadcast_recipients` | thông báo theo vùng địa lý |
| Khảo sát | `OMNI_survey_responses` | CSAT/NPS/CES, gắn ticket (soft) + conversation |
| Sự cố | `OMNI_incident_reports` | geo pin, cluster_confidence, link parent_incident (soft→TKT) |
| Lệnh công việc | `OMNI_work_orders` | ticket_ref (soft→TKT), geo, fsm_external_id — dispatch qua EXT_FieldTeam_FSM |
| Resilience | `OMNI_idempotency_keys`, `OMNI_outbox_events` | inbound dedup + transactional outbox (MessageReceived / TicketCreateRequested) |

### 1.3 ticketing.* (Ticket & SLA)
| Entity | Vai trò |
|---|---|
| `TKT_parent_incidents` | gộp nhiều ticket cùng sự cố (center_geo, affected_count) |
| `TKT_sla_policies` | theo ticket_type × priority (P0–P3): time_to_acknowledge, time_to_resolve |
| `TKT_tickets` | ticket_number (#402), conversation_ref (soft→OMNI), customer_ref (soft), owner_agent (soft→PLAT), parent_incident (FK) |
| `TKT_ticket_state_transitions` | audit state machine (command: create/advance/reopen…) |
| `TKT_ticket_sla` | 2 đồng hồ: ack_due_at + resolve_due_at, resolve_breached, warning_sent_at |
| `TKT_sla_events` | WARNING / ACK_BREACH / RESOLVE_BREACH + minutes_remaining |
| `TKT_escalations` | nâng cấp mức + lý do |
| `TKT_outbox_events` | SlaWarning / TicketStateChanged / TicketClosed |

### 1.4 EXT_* (external — consume-only, không build)
| Hệ | Tích hợp |
|---|---|
| `EXT_Customer360` | Identity + hồ sơ KH; lookup zalo_id/SĐT; cache profile vào snapshot |
| `EXT_AI_Service` | vision/NLP/STT async; callback webhook → ai_annotations |
| `EXT_PBX` | tổng đài VoIP 1900; webhook call ringing/ended → OMNI_calls |
| `EXT_FieldTeam_FSM` | app đội hiện trường; outbound work_order + retry + DLQ |

## 2. Cross-cutting patterns (từ sơ đồ)

- **Bounded contexts + soft-ref**: nét liền = FK thật trong context; nét đứt = soft-ref chéo context / ra ngoài (KHÔNG có FK) → tách rời, deploy độc lập.
- **Transactional Outbox** (OMNI_outbox_events, TKT_outbox_events) → tích hợp event-driven tin cậy.
- **Inbound idempotency** (OMNI_idempotency_keys) → dedup webhook/message.
- **SLA 2 đồng hồ** (ack + resolve) + warning + escalation tự động.
- **AI async** (webhook callback) → annotation gắn vào message/attachment.
- **GIS** (incident geo, broadcast target_area Polygon, parent_incident center_geo).
- **Customer snapshot** (cache 360) → không sở hữu data KH.

## 3. PRD outline (scope theo sơ đồ)

| Nhóm tính năng | Mapping entity | Ưu tiên |
|---|---|---|
| Liên kết KH đa kênh + snapshot 360 | customer_links, customer_snapshots | P0 |
| Hội thoại đa kênh (Zalo/App/Web/Hotline/Counter) | conversations, messages, attachments | P0 |
| Ticketing + SLA (ack/resolve, warning, escalation) | tickets, ticket_sla, sla_events, escalations | P0 |
| Gọi tích hợp PBX (1900) | calls → EXT_PBX | P1 |
| AI annotate (intent/STT/vision) | ai_annotations → EXT_AI_Service | P1 |
| KB + deflection (FTS vi) | kb_articles, deflection_events | P1 |
| Broadcast theo vùng | broadcasts, broadcast_recipients | P1 |
| Khảo sát CSAT/NPS/CES | survey_responses | P1 |
| Sự cố + cluster + parent incident | incident_reports, parent_incidents | P1 |
| Dispatch lệnh công việc → FieldTeam | work_orders → EXT_FieldTeam_FSM | P2 |
| Agent presence + RBAC + audit | PLAT_users, agent_presence, audit_log | P0 |

## 4. Đối chiếu code hiện có (self-service slice) — giữ / làm lại / mới

Code hiện tại = **customer self-service BFF** (billing/contract/meter/payment/ticket/communication/customer/session + auth better-auth). So với sơ đồ:

| Hiện có | Trong sơ đồ | Xử lý |
|---|---|---|
| `ticket` module | ticketing.* (một phần) | **GIỮ + MỞ RỘNG**: thêm SLA (2 clocks), parent_incidents, state_transitions, escalations, outbox |
| `customer` module | customer_links/snapshots (consumer của EXT_Customer360) | **LÀM LẠI**: chuyển từ "profile port" sang link/snapshot theo context |
| `communication` (zalo/web/hotline/counter adapter) | omnichannel conversations/messages | **MỚI phần lớn**: conversations, messages, attachments, calls |
| `session` | cross-channel context (gắn conversation) | **GIỮ + ÁNH XẠ** vào conversation/session |
| `billing/contract/meter/payment` | dữ liệu 360 (snapshot / EXT_Customer360 downstream) | **GIỮ** làm nguồn data self-service (feed snapshot) |
| `auth` (better-auth — customer) | EXT_Customer360 (external) | **DEFERRED**: auth→IAM như đã chốt (Customer360 = IAM) |
| — | platform (agent IAM: PLAT_users/presence/audit) | **MỚI**: agent identity tách khách hàng |
| — | ai_annotations, kb deflection, broadcasts, surveys, incident_reports, work_orders, SLA, outbox, idempotency | **MỚI** (xây theo entity) |
| `libs/shared/port` + 14 port | pattern Hexagonal (áp dụng cho EXT_* + downstream) | **GIỮ** — dùng cho EXT_PBX/AI/FSM/Customer360 + downstream |

**Tóm:** ~30% giữ (ticket nhân, port infra, downstream data, session), ~20% làm lại (customer→link/snapshot, communication→conversations), ~50% mới (SLA, platform agent, AI, KB deflection, broadcast, survey, incident, work-order, outbox, idempotency).

## 5. Phasing đề xuất

- **Phase A — Omnichannel core**: customer_links/snapshots, conversations/messages, platform agent IAM, ticket+SLA, outbox, idempotency, audit.
- **Phase B — Intelligence & reach**: AI annotate, KB+deflection, broadcast, survey, calls (PBX).
- **Phase C — Field & incidents**: incident_reports/cluster, parent_incidents, work_orders (FSM dispatch).
- **Phase D — Auth→IAM** (deferred, như đã chốt; Customer360 = IAM).

## 6. Open items (cần xác nhận sau)
- Self-service portal (code hiện có) giữ làm **mặt khách** của nền tảng omnichannel, hay tách product?
- `platform` (agent IAM) dùng lại IAM nội bộ có sẵn hay build mới? (khác IAM khách hàng)
- EXT_* (Customer360/AI/PBX/FSM) đã có chưa — xác định contract/go-live từng bên.
