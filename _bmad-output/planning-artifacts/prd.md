---
title: "OmniCare — Tài liệu Yêu cầu Sản phẩm (PRD)"
project_name: "nestjs-project-example"
product_name: "OmniCare"
document_type: "Product Requirements Document (PRD)"
workflowType: "prd"
version: "1.3 — Phạm vi backend (backend OmniCare bao gồm module Ticketing trong-project + BFF; frontend đã bàn giao)"
status: "Đã sửa đổi — PRD v1.3"
date: "2026-07-01"
revision_note: "v1.3 gộp năng lực Ticketing & SLA VÀO project này: được xây dựng như một bounded-context module trong-project (schema riêng, ngôn ngữ ubiquitous riêng), cùng deploy trong backend OmniCare — KHÔNG còn là microservice riêng. Điều này đảo ngược quyết định tách (split) của v1.1. 7 FR trước đây gắn tag [TKT-SVC] (contract tiêu thụ) nay thuộc phạm vi build, đổi tag thành [TKT] (module Ticketing trong-project). Omnichannel ↔ Ticketing giao tiếp trong-process qua port IEventBus (có thể lắp broker thật sau qua cùng port); outbox giao dịch + idempotency vẫn đảm bảo không mất tin nhắn khi crash. Phạm vi v1.2 (chỉ backend; frontend đã bàn giao) không đổi. Tài liệu chuyển sang tiếng Việt để dễ hiểu."
author: "Pc"
communication_language: "Vietnamese"
document_output_language: "Vietnamese"

# Trạng thái workflow
workflow: "prd (create mode)"
stepsCompleted: ["step-01-init", "step-02-discovery", "step-03-success", "step-04-journeys", "step-05-domain", "step-06-innovation", "step-07-project-type", "step-08-scoping", "step-09-functional", "step-10-nonfunctional", "step-11-polish", "step-12-complete"]
currentStep: "complete"
outputFile: "_bmad-output/planning-artifacts/prd.md"

# Tài liệu đầu vào
inputDocuments:
  primary: "product-brief-omnicare-2026-06-20.md"
  supplementary: "backend-build-plan-omnicare-2026-06-20.md"
documentCounts:
  briefCount: 1
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 4

classification:
  projectType: "dịch vụ backend — backend OmniCare (module Omnichannel + module Ticketing trong-project + lớp BFF) dưới dạng một deployable duy nhất (REST + WebSocket gateway, event bus trong-process). Đặc tính nền tảng (RBAC, tích hợp, tuân thủ). Frontend SPA đã bàn giao (ngoài phạm vi)."
  domain: "govtech (dịch vụ khách hàng công nghiệp / tiện ích công khu vực)"
  complexity: "cao"
  projectContext: "brownfield (backend NestJS có sẵn, mở rộng thêm OmniCare greenfield)"
  buildScope: "Chỉ backend: backend OmniCare (một deployable) chứa module bounded-context Omnichannel, module bounded-context Ticketing & SLA (cùng deploy, schema riêng) và lớp BFF. Frontend SPA đã bàn giao — không build ở đây; backend cung cấp các API/event/WebSocket mà frontend tiêu thụ. Ticketing & SLA nay được BUILD TRONG-PROJECT (v1.3) — không còn là microservice riêng."
  open_clarifications: "đã giải quyết (Bước 5) — nhà vận hành là SOE; triển khai on-prem/cloud trong nước; đồng ý IVR; WCAG/Nghị định-13 dùng như hướng dẫn best-practice"
---

# Tài liệu Yêu cầu Sản phẩm — OmniCare

**Tác giả:** Pc
**Ngày:** 2026-07-01

> PRD cho **OmniCare — Nền tảng Chăm sóc Khách hàng Đa kênh (Omnichannel)**. Dựa trên Product Brief + Backend Build Plan + đặc tả nghiệp vụ Chương 5.
> **Trạng thái:** Đã sửa đổi v1.3 — contract năng lực. Thứ tự build (các wave ưu tiên omnichannel) được quản lý bởi `execution-plan-omnicare.md`.
>
> **Phạm vi (v1.3 — chỉ backend):** **Frontend** workspace agent **đã được bàn giao** (5 màn hình). PRD này chỉ đặc tả **backend** — **backend OmniCare** (module Omnichannel + lớp BFF + **module Ticketing trong-project**) — tức các API, event, và luồng WebSocket mà frontend hiện tại tiêu thụ. Việc build UI, styling, browser/responsive/SEO **nằm ngoài phạm vi**. **Ticketing & SLA được build trong-project như một bounded-context module riêng** (cùng deploy, schema riêng, ngôn ngữ ubiquitous riêng) — v1.3 đảo ngược quyết định "microservice riêng" của v1.1. Các FR của nó gắn tag `[TKT]` (module Ticketing trong-project), được build tại đây. Customer 360 / AI / Field-team vẫn là **port external**.

---

## Mục lục

1. Tổng quan (Executive Summary)
2. Ranh giới dịch vụ (Bounded Contexts)
3. Tiêu chí thành công
4. Phạm vi sản phẩm
5. Hành trình người dùng
6. Yêu cầu đặc thù lĩnh vực
7. Đổi mới & Mẫu mới
8. Bề mặt backend, BFF & Realtime
9. Yêu cầu chức năng (Functional Requirements)
10. Yêu cầu phi chức năng (Non-Functional Requirements)

---

## 1. Tổng quan

**OmniCare** là nền tảng chăm sóc khách hàng đa kênh cho một công ty cấp nước đô thị (doanh nghiệp nhà nước — SOE), thống nhất Zalo OA, ứng dụng di động của khách hàng, Facebook, email và tổng đài VoIP/1900 vào một workspace agent thời gian thực duy nhất. Hệ thống ràng buộc mọi tương tác đến vào một ticket với cơ chế chịu trách nhiệm SLA có thể thực thi, trình bày góc nhìn khách hàng 360° bên cạnh mỗi hội thoại, và đo lường sự hài lòng (CSAT/NPS) để thúc đẩy cải tiến liên tục.

**Điểm khác biệt:** không giống các helpdesk dùng chung, OmniCare được thiết kế riêng cho vận hành tiện ích — một ingress chịu lỗi không bao giờ đánh rơi tin nhắn khách hàng, một trải nghiệm agent thống nhất, tích hợp Customer 360 (hợp đồng / công nợ / tiêu thụ), và một **cơ chế phân cụm sự cố diện rộng (mass-outage triage)** mới lạ, gộp hàng ngàn báo cáo vỡ ống đồng thời vào một parent incident duy nhất. AI là một năng lực cắm-được, external hóa — được gọi và hiển thị, không bao giờ tự sở hữu.

**Người dùng mục tiêu:** tổng đài viên (agent), trưởng ca (supervisor) và khách hàng (qua App / Zalo / Web / VoIP).

**Phạm vi build của PRD này (chỉ backend):** **module domain Omnichannel** (ingestion đa kênh, chuẩn hóa, định danh, giao thời gian thực, dữ liệu workspace agent, sự kiện telephony, broadcast, knowledge base, thu CSAT, tiếp nhận sự cố hiện trường) cộng **module Ticketing & SLA** (vòng đời ticket, engine SLA, breach worker, escalation, reopen, parent-incident — cùng deploy, schema riêng) và một **Backend-for-Frontend (BFF)** mà SPA React đã bàn giao giao tiếp tới. PRD này đặc tả **contract phía server** — API, event, và WebSocket gateway — cấp nguồn cho các màn hình hiện có; **frontend/UI không build ở đây**. BFF tổng hợp và đứng trước các port external. Các dịch vụ thực sự external được tiêu thụ cùng cách: Customer 360, Field-team App, AI services.

---

## 2. Ranh giới dịch vụ (Bounded Contexts)

