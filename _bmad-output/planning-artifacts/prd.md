---
stepsCompleted: [step-01-init, step-02-discovery, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-12-complete]
inputDocuments:
  - product-brief-IOC-Customer-2026-06-02.md
  - docs/Mota_Tinh_Nang_KinhDoanh_KhachHang (AutoRecovered).docx
workflowType: 'prd'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 1
classification:
  projectType: api_backend
  domain: energy
  complexity: high
  projectContext: brownfield
---

# Product Requirements Document — Module CSKH: Trạm Điều phối Trung tâm

**Author:** Pc
**Date:** 2026-06-03
**Version:** 1.0

---

## Executive Summary

### Vision

Module CSKH là **Trạm Điều phối Trung tâm** (API Gateway / Orchestrator) — "Quầy Lễ tân" tiếp nhận mọi yêu cầu khách hàng qua đa kênh, xác thực danh tính, và điều phối request đến các hệ thống nghiệp vụ phía sau.

Module CSKH **không sở hữu nghiệp vụ** — không tính cước, không gán người sửa ống, không quản lý đồng hồ. Module CSKH đảm bảo order đến đúng bếp, món ăn đến đúng bàn, và khách hàng luôn nhận được phản hồi — ngay cả khi bếp (backend) đang đóng.

### Differentiator

4 điểm khác biệt cốt lõi so với CRM phổ biến (Zendesk, Salesforce):

1. **"Quầy Lễ tân" tinh gọn** — Không ôm data nghiệp vụ, chỉ điều phối. Thêm/xóa kênh = thêm/xóa Adapter, không sửa core.
2. **Auth tập trung một lần** — Centralized auth cho mọi kênh. Đăng nhập 1 lần → truy cập mọi dịch vụ. RBAC phân rạch ròi: KH, Nhân viên, Lãnh đạo, Admin.
3. **Mocking cho phép song song** — Bạn Thương xây backend, bạn xây CSKH không block nhau. Mock data đảm bảo luồng routing chạy trơn từ ngày đầu.
4. **Context Preservation xuyên kênh** — KH chat Zalo buổi sáng → gọi Hotline chiều → tổng đài viên thấy toàn bộ lịch sử. CRM phổ biến không hỗ trợ cross-channel context native.

### Target Users

| Persona | Vai trò | Kênh chính |
|---------|---------|-----------|
| **Tổng đài viên "Lan"** | Tiếp nhận xử lý cuộc gọi 60-80/ngày | Hotline Adapter |
| **KH sinh hoạt "Cô Nguyễn"** | Người dân dùng dịch vụ cấp nước | Zalo OA, Hotline IVR |
| **NV CSKH quầy "Minh"** | Phục vụ KH trực tiếp tại điểm giao dịch | Counter Adapter |
| **Trưởng phòng KD "Anh Đức"** | Giám sát KPI, CSAT, SLA | Dashboard Adapter |
| **KH lớn "KCN Cẩm Phả"** | Tổ chức, hợp đồng đặc thù, sản lượng lớn | Mobile/API tích hợp |

---

## Success Criteria

### User Success

| # | Criteria | Cách đo | 6 tháng | 12 tháng | 24 tháng |
|---|----------|---------|---------|----------|----------|
| US-1 | Thời gian xác thực KH từ lúc gọi đến → tổng đài viên thấy hồ sơ | End-to-end latency measurement | < 5 giây | < 3 giây | < 2 giây |
| US-2 | KH không phải kể lại thông tin khi đổi kênh hoặc đổi người phục vụ | KH survey xác nhận "không phải nhắc lại" | 70% KH | 90% KH | 95% KH |
| US-3 | Ticket routing chính xác ở lần đầu — request đến đúng backend API | Routing accuracy rate | 80% | 92% | 95% |
| US-4 | KH đánh giá hài lòng ≥ 4/5 sao sau tương tác | CSAT score collection | 60% | 75% | 80% |
| US-5 | Tổng đài viên hài lòng với công cụ CSKH | Internal survey | 70%+ | 85%+ | 90%+ |

### Business Success

| # | Metric | 6 tháng | 12 tháng | 24 tháng |
|---|--------|---------|----------|----------|
| BS-1 | AHT (Average Handling Time) giảm | -20% | -30% | -40% |
| BS-2 | Abandon Rate (tỷ lệ gọi nhỡ) | < 12% | < 8% | < 5% |
| BS-3 | FCR (First Call Resolution) | 60% | 70% | 75%+ |
| BS-4 | Ticket reopen rate giảm | -20% | -40% | -60% |
| BS-5 | CSAT điểm trung bình tăng | +0.5 | +1.0 | +1.5 |
| BS-6 | SLA tuân thủ | 75% | 85% | 90%+ |

### Technical Success

