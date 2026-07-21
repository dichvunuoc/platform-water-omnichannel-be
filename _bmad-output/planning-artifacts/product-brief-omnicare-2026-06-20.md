---
title: "OmniCare — Nền tảng Chăm sóc Khách hàng Đa kênh"
product_name: "OmniCare"
project_name: "nestjs-project-example"
document_type: "Enterprise Product Brief"
version: "1.0 — Đồng bộ với PRD v1.3 (tiếng Việt)"
status: "Đã đồng bộ với PRD v1.3"
date: "2026-07-01"
author: "Pc"
communication_language: "Vietnamese"
document_output_language: "Vietnamese"

# Trạng thái workflow
workflow: "create-product-brief"
stepsCompleted: [1, "realign-to-prd-v1.3"]
currentStep: "complete (re-aligned)"
outputFile: "_bmad-output/planning-artifacts/product-brief-omnicare-2026-06-20.md"

# Tài liệu đầu vào
inputDocuments:
  primary: "prd.md (v1.3, tiếng Việt) — capability contract đã chốt"
  upstream_original: "product-brief-omnicare-2026-06-20.md v0.3 (bản gốc tiếng Anh, 2026-06-20)"

# Quyết định sản phẩm & kiến trúc đã chốt (đồng bộ PRD v1.3)
locked_decisions:
  product_identity: "Nền tảng Chăm sóc Khách hàng Đa kênh (contact-center) cho tiện ích công; field-operations (FSM/GIS) là tích hợp xuôi dòng, không phải năng lực sản phẩm cốt lõi"
  architecture_style: "Modular monolith (bounded-context rõ ràng) + Ports & Adapters (hexagonal); mock-first MVP; port IEventBus cho phép tách ra microservice sau nếu cần"
  deployment_strategy: "MỘT deployable duy nhất (backend OmniCare) chứa module Omnichannel + module Ticketing (trong-project, schema riêng) + BFF. Ticketing KHÔNG còn là microservice riêng — đảo ngược quyết định 'microservices-from-day-1' của v0.3 r4. Event bus trong-process (IEventBus); broker (RabbitMQ) trì hoãn, lắp sau qua cùng port."
  ai_strategy: "Core là 100% routing & communication. Mọi AI (vision, NLP, speech-to-text) external hóa qua Mock Adapter Phase 1; gọi bất đồng bộ (BullMQ) + webhook callback, không bao giờ block event loop"
  message_to_ticket_link: "Ingress chịu lỗi (200-OK + idempotency) là bắt buộc; webhook không bao giờ block — nay giao tiếp trong-process qua IEventBus"
  eventual_consistency_ux: "Optimistic UI ở BFF (render ngay, reconcile qua WebSocket push)"
  ticketing_module: "Bounded-context module TRONG-PROJECT (src/modules/ticketing), cùng deploy, schema riêng; SLA chạy background worker phát SlaWarning/SlaBreached. Real từ wave-1 (thay thế stub)."
  frontend_scope: "Agent-workspace SPA đã được BÀN GIAO (5 màn hình) — consumed client, KHÔNG build lại; backend conform theo contract FE đã gọi"
  integration_hookups: "Telephony = signaling-only qua PBX webhook; Customer 360 qua Anti-Corruption Layer + fallback; AI async qua BullMQ; FSM qua outbound webhook + retry + DLQ (chi tiết PRD §8.5)"
  trade_acknowledged: "Chốt modular monolith (1 deployable) cho phạm vi demo/đồ án — đơn giản ops, bounded-context vẫn giữ ở mức module/schema; tách ra sau qua ADR-1 extraction path"

revision_history:
  - "2026-06-20 r1: scaffold ban đầu (v0.1)."
  - "2026-06-20 r2: làm rõ scope AI — toàn bộ AI external hóa (call & display only); bỏ phần dư OCR/meter-reading (YOLOv8/Bayesian); thêm port AudioAI + NLP."
  - "2026-06-20 r3: chốt backend approach (modular monolith → extract; in-process event bus → Kafka; socket.io)."
  - "2026-06-20 r4: đảo ngược sang distributed microservices từ Day 1 (2 service + RabbitMQ) theo leadership direction."
  - "2026-07-01 r5: ĐỒNG BỘ PRD v1.3 — đảo ngược r4: Ticketing gộp về in-project module (modular monolith, 1 deployable, in-process IEventBus); frontend đã bàn giao (out of scope); bổ sung integration hookups (PBX/ACL/BullMQ/DLQ); chuyển tiếng Việt."