> **Frontend** workspace agent **đã được bàn giao** (một SPA — xem 5 màn hình) và **nằm ngoài phạm vi build** của PRD này. Các module thanh bên (Điều hành CSKH, Inbox hợp nhất, Tổng đài 1900, Sự cố hiện trường, Ticket & SLA, KB, Thông báo chủ động, Khảo sát hài lòng) được phục vụ bởi **một BFF**. Bảng dưới định nghĩa *module backend nào sở hữu dữ liệu/thao tác phía sau mỗi module* — tức cái mà PRD này build. "Built in this PRD?" = được build ở **backend** (module Omnichannel, module Ticketing, hoặc BFF); frontend render nó đã tồn tại.

| Concern (backend) | Sở hữu | Build trong PRD này? |
|---|---|---|
| Ingestion đa kênh, 200-OK, idempotency, chuẩn hóa | **Module Omnichannel** | ✅ Có |
| Dữ liệu unified-inbox + chuỗi hội thoại + gateway push thời gian thực | **Module Omnichannel** | ✅ Có |
| Sự kiện telephony / dữ liệu screen-pop softphone (Tổng đài 1900) | **Module Omnichannel** (tiêu thụ VoIP/ACD) | ✅ Có |
| Tiếp nhận sự cố hiện trường + relay AI-tag + dữ liệu GIS-pin + trigger dispatch FSM (Sự cố hiện trường) | **Module Omnichannel** | ✅ Có |
| Knowledge Base / FAQ CMS + tìm kiếm tiếng Việt | **Module Omnichannel** | ✅ Có |
| Thông báo chủ động (Broadcast) | **Module Omnichannel** | ✅ Có |
| Thu CSAT/NPS/CES + gửi khảo sát (Khảo sát hài lòng) | **Module Omnichannel** | ✅ Có |
| Dữ liệu dashboard vận hành (Điều hành CSKH) — tổng hợp | **BFF** (tổng hợp omnichannel + ticketing + CSAT) | ✅ Có |
| BFF — gateway đọc/ghi duy nhất cho SPA, tổng hợp, fan-out | **BFF** | ✅ Có |
| **Vòng đời ticket, ID/owner, type/priority** | **Module Ticketing `[TKT]`** (trong-project) | ✅ Có |
| **Engine chính sách SLA, breach worker, phát `SlaWarning`, escalation, auto-reopen** | **Module Ticketing `[TKT]`** (trong-project) | ✅ Có |
| Dữ liệu Kanban Ticket & SLA + đếm ngược SLA cho Inbox (serve tới FE) | **BFF** → module Ticketing; dữ liệu relay tới FE đã bàn giao | ✅ Có (chỉ serve; UI đã có) |
| **Phát hiện / phân cụm** mass-outage (bán kính địa lý + cửa thời gian + độ tương tự loại sự cố) — *triage trước-ticket* | **Module Omnichannel** | ✅ Có |
| **Parent Incident như một nhóm các child ticket** (attach / detach / split ticket dưới một parent) | **Module Ticketing `[TKT]`** (trong-project) | ✅ Có |
| Dữ liệu affected-report / affected-customer cho parent incident (serve tới FE) | **BFF** (báo cáo omnichannel + grouping của Ticketing) | ✅ Có (chỉ serve; UI đã có) |
| Định danh / Customer 360 | Dịch vụ Customer 360 (external) | ❌ Tiêu thụ |
| Phân loại AI vision, NLP intent, speech-to-text, chatbot | Dịch vụ AI external | ❌ Tiêu thụ |
| **SPA workspace agent / mọi render UI, styling, browser/responsive/SEO** | **Frontend (đã bàn giao)** | ⛔ Ngoài phạm vi |

**Kiểu tích hợp:** module Omnichannel và module Ticketing **chạy cùng process** và giao tiếp qua **`IEventBus` trong-process** (các event: `MessageReceived`, `TicketCreateRequested`, `TicketStateChanged`, `SlaWarning`, `TicketClosed`, `CsatSubmitted`) — một broker thật (RabbitMQ) có thể được lắp vào sau qua cùng port mà không phải viết lại module nào. BFF thực hiện **tổng hợp đọc đồng bộ** (ví dụ: để render một hội thoại, nó join chuỗi omnichannel + thẻ Customer 360 + trạng thái ticket/SLA từ module Ticketing). Không có lời gọi frontend nào chạm trực tiếp module backend — mọi thứ đi qua BFF.

---

## 3. Tiêu chí thành công

### Thành công của người dùng
- **Agent** mở bất kỳ hội thoại nào và xem đầy đủ ngữ cảnh khách hàng (hợp đồng, công nợ, tiêu thụ) trong vòng 3 giây; đẩy lên hoặc giải quyết ticket trong 5 cú click.
- **Agent không bao giờ mất tin nhắn**: 100% tương tác đến (Zalo, App, Facebook, VoIP) xuất hiện trong inbox hợp nhất.
- **Supervisor** thấy các ticket sắp vi phạm SLA trước khi trễ hạn qua bộ đếm Kanban thời gian thực.
- **Khách hàng** nhận phản hồi đầu tiên trên kênh đã chọn trong SLA và đánh giá trải nghiệm tối thiểu 4.4/5.

### Thành công kinh doanh
- Tuân thủ SLA duy trì từ 94.2% trở lên (mục tiêu Phase-1; sàn 92%).
- CSAT từ 4.4/5 trở lên và NPS từ +58 trở lên.
- Tỷ lệ deflection từ 30% trở lên — tự động giải quyết truy vấn tra cứu hóa đơn và lịch cắt nước, giải phóng agent cho khiếu nại phức tạp (mục tiêu đo ở Growth-phase).
- Thời gian xử lý trung bình giảm so với baseline trước OmniCare.
- 100% tương tác truy vết end-to-end (khả năng kiểm toán GovTech).

### Thành công kỹ thuật
- Ingress chịu lỗi: 100% webhook đối tác được xác nhận trong timeout của đối tác, với không bị nghẽn ingestion — kể cả lúc peak.
- Giao thời gian thực: một tin đến mới hiển thị trên màn agent trong vòng 2 giây ở phân vị 95.
- Đồng thời peak: duy trì tối thiểu 1.000 người dùng đồng thời (CCU) qua lớp ingress và realtime, không rớt tin nhắn, trong ngày chỉ số nước và peak sự cố diện rộng.
- Idempotency: không trùng tin nhắn do retry mạng.
- Khả dụng: 99.9% trong giờ hành chính (mục tiêu là không rớt tin và màn agent luôn sống, không phải uptime trừu tượng).
- Hiển thị AI insight: tag và transcript do AI tạo xuất hiện trong 3 giây sau upload (chỉ SLA hiển thị; inference là external).

### Kết quả đo lường được

| Chỉ số | Mục tiêu | Cách đo |
|---|---|---|
| Tốc độ trả lời VoIP (80/20) | 80% cuộc gọi trả lời ≤ 20s | Thống kê VoIP/ACD |
| Tự động chào chat — phản hồi đầu tiên | ≤ 3 phút | Timestamp nhắn tin |
| Trả lời agent-trực-tiếp chat | ≤ 5 phút | Thời gian từ gán ticket đến trả lời |
| Phản hồi email / web-form | ≤ 4 giờ hành chính | Timestamp ticket |
| Tuân thủ SLA | ≥ 94.2% (mục tiêu Phase-1; sàn 92%) | Engine SLA của module Ticketing |
| CSAT | ≥ 4.4/5 | Khảo sát sau giải quyết |
| NPS | ≥ +58 | Khảo sát |
| Tỷ lệ deflection | ≥ 30% | Tự phục vụ KB/chatbot vs agent xử lý |
| Đồng thời peak | ≥ 1.000 CCU, 0 rớt | Load test ingress + realtime |
| Độ trễ push realtime | ≤ 2s (p95) | Telemetry gateway |
| Khả dụng (giờ hành chính) | 99.9% | Giám sát APM/uptime |
| Phạm vi truy vết kiểm toán | 100% tương tác | Sampling trace |