| # | Metric | Mục tiêu |
|---|--------|----------|
| TS-1 | Mock → Live switch per endpoint | < 1 ngày, config-driven, không sửa code |
| TS-2 | Adapter response time (không tính backend latency) | < 200ms |
| TS-3 | Auth latency (login → token ready) | < 500ms |
| TS-4 | Multi-channel uptime | 99.5%+ |
| TS-5 | Mock coverage ban đầu | 100% → giảm dần khi backend sẵn sàng |
| TS-6 | Graceful degradation | 0% total outage — luôn trả response |
| TS-7 | Cross-channel context preservation rate | 95%+ |

---

## Product Scope

### MVP — Minimum Viable Product (Phase 1)

**MVP Strategy:** Problem-Solving MVP — chứng minh kiến trúc Orchestrator hoạt động, đặc biệt **Context Preservation** (KH chuyển kênh giữa chừng không mất ngữ cảnh). MVP phải có ít nhất 2 kênh để demo.

| # | Feature | Chi tiết | Ảnh hưởng |
|---|---------|----------|-----------|
| M1 | **Auth Layer** | Đăng nhập NV (tổng đài viên, CSKH quầy) + Xác thực KH qua SĐT/Zalo ID. RBAC: Khách hàng / Nhân viên / Admin | DB riêng User/Session |
| M2 | **Hotline Adapter** | Nhận request từ SĐT gọi đến → lookup KH → trả hồ sơ cho tổng đài viên | Input adapter |
| M3 | **Zalo Adapter** | Nhận text message từ KH qua Zalo OA → xác thực qua Zalo ID liên kết SĐT | Input adapter |
| M4 | **Orchestrator Core** | Request chuẩn hóa, routing đến 5 mock endpoints, ticket lifecycle: create → read → update status | Core engine |
| M5 | **Context Preservation** | Session store lưu lịch sử tương tác. KH chat Zalo sáng → gọi Hotline chiều → tổng đài viên thấy lịch sử chat Zalo | Key differentiator |
| M6 | **Mocking System** | 5 JSON files giả lập backend API. Hot reload config (mock → live) | Infrastructure |
| M7 | **Circuit Breaker cơ bản** | Phát hiện API down → fallback cached data. KH luôn nhận response | Resilience layer |

**5 Mock Endpoints (MVP):**

| Endpoint | Method | Purpose | Mock file |
|----------|--------|---------|-----------|
| `GET /customers/{phone}` | Read | Định danh + ngữ cảnh KH | `mocks/customer360.json` |
| `POST /tickets` | Write | Tạo ticket mới | `mocks/create-ticket.json` |
| `GET /tickets/{id}` | Read | Tra cứu trạng thái ticket | `mocks/ticket-status.json` |
| `GET /gis/incidents?area={code}` | Read | Kiểm tra sự cố khu vực | `mocks/gis-incidents.json` |
| `POST /notifications` | Write | Gửi thông báo qua kênh | `mocks/notifications.json` |

**MVP Success Criteria:**

| # | Criteria | Cách đo |
|---|----------|---------|
| MC-1 | 2 kênh hoạt động: Hotline + Zalo gửi/nhận request | Demo end-to-end |
| MC-2 | Context Preservation: KH chat Zalo → gọi Hotline → tổng đài viên thấy history | Test case K1 |
| MC-3 | Auth phân quyền đúng: KH chỉ xem data mình, NV xem theo quyền | RBAC test matrix |
| MC-4 | 5 mock endpoints trả đúng schema match OpenAPI spec | Automated test |
| MC-5 | Circuit Breaker: tắt mock server → fallback cache → KH vẫn nhận response | Kill mock server test |
| MC-6 | Zero-Downtime Config Switch: chuyển endpoint mock → live không cần restart | Config change + latency probe |

### Growth Features (Phase 2)

| # | Feature | Mô tả |
|---|---------|-------|
| G1 | Đa Xí nghiệp routing (K7) — Routing theo GIS/DMA, không hardcode |
| G2 | SLA Engine động — `SLA timeout = f(Loại_Sự_Cố, Mã_Xí_Nghiệp)` |
| G3 | DLQ + Queue retry (K5 full) — Dead Letter Queue + auto-retry + notify |
| G4 | Web Adapter — Thêm kênh web |
| G5 | Mock → Live migration (K6) — Shadow Mode cho API liên quan tiền |
| G6 | Graceful Degradation đầy đủ — 3 tầng: Live → Cached → Queue+Notify |

### Vision (Phase 3)

| # | Feature | Mô tả |
|---|---------|-------|
| V1 | CSAT & Dashboard — Giao diện báo cáo lãnh đạo |
| V2 | Counter Adapter — Kênh quầy giao dịch |
| V3 | Mobile Adapter — App mobile cho KH |
| V4 | Notification đa kênh — Zalo, SMS, Email, Push |
| V5 | AI Agent Assist — Gợi ý trả lời cho tổng đài viên |
| V6 | Knowledge Base — CSDL câu hỏi thường gặp |

### Out of Scope (Gạch bỏ để bảo vệ deadline)