---

# Product Brief: OmniCare
## Nền tảng Chăm sóc Khách hàng Đa kênh

> **Chú thích:** 🔒 = đã **chốt** (locked) · 🔍 = **mở**, sẽ cụ thể hóa ở workflow sau. Hầu hết mục 🔍 của bản gốc đã được PRD v1.3 chốt và giải quyết.
> **Trạng thái:** v1.0 — đã đồng bộ với [PRD v1.3](./prd.md) (tiếng Việt).

---

## 1. Định danh & Tầm nhìn sản phẩm 🔒

**Tên sản phẩm:** OmniCare
**Tagline:** *Một inbox. Mọi kênh. Mọi khách hàng — phục vụ thời gian thực.*
**Phân loại:** Nền tảng Chăm sóc Khách hàng Đa kênh (CS), thiết kế riêng cho vận hành tiện ích công.

**Tầm nhìn:**
OmniCare thống nhất các điểm chạm khách hàng phân mảnh của một công ty cấp nước — **Zalo OA, App khách hàng di động, Email, và tổng đài VoIP/1900** — vào một workspace agent thời gian thực duy nhất. Mọi hội thoại đến được chuẩn hóa về một định dạng, ràng buộc vào một ticket có **SLA chịu trách nhiệm có thể thực thi**, và trình bày kèm **góc nhìn khách hàng 360°** cùng **AI insight** (tag, transcript) lấy từ adapter external. Kết quả: giải quyết nhanh hơn, chất lượng phục vụ đo lường được (CSAT/NPS), và một contact center chịu lỗi **không bao giờ đánh rơi tin nhắn khách hàng ở cửa**.

**Vì sao tồn tại (điểm khác biệt):**
Cốt lõi là **routing tin nhắn siêu chịu lỗi + trải nghiệm agent thống nhất thời gian thực + vải tích hợp đặc thù tiện ích** — Customer 360 (hợp đồng, công nợ, lịch sử tiêu thụ) và định danh. Quan trọng: **AI là năng lực cắm-được, external hóa** (vision, NLP, speech) *được gọi qua adapter* — không phải model nặng platform phải host. Điều này giữ OmniCare nhanh, nhẹ vận hành, và tránh rủi ro bị chìm dưới các model AI nặng.

---

## 2. Người dùng mục tiêu & Persona 🔒
- **Agent (Tổng đài viên):** người dùng chính của Agent Workspace — xử lý hội thoại đa kênh trong một inbox.
- **Team Lead / Supervisor:** giám sát tuân thủ SLA, KPI dashboard, escalation.
- **Khách hàng:** liên hệ qua Zalo OA / App / Web / VoIP 1900.
- *(Kỹ sư hiện trường — xuôi dòng FSM, không phải người dùng trực tiếp của OmniCare.)*

---

## 3. Tuyên bố vấn đề 🔒
Hiện nay tương tác khách hàng **phân mảnh** qua Zalo, App, Email và tổng đài, không có góc nhìn agent thống nhất, **không có SLA chịu trách nhiệm**, triage thủ công, và **không đo CSAT khép vòng**. Agent thiếu ngữ cảnh khách hàng (hợp đồng, công nợ, tiêu thụ) tại thời điểm tương tác, và không có đảm bảo chịu lỗi trước timeout webhook đối tác.

---

## 4. Ranh giới phạm vi 🔒

| Trong phạm vi (sản phẩm cốt lõi) | Ngoài phạm vi (xuôi dòng / tích hợp qua port) |
|---|---|
| Thống nhất kênh (Zalo OA, App, Email, VoIP) | Field operations / FSM / GIS dispatch (gọi ra, không sở hữu) |
| Workspace agent hợp nhất (Inbox, Kanban, Dashboard, Softphone) | Toàn bộ logic AI — vision, NLP, speech-to-text (qua Mock Adapter, không sở hữu) |
| Vòng đời Ticket + giám sát SLA (**module trong-project v1.3**) | Billing & hệ thống nguồn Customer 360 (tích hợp chỉ-đọc) |
| Góc nhìn Customer 360 (tích hợp) | Hạ tầng carrier telephony (nhà cung cấp VoIP/PBX) |
| Đo CSAT/NPS | Hosting model chatbot / AI hội thoại (sau port Chatbot) |
| Hiển thị AI Insight trên UI (Tag, Transcript) lấy qua adapter | **Frontend SPA đã bàn giao** (consumed client — không build lại) |