## 4. Phạm vi sản phẩm

> Thứ tự build (các wave ưu tiên omnichannel) được quản lý bởi `execution-plan-omnicare.md`. Phần này định nghĩa *những gì* thuộc phạm vi mỗi phase.

### Chiến lược & Triết lý MVP
**Cách tiếp cận MVP:** Experience MVP — một vòng lặp omnichannel agent thời gian thực end-to-end chất lượng demo (ingestion → định danh → push → ticket → cảnh báo vi phạm SLA → CSAT) với hệ thống external được mock, **được dẫn dắt bởi backend (Omnichannel + BFF + module Ticketing) vào frontend đã bàn giao**. Thiết kế để **demo kết luận được trước hội đồng đánh giá** — một vòng lặp sống, dẫn dắt bởi dữ liệu, không phải UI tĩnh.
**Nguồn lực:** đội backend nhỏ (module Omnichannel + BFF + module Ticketing) + DevOps, hấp thụ bởi stack K8s/OTel/Loki hiện có. Frontend đã bàn giao (không build FE); tích hợp FE↔backend chỉ là nỗ lực phù hợp contract.

### Bộ tính năng MVP (Phase 1)
**Các hành trình cốt lõi được hỗ trợ:** J1 (sự cố Zalo), J2 (cuộc gọi khiếu nại hóa đơn), J3 (chữa cháy SLA) — mỗi hành trình demo được end-to-end.
**Must-have (Omnichannel + BFF + module Ticketing — phạm vi này):**
- Ingestion đa kênh + 200-OK + idempotency + chuẩn hóa.
- Push thời gian thực (Inbox + screen-pop Softphone).
- **Tương tác ticket qua module Ticketing trong-project:** tạo ticket từ hội thoại (gọi create command của module Ticketing), hiển thị trạng thái ticket, và **render event `SlaWarning`** do SLA worker của module Ticketing phát trên Kanban / Inbox (chớp đỏ + đếm ngược) — *cần cho demo J3*. Engine SLA + breach worker nằm trong **module Ticketing** (xem §9.3), cùng deploy trong-process.
- **Bề mặt backend cho FE hiện tại:** endpoint REST/gRPC + gateway WebSocket + event cấp nguồn cho các màn hình đã bàn giao — feed Inbox hợp nhất, dữ liệu SLA Kanban (từ BFF → module Ticketing), truy vấn Knowledge Base (FAQ), tiếp nhận sự cố hiện trường, screen-pop Softphone, gửi Broadcast, khảo sát CSAT. **Không build UI; frontend đã tồn tại** và tích hợp theo các contract này.
- **URL ghi âm cuộc gọi** trong lịch sử tương tác (file audio mock) — *bằng chứng retention*.
- Mock adapter: định danh, Customer 360, hiển thị AI insight, Audio AI tĩnh. (Module Ticketing ship là module **thật** ngay từ v1.3; stub trong-bộ-nhớ chỉ giữ lại làm toggle fallback cho local-dev/demo.)
- RBAC (Agent/Supervisor/Admin).

**Demo MVP (J1/J2/J3):** vòng đời ticket + engine chính sách SLA + breach worker phát `SlaWarning` — tất cả build trong module Ticketing trong-project. Không phụ thuộc external; demo kết luận được ngay tự thân.

### Tính năng post-MVP
**Phase 2 (Growth):**
- Adapter thật (IAM, Customer 360, VoIP, AI vision/NLP/audio).
- IVR đa nhánh + routing theo kỹ năng/địa bàn (§5.1).
- Dự báo khối lượng AI (§5.1 / external 10.6).
- CSAT nâng cao + NPS định kỳ + closing-the-loop (auto-reopen khi <3★) (§5.3).
- Triage Parent-Incident · Khách tự theo dõi (J6) · đo deflection (J4).

**Phase 3 (Vision):** tích hợp AI nâng cao · chiều sâu field-service · multi-tenant.

### Chiến lược giảm rủi ro
| Rủi ro | Giảm thiểu |
|---|---|
| Ranh giới module Omnichannel ↔ Ticketing | contract module/command-bus rõ ràng + idempotency + outbox giao dịch; event có version; contract test ở ranh giới module; load test 1.000 CCU |
| Độ chính xác phân cụm Parent-Incident | shadow-mode trước khi tự động |
| Agent chấp nhận | đào tạo + UX desktop dày đặc |
| Deflection phụ thuộc chatbot external | đo độc lập |
| Chi phí vận hành đa-module | dựa vào stack K8s/OTel/Loki hiện có |

---

## 5. Hành trình người dùng

### Hành trình 1 — Giải quyết sự cố Zalo (Tốc độ & Định danh)
**Nhân vật:** Bác Nam (khách hàng) + Trà (agent) · **Kênh:** Zalo OA
- **Mở:** Ống nước vỡ trước nhà Nam; ông chụp ảnh và gửi qua Zalo OA của công ty.
- **Phát triển:** Ingress xác nhận bằng HTTP 200 lập tức (không timeout Zalo), chuẩn hóa tin về định dạng chung, và phát một event. Chatbot nhận diện contact lạ và hỏi mã khách hàng hoặc SĐT; Nam cung cấp; định danh liên kết Zalo ID với profile "Nguyễn Văn Nam." Tin và ảnh push tới inbox hợp nhất của Trà trong 2 giây, kèm thẻ Customer 360 (hợp đồng, lịch sử công nợ).
- **Cao trào:** Trà nắm bắt vấn đề và tạo incident ticket trong một cú click; workspace gửi `TicketCreateRequested` tới **module Ticketing** (trong-project), module này mở ticket và khởi động đồng hồ SLA. (Nếu service vision external được nối, một tag phân loại sự cố có thể hiển thị — external, không build.)
- **Giải quyết:** Đội hiện trường xử lý xong; Trà đẩy ticket sang Done (thao tác proxy qua BFF tới module Ticketing); khảo sát CSAT được gửi qua Zalo bởi module Omnichannel; Nam đánh giá 5 sao.
- **Năng lực:** ingestion + idempotency + 200-OK chịu lỗi · định danh · Customer 360 · push realtime · **tạo-ticket + đổi-trạng-thái qua module Ticketing** · vòng lặp CSAT.

### Hành trình 2 — Cuộc gọi khiếu nại hóa đơn (Định danh trước khi bắt máy)
**Nhân vật:** Chị Hoa (khách hàng, bực tức) + Minh (agent) · **Kênh:** VoIP 1900
- **Mở:** Hóa đơn Hoa tăng vọt; cô gọi 1900, khó chịu.
- **Phát triển:** Khi đổ chuông, tích hợp telephony gửi số gọi; softphone của Minh auto-pop profile của Hoa và biểu đồ tiêu thụ (×3 tháng này) trước khi anh bắt máy.
- **Cao trào:** Minh bắt máy trong mục tiêu 80/20 và bình tĩnh giải thích giá bậc thang và các bước kiểm tra rò rỉ, nhờ ngữ cảnh có sẵn. (Một transcript speech-to-text external có thể hiển thị — external, không build.)
- **Giải quyết:** Hoa hài lòng; Minh ghi nhận kết quả vào timeline khách hàng chung.
- **Năng lực:** screen-pop VoIP (định danh-trước-khi-bắt-máy) · Customer 360 · SLA 80/20 · timeline chung.