| ❌ Tính năng | Lý do | Khi nào |
|-------------|-------|---------|
| Đa Xí nghiệp routing (K7) | Phức tạp setup dữ liệu địa bàn | Phase 2 |
| SLA Engine động | Logic rule-engine phức tạp | Phase 2 |
| CSAT & Dashboards | Effort UI lớn | Phase 3 |
| DLQ / Queue retry | Tốn nhiều resource | Phase 2 |
| Shadow Mode (K6) | Chỉ cần khi migrate API liên quan tiền | Khi backend ready |
| Counter / Web / Mobile Adapters | Thêm kênh = thêm adapter | Phase 2+ |

---

## User Journeys

### Journey 1: Tổng đài viên xử lý cuộc gọi KH báo sự cố (Primary — Success Path)

**Persona:** Lan, tổng đài viên, 60-80 cuộc gọi/ngày.

**Opening Scene:** Lan đăng nhập hệ thống buổi sáng. Màn hình sẵn sàng nhận cuộc gọi.

1. Lan đăng nhập → Auth layer phát token nhân viên với role `employee`
2. Cuộc gọi đến → SĐT hiện trên màn hình → Hotline Adapter nhận → Orchestrator gọi `GET /customers/{phone}` (mock) → hồ sơ KH pop-up
3. Lan chào KH bằng tên: *"Chào anh Tuấn, em thấy nhà anh ở 23 Hạ Long..."*
4. KH báo "nước yếu" → Lan chọn loại ticket "Sự cố" → Orchestrator gọi `POST /tickets` (mock) → tạo ticket `#TK-001`
5. Orchestrator route request → `GET /gis/incidents?area=hl01` (mock) → phát hiện bảo trì đường ống khu vực
6. Kết quả: *"Khu vực đang bảo trì, dự kiến xong 14:00"* → Lan thông báo cho KH
7. Sau cuộc gọi → CSAT survey tự động gửi qua SMS/Zalo
8. Event ghi vào session: `{type: "call_completed", ticketId: "TK-001", csatSent: true}`

**Resolution:** Lan xử lý 1 cuộc gọi trong 3 phút (thay vì 7 phút trước đây) vì không phải hỏi lại thông tin KH.

**Capabilities revealed:** Auth, Hotline Adapter, Customer 360° lookup, Ticket creation, GIS incident check, CSAT collection, Session tracking.

### Journey 2: KH báo sự cố qua Zalo OA (Primary — Alternative Channel)

**Persona:** Anh Tuấn, KH sinh hoạt, 35 tuổi.

**Opening Scene:** Anh Tuấn phát hiện nước yếu buổi tối, không muốn gọi hotline.

1. Anh nhắn "Nhà tôi mất nước" qua Zalo OA
2. Zalo Adapter tiếp nhận → Auth layer xác thực qua Zalo ID liên kết SĐT → UserID `USR-12345`
3. Orchestrator nhận dạng intent "báo sự cố" → prompt chọn loại sự cố + gửi ảnh
4. Anh gửi ảnh vòi nước rò rỉ → Orchestrator gọi `POST /tickets` (mock) → ticket `#TK-002`
5. Orchestrator trả về: *"Đã ghi nhận sự cố #TK-002. Kết quả xử lý sẽ được thông báo qua Zalo."*
6. Ticket cập nhật → `POST /notifications` (mock) → Zalo message gửi: *"Sự cố #TK-002 đã được xử lý ✅"*

**Capabilities revealed:** Zalo Adapter, Intent recognition, Image upload, Ticket creation, Notification dispatch, Channel-specific response.

### Journey 3: KH cao tuổi gọi Hotline (Primary — Accessibility Edge Case)

**Persona:** Cô Nguyễn, 72 tuổi, sống một mình ở Hồng Gai.

**Opening Scene:** Cô phát hiện nước yếu, gọi 1900.

1. Cô gọi → IVR: *"Nhấn 0 gặp tổng đài viên"* (1 bước duy nhất, đơn giản)
2. Auth layer nhận diện SĐT → Orchestrator gọi `GET /customers/{phone}` → hồ sơ hiện: 72 tuổi, KH thẻ ưu đãi, địa chỉ Hồng Gai
3. Tổng đài viên thấy flag "KH ưu tiên" → xử lý bằng ngôn ngữ đơn giản, không dùng thuật ngữ
4. Xử lý xong → CSAT qua SMS: *"Anh/chị hài lòng không? Nhấn 1 Có / 2 Không"*

**Capabilities revealed:** IVR simple path, Age-based UX adaptation, Priority flag, SMS CSAT.

### Journey 4: Cross-Channel Context Preservation (Key Differentiator)

**Persona:** Anh Tuấn (tiếp tục từ Journey 2).

**Opening Scene:** Anh đã chat Zalo lúc 9h sáng báo mất nước. 2 giờ chiều chưa thấy nước → gọi Hotline.