---

## 5. Kiến trúc (quyết định đã chốt) 🔒

### 5.1 Phong cách kiến trúc
**Modular monolith + Ports & Adapters (Hexagonal)**, với **mock-first MVP**. Một deployable duy nhất (backend OmniCare) chứa module Omnichannel + module Ticketing + lớp BFF; các năng lực phức tạp/external/biến đổi nằm sau **port interface** (mock Phase 1, đổi adapter thật sau).

### 5.2 🔒 CHỐT — Liên kết Message → Ticket chịu lỗi (200-OK)
> **Quyết định:** Ingress nhận webhook (vd Zalo), lưu/chuẩn hóa tin, **trả `200 OK` ngay lập tức** — không bao giờ block chờ ghi Ticket.
> **Lý do:** Ingress chịu lỗi là bắt buộc. Webhook Zalo không bao giờ được block chờ DB insert Ticket — cửa sổ timeout của đối tác không phải của chúng ta.
> **Đổi so với v0.3:** giao tiếp nay **trong-process** qua `IEventBus` (Ticketing cùng deploy), không còn qua broker RabbitMQ. Nguyên tắc 200-OK + idempotency + outbox giao dịch vẫn giữ để không mất tin khi crash.
> **Mô hình nhất quán:** eventual consistency; ticket binding reconcile qua push WebSocket trong cửa sổ async ngắn.
> **Source of truth** trạng thái ticket = **module Ticketing**.

### 5.3 🔒 CHỐT — Ticketing & SLA là module TRONG-PROJECT (v1.3)
> **Quyết định:** Ticketing & SLA là một bounded-context module cùng deploy (`src/modules/ticketing`, schema riêng), KHÔNG phải microservice riêng.
> **Lý do:** (a) bounded-context vẫn tách biệt (aggregate Ticket ≠ message); (b) SLA monitoring vẫn là **background worker** (không phải request/response); (c) đơn giản ops cho phạm vi demo/đồ án; (d) contract + `IEventBus` port được giữ → tách ra microservice sau chỉ là config/port swap (ADR-1 extraction path).
> **Đổi so với v0.3:** đảo ngược quyết định "Ticketing là service riêng" — modular monolith thay vì 2 deployable.
> **SLA engine:** background worker phát `SlaWarning` / `SlaBreached` qua `IEventBus`; chính sách SLA (theo kênh/ưu tiên) lưu thành **dữ liệu**, không phải code.

### 5.4 Phân rã (Phase 1) — backend
- **Module Omnichannel** (build trực tiếp): ingress webhook, chuẩn hóa, idempotency, outbound, conversation/incident, KB, broadcast, thu CSAT, realtime gateway (socket.io), outage clustering.
- **Lớp BFF** (build trực tiếp): gateway HTTP duy nhất cho SPA, tổng hợp đọc, fan-out ghi, auth/RBAC, bootstrap ≤1s.
- **Module Ticketing** (build trực tiếp, **v1.3**): aggregate `Ticket` + state machine + dual-clock SLA + breach worker + escalation + reopen + parent-incident (FR61).
- **Port external (mock adapter):** AI Vision, NLP, AudioAI (speech-to-text), Chatbot, KB (Phase 1 mock → thật sau), IAM, Customer 360, VoIP/PBX Telephony, FSM & GIS.
- **Frontend SPA:** ⛔ **đã bàn giao** (5 màn hình) — consumed client, không build ở đây.

### 5.5 Dữ liệu & Hạ tầng
PostgreSQL (instance chung, **schema theo module**) + PgBouncer + Read Replica (report nặng); Redis (session, cache profile, idempotency keys, WS backfill); ElasticSearch (KB + full-text message); **`IEventBus` trong-process** (broker RabbitMQ/Kafka trì hoãn — lắp sau qua cùng port khi cần). **Observability:** Loki (log) + Prometheus (metric) + Grafana (dashboard) + Jaeger/OpenTelemetry (trace_id lan truyền toàn luồng) + Kubernetes (HPA ở peak chỉ số nước). Tất cả đã scaffold sẵn trong repo.