### Hành trình 3 — Chữa cháy SLA (Supervisor)
**Nhân vật:** Tuấn (trưởng ca) · **Kênh:** Kanban nội bộ
- **Mở:** Một luồng tin tràn vào ngày chỉ số nước.
- **Phát triển:** Background worker của **module Ticketing** quét hàng ngàn ticket và phát hiện #402 (mất nước) quá hạn 3 giờ, còn 15 phút nữa là vi phạm SLA.
- **Cao trào:** Module Ticketing phát `SlaWarning` qua event bus; **workspace omnichannel tiêu thụ nó** và Kanban của Tuấn (của cả agent đang giữ) chớp viền đỏ với bộ đếm nhấp nháy.
- **Giải quyết:** Tuấn gán lại #402 cho một agent rảnh — thao tác proxy qua BFF tới module Ticketing; khách hàng được gọi lại; SLA 94.2% được giữ.
- **Năng lực:** **SLA breach worker (module Ticketing)** · `SlaWarning` tiêu thụ + render realtime (omnichannel) · cảnh báo trực quan Kanban · gán-lại supervisor (proxy) + phân quyền.

### Hành trình 4 — Deflection tự phục vụ (Giảm tải tự động)
**Nhân vật:** Anh Khang (khách hàng) · **Kênh:** Zalo/App
- **Mở:** Khang thấy thông báo cắt nước theo lịch và hỏi khi nào có nước lại.
- **Phát triển:** Knowledge base khớp "Lịch cắt nước P. Hòa Bình" và trả về lịch cùng bản đồ khu vực bị ảnh hưởng trong vài giây. (Việc xử lý hội thoại do chatbot external cung cấp — external, không build; hệ thống tích hợp và đo lường.)
- **Cao trào / Giải quyết:** Không có agent nào can thiệp và không tạo ticket; tương tác đóng góp vào mục tiêu deflection ≥30%.
- **Năng lực:** tìm kiếm knowledge-base · đo deflection · hook tích hợp chatbot (bot external).

### Hành trình 5 — Định danh không giải quyết được (Phục hồi lỗi)
**Nhân vật:** Một thuê bao mới (không profile) + agent · **Kênh:** App
- **Mở:** Khách nhắn tin, nhưng định danh không khớp profile nào.
- **Phát triển:** Tin bị đánh dấu "unidentified" nhưng vẫn được lưu (không mất tin); nó xuất hiện với agent kèm đường fallback.
- **Cao trào / Giải quyết:** Agent tạo profile tạm / chuyển tới onboarding, và khách được phục vụ qua fallback.
- **Năng lực:** xử lý lỗi định danh · fallback êm · đảm bảo không-mất-tin · tạo profile thủ công.

### Hành trình 6 — Khách tự theo dõi
**Nhân vật:** Một khách hàng · **Kênh:** App My Công ty
- **Mở:** Khách muốn biết trạng thái sự cố đã báo mà không cần gọi.
- **Phát triển:** Khách mở App My Công ty và nhập mã tra cứu.
- **Cao trào / Giải quyết:** App hiển thị giai đoạn hiện tại của ticket (theo dõi kiểu Grab/Shopee) — đã nhận, đang xử lý, đã giao đội hiện trường, đã giải quyết — không cần liên hệ agent.
- **Năng lực:** tự theo dõi ticket · tra cứu trạng thái ticket theo mã · tích hợp app (My Công ty / module 7.1).

### Tóm tắt yêu cầu hành trình

**Trong phạm vi build (module Omnichannel + BFF + module Ticketing) → thành Yêu cầu chức năng:**
- Ingestion đa kênh + idempotency + 200-OK chịu lỗi.
- Push realtime ≤ 2s (inbox + softphone).
- Định danh (channel ID → profile), kể cả fallback/lỗi và tạo thủ công.
- Góc nhìn Customer 360 (hợp đồng / công nợ / tiêu thụ / timeline chung) — *qua port Customer 360*.
- **Thao tác tạo-ticket + đổi-trạng-thái gọi module Ticketing trong-project**, và **`SlaWarning` tiêu thụ + render** trên Kanban/Inbox (engine/worker nằm trong module Ticketing).
- Khách tự theo dõi ticket (mã tra cứu) — *đọc trạng thái ticket từ module Ticketing qua BFF*.
- Khảo sát CSAT khi giải quyết (thu + gửi tại đây; auto-reopen khi điểm thấp do module Ticketing xử lý).
- Tự động chào (không-AI) + gợi ý câu trả lời mẫu + tìm kiếm knowledge-base.
- Tiếp nhận sự cố hiện trường (ảnh → hiển thị AI-tag → GIS pin → trigger dispatch FSM).
- Thông báo chủ động (cắt nước / xả / bảo trì) theo khu vực.
- Công cụ supervisor (render cảnh báo Kanban, gán-lại proxy, phân quyền).
- Screen-pop VoIP + SLA 80/20 + ghi âm (retention).
- Năng lực hiển thị AI insight (một plug — render tín hiệu AI external; không bao giờ chạy inference).
- Dashboard vận hành (KPI tổng hợp BFF).

**Tiêu thụ từ port external (KHÔNG build trong PRD này):**
- Customer 360 / Identity service: profile, hợp đồng, công nợ, tiêu thụ.
- Field-team App: Work Order.

**Ngoài phạm vi build (AI external, qua API sau):**
- Phân loại AI vision, NLP intent, speech-to-text, chatbot hội thoại.
- Ghi chú: mục tiêu deflection ≥30% và hiển thị AI insight phụ thuộc việc nối các service external này.

> **(v1.3)** Ticketing & SLA không còn nằm trong danh sách tiêu thụ — nó được build trong-project như module Ticketing (xem §9.3).

---

## 6. Yêu cầu đặc thù lĩnh vực

> **Nhà vận hành:** doanh nghiệp nhà nước (SOE) đô thị/khu vực. Độ nghiêm ngặt enterprise (RBAC, audit logging, truy vết) được áp dụng như best-practice kiến trúc. Các tiêu chuẩn quy định (Nghị định 13/2023, WCAG 2.1 AA) định hướng kiến trúc như **hướng dẫn best-practice** chứ không phải cổng chứng nhận cứng ngay lập tức.

### Tuân thủ & Quy định
- **Bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP):** áp dụng như hướng dẫn best-practice — đồng thuận, giới hạn mục đích, retention, và quyền chủ thể dữ liệu với mọi PII khách hàng (SĐT, địa chỉ, hợp đồng, công nợ, tiêu thụ, CSAT).
- **Minh bạch ghi âm (§5.1):** một **thông báo IVR tự động** ("Cuộc gọi này có thể được ghi âm để cải thiện chất lượng phục vụ…") phát trước khi chuyển tới agent, đáp ứng minh bạch cho retention ghi âm 90 ngày.
- **An ninh mạng (Luật An ninh mạng 2018):** logging, báo cáo sự cố, và bảo vệ dữ liệu áp dụng như best-practice.
- **Khả năng kiểm toán / minh bạch (SOE):** truy vết 100% tương tác (trace_id), log bất biến, retention định nghĩa rõ.

### Ràng buộc kỹ thuật
- **Residency / chủ quyền dữ liệu:** triển khai **on-premise hoặc cloud trong nước (Việt Nam)**; PII khách hàng và profile tiêu thụ nằm trong biên giới quốc gia.
- **Bảo mật:** mã hóa in-transit + at-rest · RBAC (agent/supervisor/admin) · least-privilege · audit logging.
- **Quyền riêng tư:** tối thiểu dữ liệu · quản lý đồng thuận · chính sách retention (ghi âm 90 ngày) · xử lý yêu cầu truy cập/xóa của chủ thể dữ liệu.
- **Khả năng tiếp cận (WCAG 2.1 AA như hướng dẫn):** tuân thủ UI thuộc về **frontend đã bàn giao** (ngoài phạm vi backend này); backend serve nội dung KB/tự-theo-dõi **dạng cấu trúc, ngữ nghĩa** (tiêu đề, nhãn, trường alt-text, language tag) không cản trở AA.
- **Hiệu năng / Khả dụng:** realtime ≤ 2s · ≥ 1.000 CCU peak · 99.9% giờ hành chính.