1. Anh gọi Hotline → Hotline Adapter nhận SĐT → Auth lookup → UserID `USR-12345`
2. Orchestrator query session store `session:USR-12345` → tìm Session còn active
3. Tổng đài viên thấy đầy đủ: Zalo chat lúc 9h + ticket `#TK-002` + ảnh rò rỉ + GIS result
4. Tổng đài viên: *"Dạ em thấy anh đã báo qua Zalo lúc 9h sáng. Sự cố đang được xử lý, đội đã đi rồi ạ."*
5. Anh không phải kể lại **bất kỳ thông tin nào**

**Capabilities revealed:** Session store, Cross-channel event sourcing, Session TTL management, Context aggregation.

### Journey 5: Backend API Down — Graceful Degradation (Resilience)

**Opening Scene:** Backend API Customer 360° đột ngột down trong giờ cao điểm.

1. Tổng đài viên nhận cuộc gọi → Orchestrator gọi `GET /customers/{phone}` → timeout 3s
2. Circuit Breaker detect: lỗi > 50% trong 10s → Open State → chặn request mới
3. Fallback: trả cached data → tổng đài viên thấy: *"Dữ liệu cập nhật lúc 14:30"*
4. Orchestrator log cảnh báo → Admin nhận notification
5. Backend phục hồi → Circuit Breaker Half-Open → 1 probe request thử → OK → Close lại

**Capabilities revealed:** Circuit Breaker, Cache fallback, Graceful degradation, Admin alerting.

### Journey 6: Admin cấu hình Mock → Live Migration (Zero-Downtime)

**Opening Scene:** Bạn Thương báo API Customer 360° đã sẵn sàng.

1. Admin mở config `api-endpoints.yaml` → đổi `current: mock` → `current: live`
2. Config hot reload → Orchestrator nhận endpoint mới không restart process
3. Downtime = **0ms**
4. Shadow Mode (post-MVP): gọi song song Mock + Live → so sánh → nếu 100% match 3 ngày → pass
5. KH không thấy bất kỳ gián đoạn nào

**Capabilities revealed:** Config-driven switching, Hot reload, Zero-downtime migration, Shadow Mode.

### Journey Requirements Summary

| Journey | Capability Areas |
|---------|-----------------|
| J1: Tổng đài viên xử lý sự cố | Auth, Hotline Adapter, Customer 360°, Ticket CRUD, GIS, CSAT, Session |
| J2: KH báo sự cố qua Zalo | Zalo Adapter, Intent recognition, Image upload, Notification |
| J3: KH cao tuổi Hotline | IVR simple path, Priority flag, Accessibility, SMS CSAT |
| J4: Cross-channel context | Session store, Event sourcing, Context aggregation |
| J5: Backend API down | Circuit Breaker, Cache fallback, Graceful degradation |
| J6: Mock → Live migration | Config switching, Hot reload, Shadow Mode |

---

## Domain-Specific Requirements

### Domain: Energy / Utility (Cấp nước)

**Complexity:** High — ngành nước là dịch vụ công độc quyền, chịu sự điều chỉnh của cơ quan quản lý nhà nước.

### Compliance & Regulatory

| # | Requirement | Chi tiết |
|---|-------------|---------|
| DR-1 | **Bảo mật dữ liệu KH** | Thông tin cá nhân (tên, SĐT, địa chỉ, mã KH) phải được mã hóa at rest và in transit. Tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân. |
| DR-2 | **Audit logging** | Mọi hành động truy cập/chỉnh sửa dữ liệu KH phải được ghi log với timestamp, user ID, action, resource. Log lưu tối thiểu 12 tháng. |
| DR-3 | **Phân quyền bắt buộc** | KH chỉ xem data mình. NV xem theo địa bàn. Lãnh đạo xem toàn hệ thống. Admin quản lý config. RBAC enforce ở cả Orchestrator lẫn Backend. |
| DR-4 | **SLA tuân thủ quy định** | Tiêu chuẩn dịch vụ công: phản hồi khiếu nại trong 24h, sự cố cấp nước theo SLA theo địa bàn (2-6h tùy khu vực). |

### Technical Constraints

| # | Requirement | Chi tiết |
|---|-------------|---------|
| DR-5 | **Identity Token propagation** | Orchestrator issue signed identity token → ký bằng shared secret (env var) → gắn vào mọi request gọi Backend. Backend verify signature + extract user identity + check roles. Token payload chuẩn hóa: `sub` (UserID), `roles` (RBAC), `provider` (kênh gốc), `session_id`, `xi_nghiep`, `iat`, `exp`. Giao diện truyền: `Authorization: Bearer <token>`. |
| DR-6 | **API Contract First** | Backend bắt buộc cung cấp OpenAPI/Swagger trước khi code. Orchestrator dùng Swagger sinh mock data. Đổi schema không cập nhật Swagger = lỗi thuộc Backend. |
| DR-7 | **Secret management** | Signing key lưu env var, không hardcode. Rotation: `SECRET_OLD` + `SECRET_NEW` → Backend verify cả 2 → sau 24h xóa key cũ. |
| DR-8 | **Never die because backend died** | Orchestrator phải luôn trả response cho KH. 3 tầng: Live API → Cached Fallback → Queue + Notify. 0% total outage. |