### 5.6 🔒 CHỐT — AI hoàn toàn external (chỉ gọi & hiển thị)
> **Quyết định:** Core OmniCare **100% routing & communication**. Hệ thống **không** sở hữu hay chạy bất kỳ model AI nào. Toàn bộ AI — vision, NLP intent, speech-to-text — **external hóa qua Mock Adapter** Phase 1 (và qua microservice external thật sau). Core chỉ **gọi và hiển thị** AI insight (tag, transcript) trên UI.
> **Cách gọi:** **bất đồng bộ** — đẩy job vào Queue (BullMQ) → AI xử lý → webhook ngược → push tag qua WebSocket; circuit-breaker đảm bảo AI chậm/down không block ingestion (NFR22).

### 5.7 🔒 CHỐT — Móc nối tích hợp (Integration Hookups)
> Tóm tắt (chi tiết đầy đủ: [PRD §8.5](./prd.md)):
> - **Telephony:** signaling-only qua PBX webhook (`call.ringing` → screen-pop; `call.ended` → URL ghi âm); NestJS không xử lý RTP.
> - **Customer 360:** qua **Anti-Corruption Layer** (`GET /customers/lookup`); fallback "Khách Vô Danh" khi down — không block chat.
> - **AI:** bất đồng bộ BullMQ + webhook callback.
> - **FSM:** outbound webhook + retry + DLQ khi ticket DISPATCHED — lệnh giao việc không bị rơi.

---

## 6. Phase 1 — Phạm vi MVP 🔒

**Định nghĩa MVP:** *backend build trực tiếp (module Omnichannel + module Ticketing + BFF) + port mock = một trải nghiệm agent end-to-end demonstrable với dữ liệu thực — không phụ thuộc cứng external. Frontend đã bàn giao nên demo chạy ngay vào FE thật.*

### Phần 1 — Build trực tiếp (backend, v1.3)
- **Module Omnichannel:** ingress webhook (Zalo, FB, App, Email), chuẩn hóa về định dạng chung, **idempotency**, outbound send, conversation/incident, KB (mock Phase 1), broadcast, thu CSAT, realtime gateway (socket.io push ≤2s).
- **Lớp BFF:** gateway HTTP duy nhất, tổng hợp cho Dashboard/Inbox, WebSocket push, Optimistic UI reconciliation, bootstrap ≤1s.
- **Module Ticketing:** aggregate `Ticket` + state machine + dual-clock SLA + breach worker (phát `SlaWarning`/`SlaBreached`) + escalation + reopen (FR27) + parent-incident (FR61).
- **(Frontend:** ⛔ đã bàn giao — không build.)

### Phần 2 — Mock Adapter (port external)
- **AI Vision Port:** mock — URL ảnh → JSON (`{"tag":"Vỡ / bể ống","confidence":0.97}`).
- **NLP Port:** mock — tin chat → intent.
- **AudioAI Port:** mock — audio 1900 → transcript.
- **Customer 360 Port:** mock profile (công nợ, loại KH, địa chỉ) + định danh zalo_id.
- **VoIP/PBX Telephony Port:** mock webhook 1900 (ring/answer) + URL ghi âm.
- **FSM & GIS Port:** mock dispatch đội hiện trường + tọa độ bản đồ.
- **KB / Chatbot / IAM Port:** mock canned response, auto-handling, agent token.

### Trì hoãn sang phase sau
- **Adapter thật:** Customer 360, VoIP/PBX, AI (vision/NLP/speech), KB CMS + search thật, CSAT delivery đa kênh (SMS/Push), NPS/CES, FSM/GIS depth.
- **(KHÔNG còn "Real Ticketing Service" trì hoãn — đã build trong-project từ Phase 1 theo v1.3.)**

---

## 7. Mục mở cho khám phá có hướng dẫn 🔍
*(phần lớn đã được PRD v1.3 giải quyết — giữ lại các mục chưa cụ thể hóa)*
- **SLA policy cụ thể:** ngưỡng theo kênh & ưu tiên; đường escalation (PRD §10 NFR + Story T-2/T-3).
- **Identity resolution:** golden record, dedup, đa tài khoản/đa hợp đồng.
- **Rủi ro & giảm thiểu:** event-ordering/dedup, edge case nhất quán thoáng.
- **NFR:** peak RPS, capacity/cost, HA/DR (PRD §10).
- **Roadmap / Timeline** chi tiết.

---

*Tài liệu scaffold 2026-06-20 qua BMAD `create-product-brief`, được đồng bộ lại tiếng Việt + PRD v1.3 vào 2026-07-01 (r5).*