### Yêu cầu tích hợp *(các port — từ Chương 5)*
**Module Ticketing** (trong-project, qua event bus trong-process + đọc BFF) · Customer 360 (1.1) · My Công ty App (7.1) · Business Dashboard (9.1) · AI Chatbot (10.1, external) · AI Forecasting (10.6, external) · Field-team Mobile App (Work Order).

### Mẫu lĩnh vực — Triage sự cố mất nước diện rộng (đặc thù tiện ích)
Mạng nước hỏng theo địa lý: vỡ ống chính kích hoạt **hàng ngàn báo cáo gần-đồng-thời** từ một khu vực. Vượt sức chứa tĩnh (1.000 CCU) và idempotency, **routing rule phải tự phát hiện và gộp báo cáo trùng vào một "Parent Incident" duy nhất** để Kanban của điều phối viên không bị tràn. Các báo cáo cá nhân attach vào parent như khách bị ảnh hưởng, không thành ticket riêng. *(→ Yêu cầu chức năng ở Bước 9.)*

### Giảm thiểu rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Rò rỉ PII | RBAC + mã hóa + audit + tối thiểu |
| Ghi âm không đồng thuận | thông báo đồng thuận IVR + chính sách retention |
| Lỗi định danh | fallback + xác minh thủ công, không bao giờ chặn dịch vụ |
| Báo cáo trùng hàng loạt (sự cố) | auto-merge Parent-Incident + phân cụm địa lý |
| Mất tin ở peak | idempotency + DLQ + sức chứa 1.000 CCU |
| Lỗ hổng truy vết | lan truyền trace_id qua ranh giới async |

---

## 7. Đổi mới & Mẫu mới

### Khu vực đổi mới được phát hiện
- **Triage sự cố diện rộng phân cụm theo địa lý (Parent-Incident merging):** khi vỡ ống chính kích hoạt hàng ngàn báo cáo gần-đồng-thời, hệ thống tự phân cụm theo bán kính địa lý + cửa thời gian + độ tương tự loại sự cố và gộp vào một **Parent Incident** duy nhất, attach báo cáo cá nhân như khách bị ảnh hưởng. Điều này đảo ngược giả định helpdesk chuẩn "một báo cáo = một ticket" và ngăn ngập Kanban điều phối viên trong sự cố diện rộng. *(Thực sự mới cho contact center; đặc thù mạng tiện ích.)*
- **Phạm vi trung thực:** vượt ra ngoài triage sự cố, OmniCare là một thực thi xuất sắc các mẫu omnichannel đã chứng minh (unified inbox, quản lý SLA, screen-pop VoIP, CSAT) chứ không phải đổi mới đột phá.

### Bối cảnh thị trường & Cảnh quan cạnh tranh
- Helpdesk dùng chung thiếu phân cụm sự cố đặc thù tiện ích và Customer 360 (hợp đồng / công nợ / tiêu thụ).
- Công cụ field-service tiện ích xử lý sự cố nhưng hiếm khi thống nhất với hàng đợi contact-center.
- Lợi thế của OmniCare = cầu nối **contact-center + quản lý sự cố** trong một hàng đợi.

### Cách tiếp cận thẩm định
- Định nghĩa quy tắc phân cụm (bán kính địa lý + cửa thời gian + độ tương tự loại sự cố) và **ngưỡng tin cậy** trước auto-merge.
- Thử nghiệm ở **shadow mode** (gợi ý gộp; agent xác nhận) trước auto-merge đầy đủ.
- Đo: độ chính xác gộp, tỷ lệ gộp sai, mức giảm tải Kanban điều phối viên.

### Giảm thiểu rủi ro
| Rủi ro | Giảm thiểu |
|---|---|
| Gộp sai (báo cáo không liên quan bị nhóm) | ngưỡng tin cậy + xác nhận agent + dễ un-merge |
| Bỏ sót gộp (cụm thật không phát hiện) | luôn tạo ticket cá nhân làm fallback; không bao giờ mất báo cáo |
| Auto-merge quá hăng | bắt đầu ở suggest-mode (human-in-the-loop), tốt nghiệp sang auto |

---

## 8. Bề mặt backend, BFF & Realtime

> Frontend (SPA workspace agent) **đã bàn giao và ngoài phạm vi**. Phần này đặc tả **bề mặt server** mà FE hiện tại phụ thuộc. Các concern thuần frontend (browser matrix, responsive, SEO, accessibility UI, time-to-interactive) cố tình **không** được đề cập ở đây.

### Tổng quan loại service
Một deployable backend duy nhất — **backend OmniCare** (NestJS) — chứa ba lớp/module logic: **module domain Omnichannel** (ingestion, chuẩn hóa, định danh, kênh, gateway realtime, KB, broadcast, thu CSAT, tiếp nhận sự cố hiện trường, phát hiện outage), **module Ticketing & SLA** (cùng deploy, schema riêng — vòng đời ticket, engine SLA, breach worker, escalation, reopen, parent-incident), và lớp **BFF** (gateway tổng hợp duy nhất cho SPA). Các port external (Customer 360, Field-team App, AI) được tiêu thụ, không build.

### Bề mặt API & Contract
- **BFF là điểm vào duy nhất** cho SPA — không có lời gọi FE nào chạm trực tiếp module domain. BFF cung cấp endpoint tổng hợp-đọc (ví dụ: một conversation view = chuỗi omnichannel + thẻ Customer 360 + trạng thái ticket/SLA từ module Ticketing) và endpoint ghi fan-out tới đúng module.
- **Contract có version và được contract-test** ở cả hai phía mọi ranh giới module (đặc biệt Omnichannel ↔ Ticketing). Thay đổi phá vỡ cần bump version; contract test consumer-driven chặn release.
- **Hình dáng API khớp với cái FE đã bàn giao đang gọi** — PRD này conform backend theo các màn hình hiện có, không phải ngược lại. (Mapping field theo màn hình được theo dõi trong contract tích hợp FE, không lặp lại ở đây.)

### Gateway thời gian thực
- Gateway **WebSocket (socket.io)** trong module Omnichannel: push tin-đến, tín hiệu screen-pop, và relay event `SlaWarning`/đổi-trạng-thái ticket xuất phát từ module Ticketing.
- Mục tiêu giao: một event server-phát tới client đã kết nối trong **2 giây (p95)** kể từ khi backend nhận/sản xuất nó.
- Reconnect + backfill: khi socket reconnect, client có thể yêu cầu event bị thiếu mà không mất tin (replay idempotent).

### Mục tiêu hiệu năng backend
- Tổng hợp đọc BFF: ≤ **500ms (p95)** dưới tải thường (NFR2).
- Xác nhận webhook: ≤ **200ms** (NFR4).
- Push realtime: ≤ **2s (p95)** (NFR1).
- Peak: ≥ **1.000 CCU** qua lớp ingress + realtime, không rớt tin (NFR6).
> (Time-to-interactive frontend là concern của FE đã bàn giao và không còn là NFR ở đây.)

### Kiểm soát truy cập theo vai trò (RBAC)
Agent / Supervisor / Admin được thực thi **server-side** ở ranh giới BFF/module — xử lý ticket, gán-lại (proxy), đọc dữ liệu SLA, cấu hình. Backend là thẩm quyền; FE chỉ phản ánh quyền được cấp.

### Danh sách tích hợp (các port)
Module Ticketing (trong-project) · Customer 360 · My Công ty App · Business Dashboard · AI Chatbot (external) · AI Forecasting (external) · Field-team App — tất cả qua BFF/port.