### Integration Requirements

| # | System | Direction | Protocol | Priority |
|---|--------|-----------|----------|----------|
| IR-1 | Backend API (Thương) — Customer 360° | Outbound | REST (OpenAPI spec) | MVP |
| IR-2 | Backend API — Ticket CRUD | Outbound | REST | MVP |
| IR-3 | Backend API — GIS/Sự cố | Outbound | REST | MVP |
| IR-4 | Backend API — Notification | Outbound | REST | MVP |
| IR-5 | Backend API — Billing (hóa đơn) | Outbound | REST | Phase 2 |
| IR-6 | Zalo OA API | Inbound/Outbound | Zalo OA REST API | MVP |
| IR-7 | Hotline/IVR system | Inbound | SIP/Webhook | MVP |
| IR-8 | Redis (Session store) | Internal | Redis protocol | MVP |
| IR-9 | PostgreSQL (User/Session DB) | Internal | PostgreSQL wire protocol | MVP |

### Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Backend chưa sẵn sàng → toàn bộ luồng bị block | Mocking System: JSON files giả lập API, luồng routing chạy trơn từ ngày đầu |
| Backend down đột ngột | Circuit Breaker + Cache fallback + Queue retry. KH luôn nhận response |
| Auth mất đồng bộ giữa Orchestrator và Backend | Identity token chuẩn hóa. Shared secret. Token refresh tự động. Error handling cho 4 case: expired, not found, forbidden, invalid signature |
| Mock schema khác live schema khi migrate | API Contract First (OpenAPI). Shadow Mode so sánh Mock vs Live trước khi switch |

---

## Innovation & Novel Patterns

### Detected Innovation Areas

| # | Innovation | Chi tiết |
|---|-----------|---------|
| IN-1 | **Orchestrator-only architecture cho dịch vụ công** | Khác CRM phổ biến (sở hữu data), Module CSKH chỉ điều phối data. Thiết kế cho dịch vụ công độc quyền nơi backend nghiệp vụ đã tồn tại. |
| IN-2 | **Config-driven Mock → Live zero-downtime switching** | Chuyển mock sang live API chỉ bằng config YAML, không restart, không deploy. Shadow Mode cho API liên quan tiền. |
| IN-3 | **Cross-channel Context Preservation với Event Sourcing nhẹ** | Session store + event sourcing cho phép KH chuyển kênh giữa chừng mà không mất ngữ cảnh. CRM phổ biến không hỗ trợ native. |
| IN-4 | **Circuit Breaker + Graceful Degradation 3 tầng** | Live → Cached → Queue+Notify. KH luôn nhận response kể cả khi tất cả backend down. Thiết kế resilience-first cho hệ thống mission-critical. |

### Validation Approach

| Innovation | Cách validate |
|-----------|---------------|
| Orchestrator-only | MVP demo: 2 kênh Hotline + Zalo hoạt động end-to-end với mock data |
| Config-driven switching | Test: đổi config mock → live → đo downtime = 0ms |
| Context Preservation | Test case K1: chat Zalo → gọi Hotline → verify context intact |
| Graceful Degradation | Test: kill mock server → verify Circuit Breaker fallback hoạt động |

### Risk Mitigation

| Innovation Risk | Fallback |
|----------------|----------|
| Orchestrator bottleneck | Horizontal scaling. Stateful session tách biệt stateless routing |
| Config reload failure | Rollback config về giá trị trước đó. Admin notification khi reload fail |
| Session store loss | Session data persistence. Session survive restart. TTL 24-48h |
| Circuit Breaker false positive | Half-Open probe recovery. Configurable threshold |

---

## API Backend Specific Requirements

### API Contract First

| # | Requirement | Chi tiết |
|---|-------------|---------|
| PT-1 | OpenAPI/Swagger spec **bắt buộc trước code** | Backend cung cấp Swagger cho 5 endpoints giao tiếp. Orchestrator dùng spec để sinh mock data. |
| PT-2 | Schema violation ownership | Nếu Backend tự ý đổi schema không cập nhật Swagger → lỗi thuộc về Backend |
| PT-3 | Versioning | API versioning qua URL path. Breaking change = major version bump |

### Authentication & Authorization Contract

| # | Requirement | Chi tiết |
|---|-------------|---------|
| PT-4 | Centralized auth cho mọi kênh | SĐT lookup cho Hotline, Zalo ID cho Zalo, username/password cho NV |
| PT-5 | Token payload chuẩn hóa | Token phải chứa: user identity, role, channel source, session reference, organizational unit, issued-at, expiration |
| PT-6 | RBAC matrix | Customer: xem data mình. Employee: xem theo địa bàn + xử lý ticket. Manager: xem thống kê + phê duyệt. Admin: config + user management |
| PT-7 | Token lifecycle | Access token: 15 phút. Refresh token: 7 ngày. Auto-refresh khi Backend trả 401 |

### Endpoint Specifications (MVP)

| Endpoint | Method | Request | Response (200) | Error Codes |
|----------|--------|---------|----------------|-------------|
| `GET /customers/{phone}` | Read | Path: phone | Customer 360° profile | 404: not found |
| `POST /tickets` | Write | Body: type, description, customerId, channel | Ticket created with ID | 400: bad request |
| `GET /tickets/{id}` | Read | Path: id | Ticket status + history | 404: not found |
| `GET /gis/incidents?area={code}` | Read | Query: area code | List of incidents | 200: empty list |
| `POST /notifications` | Write | Body: type, channel, recipient, message | Notification sent confirmation | 400: bad request |

### Data Schemas (API Contract)

**Customer 360° Profile:**
```
{
  userId, name, phone, address, dmaCode, contractId,
  xiNghiep, customerType (residential|enterprise),
  priority (normal|elderly|vip), linkedProviders: [{type, id}]
}
```

**Ticket:**
```
{
  ticketId, type (incident|complaint|inquiry), status (open|in_progress|resolved|closed),
  customerId, channel, createdAt, updatedAt, slaDeadline,
  events: [{timestamp, action, actor, detail}]
}
```

**Session Event:**
```
{
  sessionId, userId, events: [
    {type: "zalo_message"|"call"|"ticket_created"|"notification_sent",
     timestamp, content, metadata}
  ], createdAt, expiresAt
}
```

### Resilience Capability Requirements

| # | Capability | Requirement |
|---|-----------|-------------|
| PT-8 | Circuit Breaker | Hệ thống phát hiện backend failure > 50% trong rolling window 10s → tự động mở circuit → fallback cached data. Half-Open probe recovery. |
| PT-9 | Cache TTL phân tầng | Static data (KH, hợp đồng): 12-24h. Dynamic (công nợ, ticket): 5-15 min. Transaction (thanh toán): NO CACHE |
| PT-10 | Retry Queue | Exponential backoff. Dead Letter Queue cho request thất bại > max retries |
| PT-11 | Config Hot Reload | Thay đổi endpoint config không cần restart process. Rollback trong < 30s |
| PT-12 | Structured logging | Mọi request/response log theo correlation ID. Trace toàn luồng từ adapter đến backend |
| PT-13 | Environment-based config | Secrets, connection strings, endpoint configs — lưu env var, không hardcode |

---

## Functional Requirements

### Authentication & Identity Management

- **FR1:** Khách hàng xác thực danh tính qua SĐT (Hotline) hoặc Zalo ID (Zalo OA) — không cần username/password
- **FR2:** Nhân viên (tổng đài viên, CSKH quầy) đăng nhập bằng username/password qua centralized auth service
- **FR3:** Lãnh đạo đăng nhập bằng username/password với role `manager` để xem thống kê và phê duyệt
- **FR4:** Admin đăng nhập bằng username/password với role `admin` để quản lý config và user
- **FR5:** Hệ thống phân quyền RBAC theo 4 role: `customer`, `employee`, `manager`, `admin`
- **FR6:** Hệ thống issue authenticated token chứa user identity, role, channel source, session reference, và organizational unit cho mọi authenticated user
- **FR7:** Hệ thống tự động refresh access token khi nhận 401 từ Backend — KH không thấy gián đoạn
- **FR8:** Hệ thống liên kết 1 User với nhiều Provider (SĐT, Zalo ID, Email) để cross-channel identification

### Multi-Channel Input Adapters

- **FR9:** Hotline Adapter nhận request từ SĐT gọi đến → tự động lookup KH → trả hồ sơ cho tổng đài viên
- **FR10:** Zalo Adapter nhận text message từ KH qua Zalo OA → xác thực qua Zalo ID liên kết SĐT
- **FR11:** Mỗi Adapter chuẩn hóa request về format thống nhất trước khi gửi Orchestrator Core
- **FR12:** Thêm kênh mới chỉ cần thêm Adapter mới — không sửa Orchestrator Core
- **FR13:** Hệ thống ghi nhận kênh gốc (`provider`) của mỗi request cho audit và routing

### Orchestrator Core — Request Routing & Processing

- **FR14:** Orchestrator chuẩn hóa mọi request từ adapter → routing đến đúng backend API endpoint
- **FR15:** Orchestrator nhận dạng intent của KH từ tin nhắn (báo sự cố, hỏi hóa đơn, khiếu nại) để route đúng với độ chính xác ≥ 80% (MVP), ≥ 92% (12 tháng)
- **FR16:** Orchestrator điều phối request đến 5 mock endpoints khi backend chưa sẵn sàng
- **FR17:** Orchestrator điều phối request đến live backend API khi backend sẵn sàng — chuyển đổi config-driven
- **FR18:** Hệ thống chuyển đổi endpoint từ mock sang live chỉ bằng thay đổi config, không cần restart process, không downtime

### Ticket Lifecycle Management