### Giải pháp móc nối kỹ thuật (Integration Hookups)

> PRD đặc tả *năng lực* (FR); phần này đặc tả **cách móc nối kỹ thuật** với các hệ thống external, vì NestJS không tự xử lý luồng âm thanh, không sở hữu model AI, và không sở hữu dữ liệu khách hàng gốc. **Nguyên tắc chung:** *ingress* dùng webhook + idempotency + 200-OK ≤200ms; *outbound* dùng outbox + retry + DLQ; `trace_id` lan truyền toàn luồng (NFR13).

**1. Tổng đài / Telephony (PBX) — FR32, FR33, FR34, FR35, FR59**
- NestJS **không** xử lý luồng âm thanh (RTP). Thiết lập **Telephony Webhook** với nhà cung cấp PBX (Stringee / VCCall / FPT / v.v.):
  - **Signaling:** khi khách gọi, PBX bắn `call.ringing` (kèm số gọi) → NestJS query Customer 360 → push **screen-pop** qua WebSocket tới agent (FR33).
  - **Queue / Routing:** để PBX xử lý chia cuộc (tối ưu hơn); NestJS chỉ đồng bộ `agent.state_changed` (Available/Busy) lên PBX để PBX chọn agent rảnh (FR32, FR16).
  - **Ghi âm:** khi kết thúc, PBX bắn `call.ended` kèm URL file ghi âm → NestJS chỉ lưu **URL metadata** vào DB (file vật lý nằm ở server tổng đài / S3) (FR34, FR35).
  - **Đồng ý:** PBX phát thông báo IVR ghi âm trước khi nối agent (FR59).
- Đây là dạng **webhook-ingress** (giống ingress tin nhắn): idempotency + 200-OK.

**2. Customer 360 / Định danh (Anti-Corruption Layer) — FR28, FR29, FR30, FR31**
- Adapter (**Anti-Corruption Layer**) trong BFF gọi Customer Service: `GET /customers/lookup?zalo_id=xxx` (hoặc SĐT) → trả profile.
- **Fallback:** nếu Customer Service down, BFF vẫn cho phép hiển thị tin dưới dạng **"Khách Vô Danh"** — tuyệt đối không block luồng chat (FR30); agent tạo/link profile tạm sau (FR31).
- Cache profile vào Redis (short TTL) để giảm gọi lại.

**3. AI (vision / NLP / intent) — Bất đồng bộ — FR15, NFR22**
- AI model (Python) chậm; gọi **sync** sẽ block event loop khi có nhiều tin/ảnh cùng lúc.
- **Async + Safe degradation (NFR22):** Omnichannel nhận ảnh → lưu URL tạm → đẩy job vào **Queue (BullMQ)** → AI Service lấy job, phân tích, gọi **webhook ngược** về NestJS (trả tag: *Khẩn cấp / Vỡ ống…*) → NestJS push tag lên chat qua WebSocket (FR15).
- **Circuit-breaker:** nếu AI chậm/down, tin vẫn hiển thị bình thường (tag AI vắng mặt) — không block ingestion (NFR22).

**4. FSM / Đội hiện trường (Field-team) — Outbound Webhook + Retry + DLQ — FR62**
- Khi ticket chuyển sang DISPATCHED (`TicketStateChanged`), một event listener gọi REST API sang hệ thống FSM.
- **Retry + DLQ:** nếu FSM trả lỗi 5xx (sập), request vào **Dead Letter Queue**, retry sau (ví dụ 5 phút) — đảm bảo lệnh giao việc không "rơi" giữa chừng.
- Pattern *outbound* (outbox + retry + DLQ) này áp dụng chung cho mọi ghi xuống hệ thống external: Customer writes, broadcast gửi kênh, gửi CSAT ra kênh, v.v.

---

## 9. Yêu cầu chức năng (Functional Requirements)

> **Đọc như năng lực backend (v1.3).** Frontend đã bàn giao; mỗi FR dưới là năng lực **backend** thực hiện nó — API, query, event, hoặc push WebSocket. Cách diễn đạt như "Agents có thể xem / trả lời / đẩy…" có nghĩa backend **serve dữ liệu và mở thao tác** mà FE hiện tại render; chúng **không** ngụ ý build UI. **Tag phase:** [MVP] (Phase 1) / [G2] (Phase 2 Growth). **Tag sở hữu:** [OMNI] = module Omnichannel (trong-project); [TKT] = module Ticketing & SLA (trong-project, cùng deploy, schema riêng). Cả hai đều ĐƯỢC BUILD trong project — tag chỉ tên module bounded-context sở hữu. FR không gắn tag sở hữu mặc định là [OMNI]. Port external (Customer 360, AI, Field-team) được tiêu thụ, không gắn tag từng FR. Mọi artifact xuôi dòng (UX, kiến trúc, epic) dẫn xuất từ danh sách này. (Tổng 62 FR — **tất cả build trong-project**: 55 [OMNI] + 7 [TKT]: FR21, FR22, FR23, FR24, FR26, FR27, FR61. Lưu ý FR25 & FR60 là hành động hiển thị/tiêu thụ và FR62 là hành động dispatch — đều [OMNI].)

### 1. Ingestion & Nhắn tin đa kênh
- **FR1** [MVP] Hệ thống có thể nhận tin đến từ nhiều kênh (Zalo OA, app di động, Facebook, email) vào một luồng chuẩn hóa duy nhất.
- **FR2** [MVP] Hệ thống có thể xác nhận từng tin đến ngay khi nhận, độc lập với xử lý xuôi dòng.
- **FR3** [MVP] Hệ thống có thể phát hiện và loại bỏ tin đến trùng do retry mạng.
- **FR4** [MVP] Hệ thống có thể chuẩn hóa tin từ các kênh khác nhau về một định dạng chung duy nhất.
- **FR5** [MVP] Hệ thống có thể gửi tin đi tới khách hàng trên kênh của hội thoại gốc.
- **FR6** [G2] Hệ thống có thể gửi thông báo broadcast chủ động tới nhóm khách hàng qua các kênh.
- **FR7** [MVP] Hệ thống có thể lưu an toàn và tự động retry xử lý tương tác nếu tạo/routing ticket thất bại, đảm bảo không tương tác bị mất.
- **FR8** [MVP] Hệ thống có thể trình bày tin hội thoại theo đúng thứ tự thời gian trong chuỗi.

### 2. Workspace agent hợp nhất
- **FR9** [MVP] Agent có thể xem mọi hội thoại đến qua các kênh trong một inbox hợp nhất duy nhất.
- **FR10** [MVP] Agent có thể mở một hội thoại và xem toàn bộ lịch sử tin và tệp đính kèm.
- **FR11** [MVP] Agent có thể trả lời khách hàng trong chuỗi hội thoại.
- **FR12** [MVP] Agent có thể thấy tin đến mới xuất hiện thời gian thực mà không cần refresh.
- **FR13** [MVP] Agent có thể xem timeline tương tác gộp theo khách hàng qua các kênh và cuộc gọi.
- **FR14** [MVP] Agent có thể truy cập bài knowledge-base nội bộ từ trong workspace.
- **FR15** [MVP] Hệ thống có thể hiển thị tag phân loại ngữ cảnh (ví dụ: khẩn cấp, chủ đề) và transcript speech-to-text do trợ lý AI external cung cấp trực tiếp trên màn hội thoại.
- **FR16** [MVP] Agent có thể đặt trạng thái khả dụng, và hệ thống có thể route/giao việc dựa trên khả dụng của agent.
- **FR17** [MVP] Agent có thể tìm và lọc hội thoại trong inbox theo kênh, trạng thái, khách hàng và ưu tiên.
- **FR18** [MVP] Agent có thể đóng hoặc lưu trữ hội thoại (khác với giải quyết ticket).