> **Note:** Ticket là tracking artifact thuộc CSKH module — dùng để theo dõi request flow từ KH đến Backend. CSKH sở hữu DB Ticket. Backend nhận ticket ID để xử lý nghiệp vụ (sửa ống, tính cước) và gửi event/webhook cập nhật trạng thái cho CSKH.

- **FR19:** Hệ thống tạo ticket mới với auto-generated ID, loại ticket (sự cố, khiếu nại, hỏi thông tin), kênh gốc, và timestamp — sau đó forward ticket ID đến Backend API để xử lý nghiệp vụ
- **FR20:** Hệ thống cho phép tra cứu trạng thái ticket theo ID
- **FR21:** Hệ thống cho phép cập nhật trạng thái ticket: `open` → `in_progress` → `resolved` → `closed` — cập nhật đến từ 2 nguồn: (a) NV thao tác qua kênh, (b) Backend gửi event/webhook khi xử lý xong nghiệp vụ
- **FR22:** Hệ thống ghi log mọi trạng thái thay đổi ticket với timestamp, actor (NV/Backend/system), và chi tiết

### Context Preservation (Cross-Channel)

- **FR23:** Hệ thống lưu mọi tương tác KH (chat, call, visit) vào session store với event type, timestamp, và content — 100% tương tác được ghi nhận trong < 1 giây
- **FR24:** Hệ thống tự động nối tiếp session khi KH chuyển kênh — dựa trên User ID, không dựa kênh
- **FR25:** Tổng đài viên xem được toàn bộ lịch sử tương tác KH qua mọi kênh trong session active
- **FR26:** Session có TTL 24-48h, sau đó đóng để giải phóng session store. Session store phải bật persistence (AOF hoặc tương đương) để đảm bảo session survive restart — KH chat Zalo buổi sáng vẫn còn context khi chiều gọi Hotline kể cả khi session store restart giữa chừng. Ticket tồn tại vĩnh viễn trong DB

### Resilience & Graceful Degradation

- **FR27:** Hệ thống phát hiện backend API down qua Circuit Breaker → tự động fallback sang cached data
- **FR28:** Hệ thống luôn trả response cho KH — kể cả khi backend down (cached hoặc queued message)
- **FR29:** Hệ thống cache dữ liệu với TTL phân tầng: static 12-24h, dynamic 5-15 phút, transaction không cache
- **FR30:** Hệ thống ghi log cảnh báo cho Admin khi Circuit Breaker mở hoặc fallback kích hoạt

### Notification & CSAT

- **FR31:** Hệ thống gửi thông báo cho KH qua kênh phù hợp (Zalo, SMS) khi ticket cập nhật trạng thái
- **FR32:** Hệ thống gửi CSAT survey tự động sau mỗi tương tác (cuộc gọi, chat session)
- **FR33:** Hệ thống thu thập và forward CSAT data đến API thống kê
- **FR43:** Hệ thống kiểm soát tần suất gửi tin nhắn qua kênh bên thứ ba (Zalo, SMS) — rate limiting không quá 2 tin/KH/ticket/ngày. Với cập nhật trạng thái liên tục, hệ thống gộp (batching) hoặc chỉ gửi notification ở trạng thái cuối (`resolved`/`closed`) để tuân thủ chính sách quota của nền tảng

### Mocking System

- **FR34:** Hệ thống cung cấp 5 JSON mock files giả lập response từ backend API chưa sẵn sàng
- **FR35:** Mock data schema phải match OpenAPI spec do Backend cung cấp
- **FR36:** Hệ thống hỗ trợ hot reload config để chuyển mock → live mà không restart process

### Identity Propagation

- **FR37:** Mỗi request từ Orchestrator đến Backend phải kèm authenticated identity token trong header cho phép Backend xác thực và phân quyền
- **FR38:** Hệ thống xử lý error response từ Backend liên quan identity: token hết hạn (auto-refresh), user không tồn tại (thông báo KH), role không khớp (403), identity mismatch (config error)
- **FR39:** Orchestrator và Backend chia sẻ identity contract — định nghĩa thống nhất về user identity, role mapping, và token format giữa 2 hệ thống

### Error Handling & User Communication

- **FR40:** Khi Backend trả 404 "User not found" → hệ thống trả KH: "Hồ sơ đang được cập nhật, xin vui lòng thử lại sau" + log cảnh báo Admin
- **FR41:** Khi Backend trả 403 Forbidden → hệ thống trả: "Bạn không có quyền thực hiện thao tác này"
- **FR42:** Khi Backend trả 401 Unauthorized → hệ thống auto-refresh token → retry request → KH không thấy gián đoạn

---

## Non-Functional Requirements

### Performance

| ID | Requirement | Metric | Measurement |
|----|-------------|--------|-------------|
| NFR-P1 | Adapter response time (không tính backend latency) | < 200ms | APM monitoring (p95) |
| NFR-P2 | Auth latency (login → token ready) | < 500ms | APM monitoring (p95) |
| NFR-P3 | KH identification (SĐT gọi đến → hồ sơ hiện trên màn hình) | < 5 giây (MVP), < 3 giây (12 tháng) | End-to-end measurement |
| NFR-P4 | Backend API timeout | 3 giây | Configurable per endpoint |
| NFR-P5 | Config hot reload latency | < 100ms | Time from config change to effect |
| NFR-P6 | Concurrent session support | 500 active sessions | Load testing |

### Security

| ID | Requirement | Metric | Measurement |
|----|-------------|--------|-------------|
| NFR-S1 | Dữ liệu cá nhân KH mã hóa at rest | AES-256 | Database encryption audit |
| NFR-S2 | Dữ liệu truyền tải mã hóa in transit | TLS 1.3 | SSL Labs scan |
| NFR-S3 | Signing key lưu trong env var, không hardcode | Zero hardcoded secrets | Code scan (SAST) |
| NFR-S4 | Access token TTL | 15 phút | Token inspection |
| NFR-S5 | Refresh token TTL | 7 ngày | Token inspection |
| NFR-S6 | RBAC enforcement ở cả Orchestrator và Backend | 100% endpoints protected | Penetration testing |
| NFR-S7 | Audit log mọi truy cập/chỉnh sửa dữ liệu KH | 100% actions logged | Log completeness check |
| NFR-S8 | Audit log retention | ≥ 12 tháng | Log storage audit |
| NFR-S9 | PII masking trong application logs | 100% PII fields (SĐT, tên, địa chỉ, CCCD) được masking hoặc hashing trước khi ghi log. Log chỉ lưu UserID hoặc masked identifier (VD: `098***23`) | Log sampling audit |

### Reliability

| ID | Requirement | Metric | Measurement |
|----|-------------|--------|-------------|
| NFR-R1 | Multi-channel uptime | ≥ 99.5% | Uptime monitoring (monthly) |
| NFR-R2 | Total outage (tất cả backend down) | 0% — KH luôn nhận response | Incident tracking |
| NFR-R3 | Circuit Breaker detection latency | < 10 giây từ khi backend fail → fallback active | Failover testing |
| NFR-R4 | Session survive store restart | 100% session preserved | Restart test (persistence enabled) |
| NFR-R5 | Config rollback | < 30 giây | Config change → rollback test |

### Scalability

| ID | Requirement | Metric | Measurement |
|----|-------------|--------|-------------|
| NFR-SC1 | Horizontal scaling | ≥ 0.8x throughput increase per additional pod | Load testing |
| NFR-SC2 | Adapter thêm không ảnh hưởng core | 0 code change in core per new adapter | Code review |
| NFR-SC3 | Mock → Live switching không ảnh hưởng throughput | < 5% performance delta during switch | Performance test |

### Integration

| ID | Requirement | Metric | Measurement |
|----|-------------|--------|-------------|
| NFR-I1 | API schema compliance với OpenAPI spec | 100% match — Orchestrator fail to start ở dev/staging nếu mock JSON không pass schema validation với Swagger mới nhất (tích hợp vào CI/CD pipeline) | Automated contract testing (CI/CD gate) |
| NFR-I2 | Backend API change notification | Before deployment | Process enforcement |
| NFR-I3 | Zalo OA API integration | Compliant with Zalo Official Account API | Integration testing |
| NFR-I4 | Hotline/IVR webhook response time | < 500ms | APM monitoring |

---

## Traceability Matrix

### Vision → Success Criteria → FRs

| Vision Pillar | Success Criteria | Functional Requirements |
|--------------|-----------------|------------------------|
| Auth tập trung một lần | US-1, TS-3 | FR1-FR8, FR37-FR39 |
| Hexagonal Architecture đa kênh | US-3, TS-2, TS-4 | FR9-FR13, FR14-FR18 |
| Mocking System song song | TS-1, TS-5 | FR34-FR36 |
| Context Preservation xuyên kênh | US-2, TS-7 | FR23-FR26 |
| Graceful Degradation | TS-6 | FR27-FR30, FR40-FR42 |
| Ticket Lifecycle | BS-3, BS-4, BS-6 | FR19-FR22 |
| Notification & CSAT | US-4, BS-5 | FR31-FR33, FR43 |

### User Journeys → FRs

| Journey | Key FRs |
|---------|---------|
| J1: Tổng đài viên xử lý sự cố | FR1, FR5-FR7, FR9, FR14-FR16, FR19-FR21, FR31-FR32, FR37-FR39 |
| J2: KH báo sự cố qua Zalo | FR2, FR10-FR11, FR15-FR16, FR19, FR31, FR37, FR43 |
| J3: KH cao tuổi Hotline | FR1, FR9, FR13, FR32 |
| J4: Cross-channel context | FR8, FR23-FR26, FR37-FR39 |
| J5: Backend down | FR27-FR30, FR38, FR40-FR42 |
| J6: Mock → Live migration | FR18, FR34-FR36 |