### 3. Ticket & SLA (một project, hai module bounded-context)

> **Chú giải sở hữu:** **[OMNI]** = module Omnichannel (trong-project). **[TKT]** = module Ticketing & SLA (trong-project, cùng deploy, schema riêng). Cả hai build tại đây. Module Omnichannel tác động ticket bằng cách gọi command của module Ticketing (trong-process, qua command bus / `IEventBus`) và tiêu thụ event nó phát; module Ticketing sở hữu ticket store, engine SLA, breach worker — như một bounded-context riêng, chỉ không phải deployable riêng (v1.3).

> **Ghi chú triển khai (kỷ luật đóng gói):** mọi thay đổi trạng thái Ticket phải đi qua **Command** của module Ticketing (create / advance / reassign / escalate / reopen / attach-parent) — **KHÔNG** bao giờ `UPDATE` trực tiếp bảng `tickets` bằng SQL. State machine + dual-clock SLA + invariants được đóng gói trong aggregate `Ticket` (xem story T-1), đảm bảo chỉ chuyển trạng thái hợp lệ và SLA được tính đúng.

**3a — Tương tác ticket phía Omnichannel [OMNI]**
- **FR19** [MVP·OMNI] Agent có thể tạo ticket từ hội thoại; workspace gửi yêu cầu tạo (`TicketCreateRequested`) tới module Ticketing với ngữ cảnh hội thoại + khách hàng.
- **FR20** [MVP·OMNI] Agent có thể đẩy ticket qua các giai đoạn workflow (received → in progress → waiting → resolved) từ UI workspace; thay đổi trạng thái proxy qua BFF tới module Ticketing.
- **FR25** [MVP·OMNI] Hệ thống có thể tiêu thụ event `SlaWarning` (gần/tại vi phạm) do module Ticketing phát và hiển thị realtime tới supervisor và agent phụ trách (chớp đỏ Kanban + đếm ngược; chip SLA Inbox).
- **FR60** [MVP·OMNI] Agent và supervisor có thể xem trạng thái hiện tại và đếm ngược SLA của ticket bên cạnh hội thoại và trên Kanban, dữ liệu lấy từ module Ticketing qua BFF.

**3b — Năng lực module Ticketing [TKT] (trong-project)**
- **FR21** [MVP·TKT] Module Ticketing gán định danh duy nhất và owner phụ trách cho mỗi ticket.
- **FR22** [MVP·TKT] Module Ticketing phân loại ticket theo loại và mức ưu tiên.
- **FR23** [MVP·TKT] Module Ticketing áp dụng chính sách SLA cho ticket theo loại và ưu tiên.
- **FR24** [MVP·TKT] Module Ticketing liên tục giám sát ticket mở và phát hiện những ticket sắp vi phạm SLA (background breach worker), phát `SlaWarning`.
- **FR26** [G2·TKT] Module Ticketing tự động escalate ticket vi phạm SLA lên cấp thẩm quyền cao hơn.
- **FR27** [G2·TKT] Module Ticketing tự động mở lại ticket khi nhận event `CsatSubmitted` báo đánh giá dưới ngưỡng.

### 4. Định danh khách hàng & ngữ cảnh 360°
- **FR28** [MVP] Hệ thống có thể định danh khách hàng từ channel identifier (ví dụ: Zalo ID, SĐT) tới profile khách hàng hợp nhất.
- **FR29** [MVP] Agent có thể xem profile 360° khách hàng (hợp đồng, khoản phải thu, lịch sử tiêu thụ, địa chỉ) bên cạnh hội thoại.
- **FR30** [MVP] Hệ thống có thể xử lý khách chưa nhận diện qua luồng định danh fallback mà không mất tin đến.
- **FR31** [MVP] Agent có thể tạo hoặc liên kết profile khách hàng tạm khi định danh không được.

### 5. Tổng đài & Telephony
- **FR32** [MVP] Hệ thống có thể nhận cuộc gọi đến và route tới agent khả dụng.
- **FR33** [MVP] Hệ thống có thể trình bày profile khách hàng của người gọi cho agent trước khi cuộc gọi được bắt.
- **FR34** [G2] Hệ thống có thể ghi âm cuộc gọi và giữ ghi âm trong một khoảng định nghĩa.
- **FR35** [MVP] Agent có thể truy cập tham chiếu ghi âm của cuộc gọi quá khứ từ lịch sử tương tác.
- **FR36** [G2] Hệ thống có thể trình bày menu giọng nói (IVR) tương tác và route cuộc gọi theo lựa chọn của người gọi.
- **FR37** [G2] Hệ thống có thể route cuộc gọi theo địa lý người gọi và kỹ năng agent.
- **FR38** [G2] Khách hàng có thể yêu cầu callback từ app và nhận trong thời gian mục tiêu.

### 6. Knowledge Base & Tự phục vụ
- **FR39** [MVP] Agent có thể tìm bài knowledge-base nội bộ theo từ khóa, kể cả dấu tiếng Việt và từ đồng nghĩa.
- **FR40** [G2] Biên tập viên nội dung có thể quản lý bài qua workflow tác giả → biên tập → phê duyệt → xuất bản có versioning.
- **FR41** [G2] Khách hàng có thể tự phục vụ câu trả lời từ knowledge base mà không liên hệ agent.

### 7. Đo lường trải nghiệm khách hàng
- **FR42** [MVP] Hệ thống có thể yêu cầu đánh giá hài lòng (CSAT) từ khách hàng sau khi ticket đóng (trigger bởi event `TicketClosed` từ module Ticketing) và phát event `CsatSubmitted` (module Ticketing tiêu thụ để auto-reopen — xem FR27).
- **FR43** [G2] Hệ thống có thể thu đánh giá hài lòng qua nhiều kênh.
- **FR44** [G2] Hệ thống có thể đo Net Promoter Score (NPS) qua khảo sát định kỳ.
- **FR45** [G2] Hệ thống có thể đo Customer Effort Score (CES) cho các quy trình chính.
- **FR46** [G2] Hệ thống có thể trigger liên hệ theo dõi khi khách đánh giá dưới ngưỡng (closing the loop).
- **FR47** [G2·OMNI] Khách hàng có thể theo dõi trạng thái ticket của mình qua mã tra cứu (App My Công ty / web khách hàng), trạng thái ticket đọc từ module Ticketing qua BFF.
- **FR48** [G2] Hệ thống có thể đo và báo cáo tỷ lệ deflection (yêu cầu giải quyết qua tự phục vụ knowledge-base không cần ticket/agent).

### 8. Triage sự cố diện rộng
> **Phân chia sở hữu:** *phát hiện / phân cụm* là triage trước-ticket build tại đây **[OMNI]**; *Parent Incident như nhóm child ticket* thuộc module **[TKT]** (trong-project). Thao tác merge/split của agent là action UI OMNI gọi module Ticketing khi liên quan ticket.
- **FR49** [G2·OMNI] Module Omnichannel có thể phát hiện các cụm báo cáo gần-đồng-thời từ một khu vực địa lý (bán kính địa lý + cửa thời gian + độ tương tự loại sự cố) và đề xuất grouping parent-incident — triage trước-ticket; việc grouping ticket thật do module Ticketing thực thi (xem FR61).
- **FR50** [G2·OMNI] Agent có thể xem mọi báo cáo/khách bị ảnh hưởng attach vào parent incident trong workspace (UI; danh sách tổng hợp qua BFF từ báo cáo omnichannel + grouping của module Ticketing).
- **FR51** [G2·OMNI] Agent có thể tách một báo cáo gộp sai khỏi parent incident từ workspace; khi báo cáo có ticket liên quan, regrouping proxy qua BFF tới module Ticketing.
- **FR52** [G2·OMNI] Hệ thống có thể gắn và phân giải vị trí địa lý cho báo cáo sự cố lúc intake (GIS pin); geo cấp ticket do module Ticketing lưu.
- **FR61** [G2·TKT] Module Ticketing duy trì Parent Incident như một nhóm child ticket — attach, detach, split, và resolve child ticket dưới một parent duy nhất.
- **FR62** [MVP·OMNI] Hệ thống có thể dispatch Work Order tới Field-team App khi sự cố hiện trường được xác nhận — gồm loại sự cố, ưu tiên, vị trí địa lý, và tham chiếu ảnh — để đội hiện trường hành động. *(MVP — cần cho demo J1 và màn Sự cố hiện trường; Field-team App là port tiêu thụ.)*

### 9. Dashboard vận hành & Giám sát
- **FR53** [MVP·OMNI] Supervisor có thể xem KPI vận hành realtime trên dashboard (Điều hành CSKH), tổng hợp BFF từ khối lượng tương tác + cơ cấu kênh (omnichannel), tuân thủ SLA + số ticket mở (module Ticketing), và CSAT/NPS (thu omnichannel).
- **FR54** [MVP·OMNI] Supervisor có thể gán lại ticket giữa các agent từ workspace; gán lại proxy qua BFF tới module Ticketing.

### 10. Bảo mật, truy cập & Kiểm toán
- **FR55** [MVP] Hệ thống có thể xác thực agent và thực thi phân quyền theo vai trò (agent, supervisor, admin).
- **FR56** [MVP] Hệ thống có thể ghi audit trail về ai làm gì và khi nào qua mọi tương tác.
- **FR57** [MVP] Hệ thống có thể truy vết tương tác khách hàng end-to-end qua mọi bước xử lý.
- **FR58** [MVP] Hệ thống có thể hạn chế truy cập dữ liệu cá nhân khách hàng theo vai trò.
- **FR59** [MVP] Hệ thống có thể thông báo cho người gọi rằng cuộc gọi có thể được ghi âm trước khi nối tới agent.

---

## 10. Yêu cầu phi chức năng (Non-Functional Requirements)

> **Hệ thống thực hiện TỐT NHƯ THẾ NÀO** — mỗi NFR đo được và kiểm tra được. Từ ngữ chất lượng mơ hồ trong FR ("real time", "liên tục", "thời gian mục tiêu") được giải thành ngưỡng cụ thể ở đây. (24 NFR qua 6 nhóm; NFR10 tách thành phần phát [TKT] (module Ticketing trong-project) và phần render [OMNI].)

### Hiệu năng
- **NFR1** Hệ thống sẽ push tin đến mới tới màn agent trong 2 giây ở phân vị 95.
- **NFR2** Hệ thống sẽ phản hồi yêu cầu đọc BFF trong 500ms ở phân vị 95 dưới tải thường.
- **NFR3** BFF sẽ trả về tổng hợp bootstrap workspace agent (session + trang 1 inbox + counter) trong 1 giây ở phân vị 95, để frontend đã bàn giao đạt interactivity nhanh. *(Time-to-interactive frontend thuộc về FE đã bàn giao — ngoài phạm vi.)*
- **NFR4** Hệ thống sẽ xác nhận webhook đối tác trong 200 mili-giây kể từ khi nhận.
- **NFR5** Hệ thống sẽ thực thi rate limiting ở API Gateway (tối đa 50 yêu cầu/giây mỗi IP hoặc Channel ID) và tự khóa IP thể hiện hành vi quét bất thường, bảo vệ ingress webhook công cộng khỏi DDoS và spam.

### Khả năng mở rộng
- **NFR6** Hệ thống sẽ duy trì tối thiểu 1.000 người dùng đồng thời qua lớp ingress và realtime, không rớt tin — trong cả ngày chỉ số nước và peak sự cố diện rộng.
- **NFR7** Hệ thống sẽ xử lý tăng trưởng tải 10× với dưới 10% suy giảm hiệu năng qua auto-scaling.

### Độ tin cậy & Khả dụng
- **NFR8** Hệ thống sẽ duy trì uptime 99.9% trong giờ hành chính.
- **NFR9** Hệ thống sẽ không mất tin đến nào khi crash process hoặc lỗi thoáng qua — qua idempotency + outbox giao dịch + reconciliation; yêu cầu tạo-ticket được lưu trong outbox và replay khi restart. *(v1.3: với Ticketing cùng deploy trong-process, nó không thể "không khả dụng" độc lập — đảm bảo nay là phục hồi crash thay vì chịu sibling-down.)*
- **NFR10** [TKT] **Module Ticketing** sẽ quét ticket mở và phát `SlaWarning` trong 60 giây kể từ khi ngưỡng vi phạm bị vượt.
- **NFR10b** [OMNI] Module Omnichannel sẽ tiêu thụ `SlaWarning` và render tới màn agent/supervisor trong 2 giây (p95) kể từ khi nhận từ event bus.
- **NFR11** Hệ thống sẽ phục hồi từ lỗi single-module trong 5 phút qua restart container hoặc failover.
- **NFR12** Hệ thống sẽ đảm bảo RPO < 5 phút và RTO < 1 giờ cho CSDL lõi qua backup tự động và Point-in-Time Recovery.
- **NFR13** Hệ thống sẽ mang trace_id end-to-end qua 100% tương tác và phát structured log cho 100% module.

### Bảo mật & Quyền riêng tư
- **NFR14** Hệ thống sẽ mã hóa 100% dữ liệu khách hàng in transit (TLS 1.2+) và at rest.
- **NFR15** Hệ thống sẽ thực thi truy cập theo vai trò trên 100% truy cập dữ liệu khách hàng và ghi audit trail bất biến cho 100% sự kiện truy cập-dữ-liệu và đổi-trạng-thái.
- **NFR16** Hệ thống sẽ giữ 100% PII khách hàng và dữ liệu tiêu thụ trong Việt Nam (on-premise hoặc cloud trong nước).
- **NFR17** Hệ thống sẽ giữ ghi âm cuộc gọi 90 ngày rồi tự xóa, và đi trước 100% cuộc gọi ghi âm bằng thông báo đồng thuận.
- **NFR18** Hệ thống sẽ giữ mọi log hệ thống và audit (login, truy cập PII nhân viên) bất biến ít nhất 12 tháng (Luật An ninh mạng 2018).
- **NFR19** Hệ thống sẽ xử lý yêu cầu truy cập/xóa dữ liệu khách hàng trong 72 giờ (hướng dẫn Nghị định 13).

### Khả năng tiếp cận (chỉ nghĩa vụ backend)
- **NFR20** Tuân thủ WCAG 2.1 AA cấp UI thuộc về **frontend đã bàn giao** và ngoài phạm vi backend này. Backend sẽ serve nội dung Knowledge Base và tự-theo-dõi **dạng cấu trúc, ngữ nghĩa** (tiêu đề, nhãn, trường alt-text, language tag) không cản trở frontend đạt WCAG 2.1 AA.

### Tích hợp
- **NFR21** Hệ thống sẽ tích hợp với port external (Customer 360, My Công ty, Business Dashboard, Field-team App) qua contract API có version và contract-test. Ranh giới module trong-project Omnichannel ↔ Ticketing được che bởi contract test cấp module (command/event có version); event chạy qua port `IEventBus` để broker thật có thể thêm sau mà không đổi contract.
- **NFR22** Hệ thống sẽ tiêu thụ dịch vụ AI external qua adapter với safe degradation (circuit-breaker), và lỗi tích hợp không bao giờ chặn xử lý tin đến.
- **NFR23** Hệ thống sẽ hoàn tất yêu cầu callback khách hàng trong 60 giây.
  