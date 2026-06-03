---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - docs/Mota_Tinh_Nang_KinhDoanh_KhachHang (AutoRecovered).docx
  - docs/index.md
  - docs/project-overview.md
  - docs/architecture.md
  - docs/source-tree-analysis.md
  - docs/api-contracts.md
  - docs/data-models.md
  - docs/development-guide.md
  - README.md
  - INTEGRATION_GUIDE.md
date: 2026-06-02
author: Pc
scope-revision: "v2 — CSKH redefined as API Gateway/Orchestrator (Quầy Lễ tân)"
---

# Product Brief: Module CSKH — Trạm Điều phối Trung tâm

## Executive Summary

Module CSKH không phải một hệ thống nguyên khối (monolith) ôm đồm mọi dữ liệu. **Module CSKH là một "Quầy Lễ tân"** — trạm điều phối trung tâm (API Gateway / Orchestrator) tiếp nhận mọi yêu cầu từ khách hàng qua đa kênh, xác thực danh tính, và điều phối request đến các hệ thống nghiệp vụ phía sau.

**Công nghệ đỉnh cao nhất chính là thứ công nghệ "tàng hình"** — Quầy Lễ tân hoạt động lặng lẽ, đảm bảo khách hàng gọi đến được chào bằng tên, yêu cầu được chuyển đúng bếp, và phản hồi được trả về đúng kênh. Khách hàng không cần biết hệ thống bên trong hoạt động thế nào — họ chỉ biết mọi thứ trơn tru.

### 3 Trụ cột Sản phẩm

| # | Trụ cột | Trách nhiệm | DB riêng? |
|---|---------|------------|-----------|
| 1 | **Auth & Phân quyền** | better-auth, User/Session, phân rạch ròi Khách hàng vs Nhân viên vs Lãnh đạo | ✅ Có (User/Session) |
| 2 | **Hexagonal Architecture** | Input adapters đa kênh (Zalo/App/Hotline/Quầy), chuẩn hóa request, routing, SLA tracking | ❌ Không |
| 3 | **Mocking System** | JSON giả lập API backend chưa sẵn sàng → luồng routing vẫn chạy trơn không bị block | ❌ Không |

### Ranh giới Rõ ràng

```
✅ NHIỆM VỤ CỦA MODULE CSKH            ❌ KHÔNG PHẢI NHIỆM VỤ
─────────────────────────            ──────────────────────────
Xác thực & phân quyền (A-Z)         DB nghiệp vụ (Hóa đơn, Đồng hồ)
Đa kênh adapter (Zalo/App/Hotline)  Logic tính cước bậc thang
Chuẩn hóa & routing request         Thuật toán nhắc nợ tự động
SLA tracking & ticket lifecycle     Gán người sửa ống
Mock data cho API chưa sẵn sàng     Module nghiệp vụ lõi (bạn Thương)
CSAT/NPS collection & forwarding    Data models nghiệp vụ
```

### Ràng buộc Kỹ thuật (Technical Constraints)

**C1. API Contract First — Điều kiện tiên quyết bắt buộc**

Module CSKH không thể bắt đầu code Mock data nếu không có spec. **Team Backend Lõi ** bắt buộc phải cung cấp và chốt file **OpenAPI/Swagger** cho 5 endpoints giao tiếp **trước khi code bắt đầu**.

- Orchestrator sẽ dùng Swagger spec để sinh mock data (qua Prism/Mockoon).
- Nếu Thương tự ý đổi schema mà không cập nhật Swagger → lỗi thuộc về Backend Lõi.
- Swagger spec là **hợp đồng (contract)** giữa 2 team — vi phạm contract = block integration.

**C2. Auth Token Propagation — Đồng bộ Identity giữa Orchestrator và Backend**

Auth Layer (better-auth) issue JWT Token / Session ID cho mọi request. Khi Orchestrator gọi Backend API (bạn Thương), token phải chứa đủ thông tin để Backend biết xử lý dữ liệu của ai:

```json
// JWT Payload truyền xuống Backend API
{
  "sub": "USR-12345",           // UserID duy nhất (better-auth)
  "roles": ["customer"],         // RBAC role
  "provider": "zalo",            // Kênh gốc của request
  "session_id": "SES-67890",     // Session ID cho Context Preservation
  "xi_nghiep": "cam_pha",        // Xí nghiệp (post-MVP, MVP hardcode "central")
  "iat": 1748995200,
  "exp": 1749081600
}
```

- Backend API dùng `sub` (UserID) để query data đúng KH.
- Backend API dùng `roles` để kiểm tra quyền truy cập (KH chỉ xem data mình).
- `provider` giúp Backend trace log kênh gốc nếu cần audit.
- **Thương phải implement JWT verification** ở phía Backend để accept token từ Orchestrator.

## Câu chuyện Khách hàng

> **Cô Nguyễn, 72 tuổi, sống một mình ở Hồng Gai.**
>
> Buổi sáng cô phát hiện nước yếu. Cô gọi Hotline 1900 — nhưng không biết nhấn phím nào. Cô chờ 3 phút, bực mình, cúp máy. Gọi lại, lần này gặp tổng đài viên — nhưng phải kể lại từ đầu. Tổng đài viên hỏi mã KH — cô không nhớ. Hỏi địa chỉ — cô nói sai tên đường. Sau 10 phút, cuối cùng cũng mở được ticket... nhưng 2 ngày sau vẫn chưa ai đến. Cô gọi lại. Lại kể lại từ đầu. *Đó là trải nghiệm hiện tại.*
>
> **Trải nghiệm mới (qua Module CSKH):** Cô gọi Hotline → Adapter Hotline tiếp nhận → Auth layer xác thực SĐT → Orchestrator gọi API Customer 360° lấy hồ sơ → trả về cho tổng đài viên: *"Xin chào cô Nguyễn Thị Lan, nhà cô ở 23 phố Hạ Long đúng không ạ?"* → Cô nói *"Nước yếu"* → Orchestrator route đến API GIS/Sự cố → phát hiện bảo trì đường ống khu vực → trả kết quả: *"Khu vực nhà cô đang bảo trì, dự kiến xong 2 giờ chiều"* → Orchestrator tạo notification → Adapter Zalo gửi: *"Nước đã trở lại rồi cô ơi!"* 🎉
>
> **Module CSKH không nấu ăn — nhưng đảm bảo order đến đúng bếp và món ăn đến đúng bàn.**

---

## Core Vision

### Problem Statement

Hệ thống CSKH hiện tại của Công ty IOC **phân mảnh và thiếu lớp điều phối**:

- **Không có cổng vào thống nhất**: Mỗi kênh (Hotline, quầy, Zalo) hoạt động độc lập — khách hàng đổi kênh là mất ngữ cảnh.
- **Không có lớp xác thực tập trung**: Không phân biệt được ai gọi đến — khách hàng, nhân viên, hay lãnh đạo — nên không thể phân quyền đúng.
- **Không có routing thông minh**: Mọi request đều phải xử lý thủ công — khiếu nại hóa đơn, báo sự cố, tra cứu tiêu thụ đều đi cùng một luồng.
- **Thiếu SLA tracking**: Không biết yêu cầu nào đang ở đâu, bao lâu rồi, ai đang xử lý.

### Problem Impact

Thiếu lớp điều phối trung tâm dẫn đến:
- Khách hàng **kể lại thông tin nhiều lần** khi đổi kênh hoặc đổi người phục vụ.
- Tổng đài viên **xử lý "mù"** — không có ngữ cảnh KH, không biết request nên route đi đâu.
- Không **đo lường được** chất lượng dịch vụ — không có SLA, không có CSAT hệ thống.
- Khi backend nghiệp vụ chưa sẵn sàng → **toàn bộ luồng bị block**, không thể diễn tập và test.

### Why Existing Solutions Fall Short

Giải pháp CRM phổ biến (Zendesk, Salesforce) **không phù hợp** vì:
1. Thiết kế cho mô hình bán hàng — không phải dịch vụ công độc quyền.
2. Không tích hợp GIS/SCADA đặc thù ngành nước.
3. Không hỗ trợ kiến trúc orchestrator — chúng muốn **sở hữu** dữ liệu, không phải **điều phối** dữ liệu.
4. Không hỗ trợ mocking — không thể chạy khi backend chưa sẵn sàng.

### Proposed Solution

**Module CSKH — Trạm Điều phối Trung tâm** với kiến trúc Hexagonal:

```
                    ĐA KÊNH (Input Adapters)
                    ┌────────────────────────┐
   Zalo ──────────►│ Zalo Adapter            │
   Mobile App ────►│ Mobile Adapter           │
   Hotline ───────►│ Hotline Adapter           │
   Quầy ──────────►│ Counter Adapter           │
   Web ───────────►│ Web Adapter               │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │    AUTH LAYER             │
                    │    (better-auth)          │
                    │    • User/Session DB      │
                    │    • RBAC: KH/Nhân viên   │
                    │      /Lãnh đạo/Admin      │
                    │    • Token management     │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │    ORCHESTRATOR CORE      │
                    │    • Request chuẩn hóa     │
                    │    • Smart routing          │
                    │    • SLA tracking           │
                    │    • CSAT collection         │
                    │    • Ticket lifecycle        │
                    │    • Notification dispatch   │
                    └────────────┬─────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │ Mock API     │  │ Backend API  │  │ Mock API     │
     │ (tạm thời)   │  │              │  │ (tạm thời)   │
     │              │  │              │  │              │
     │ Customer 360°│  │ Billing      │  │ GIS/SCADA    │
     │ → mock.json  │  │ → live API   │  │ → mock.json  │
     └──────────────┘  └──────────────┘  └──────────────┘
```

### Key Differentiators

1. **"Quầy Lễ tân" tinh gọn**: Không ôm đồm nghiệp vụ — chỉ điều phối. Dễ xây, dễ test, dễ bảo trì. Khi backend (bạn Thương) sẵn sàng → chuyển từ mock sang live API chỉ bằng config.

2. **Auth tập trung một lần**: better-auth xử lý xác thực cho mọi kênh. Một lần đăng nhập → truy cập mọi dịch vụ. Phân quyền rõ ràng: KH chỉ xem dữ liệu mình, nhân viên xem theo địa bàn, lãnh đạo xem toàn hệ thống.

3. **Đa kênh thực sự (không phải đa giao diện)**: Cùng một Orchestrator core phục vụ Zalo bot, Mobile app, Hotline IVR, quầy giao dịch. Thêm kênh mới = thêm 1 Adapter, không sửa core.

4. **Mocking cho phép song song**: Bạn Thương xây backend, bạn xây CSKH — **không block nhau**. Mock data đảm bảo luồng routing chạy trơn ngay từ ngày đầu.

5. **Thiết kế cho mọi người dân Quảng Ninh**: Adapter cho người cao tuổi (Hotline IVR đơn giản) đến adapter cho Gen Z (Zalo OA chatbot). Cùng một core, trải nghiệm phù hợp từng đối tượng.

---

## Technical Scenarios — Kiến trúc Chi tiết

### K1. 🔄 KH chuyển kênh giữa chừng — Context Preservation

**Bài toán:** KH bắt đầu trên Zalo → chuyển sang Hotline → tổng đài viên thấy toàn bộ lịch sử chat Zalo. Hoặc KH gọi Hotline xong → đến quầy → nhân viên quầy thấy ghi chú cuộc gọi.

**Giải pháp kiến trúc:**

| Thành phần | Vai trò | Chi tiết |
|-----------|---------|----------|
| **Auth Layer (better-auth)** | Liên kết đa Provider | 1 User liên kết nhiều Provider: SĐT, Zalo ID, Facebook, Email |
| **Session Store** | Context tracking | Redis, key = `session:{userId}`, TTL 24-48h |
| **Event Sourcing nhẹ** | Lưu chuỗi sự kiện | Mỗi tương tác (chat, call, visit) = 1 event trong session. **Redis Persistence bắt buộc**: dùng AOF (Append Only File) để đảm bảo session survive restart — KH chat Zalo buổi sáng vẫn còn context khi chiều gọi Hotline dù Redis restart giữa chừng. |

**Luồng hoạt động:**

```
1. KH nhắn Zalo "Nhà tôi mất nước"
   → Zalo Adapter → Auth lookup Zalo ID → UserID = "USR-12345"
   → Orchestrator tạo Session #12345, event: {type: "zalo_message", content: "Nhà tôi mất nước"}
   → Route đến API GIS (mock) → tạo ticket #TK-2026-001
   → Event: {type: "ticket_created", ticketId: "TK-2026-001"}

2. KH gọi Hotline 2 giờ sau
   → Hotline Adapter → Auth lookup SĐT → cùng UserID = "USR-12345"
   → Orchestrator query session:{USR-12345} → tìm Session #12345 còn active
   → Tổng đài viên thấy đầy đủ: Zalo chat + ticket #TK-2026-001 + GIS result
   → Không hỏi lại KH — nối tiếp luôn
```

**Quyết định thiết kế:**
- Session không phụ thuộc backend (mock hay live đều track được) — Orchestrator stateful với session, stateless với backend
- Ticket tồn tại vĩnh viễn trong DB lõi, nhưng "session chat" đóng sau 24-48h để giải phóng Redis

### K5. 💥 Backend API Down — Graceful Degradation

**Bài toán:** Orchestrator phải không bao giờ "chết" vì backend chết. KH luôn nhận được phản hồi — dù không đầy đủ.

**Chiến lược 3 tầng:**

| Tầng | Trigger | Trải nghiệm KH | Chi tiết kỹ thuật |
|------|---------|----------------|-------------------|
| **Live API** | Backend hoạt động bình thường | Trả kết quả đầy đủ | Timeout 3s, retry 3 lần |
| **Cached Fallback** | Circuit Breaker mở + có cache | "Dữ liệu cập nhật lúc HH:MM" | Cache分层 theo TTL |
| **Queue + Notify** | API down + không cache | "Sẽ gửi kết quả qua [kênh] trong [thời gian]" | DLQ + Exponential Backoff |

**Cache Strategy:**

| Loại dữ liệu | TTL | Lý do |
|--------------|-----|-------|
| Định danh KH, hợp đồng, biểu giá | 12-24h | Hiếm khi thay đổi |
| Công nợ, lịch sử thanh toán, trạng thái ticket | 5-15 phút | Thay đổi theo tương tác |
| Giao dịch thanh toán, lệnh SCADA | **TUYỆT ĐỐI KHÔNG CACHE** | Phải gọi live 100% |

**Circuit Breaker config (opossum/Node.js):**
- Threshold: lỗi > 50% trong rolling window 10 giây, hoặc 5-10 fail liên tiếp
- Open State → chặn request → kích hoạt fallback ngay lập tức
- Half-Open → cho 1 probe request thử → nếu OK → close lại

**Retry Queue:**
- Event-driven (BullMQ trên Redis hoặc RabbitMQ)
- Exponential Backoff: 2s → 4s → 8s → 16s (tránh Thundering Herd)
- Dead Letter Queue cho request thất bại > max retries

### K6. 🔀 Mock → Live Migration (Zero-Downtime Switch)

**Bài toán:** Khi bạn Thương xong API → chuyển mock sang live mà KH không thấy gián đoạn.

**Config-driven switching (Hot Reload):**

```yaml
# config/api-endpoints.yaml — lưu trong Consul/Redis hoặc @nestjs/config watch
endpoints:
  customer360:
    current: mock                      # ← Chỉ đổi dòng này
    mock:
      type: file
      path: ./mocks/customer360.json
      latency: 200ms                   # Giả lập độ trễ thực tế
    live:
      type: http
      url: https://api.ioc.local/v1/customers
      timeout: 3000ms
      retry: 3
      circuit_breaker:
        threshold: 0.5
        window_ms: 10000
```

**API Contract First — Ranh giới trách nhiệm:**
- **Bạn Thương (Backend)**: Bắt buộc cung cấp Swagger/OpenAPI **trước khi code**
- **Bạn (CSKH)**: Dùng Prism hoặc Mockoon sinh mock data từ Swagger đó
- **Quy tắc**: Nếu Thương tự ý đổi schema mà không đổi Swagger → lỗi thuộc về Backend

**Shadow Mode (cho API liên quan Tiền):**

```
Phase 1: Mock only          → KH nhận mock response
Phase 2: Shadow Mode (3 ngày)
  → Gọi song song Mock + Live
  → So sánh kết quả, ghi log
  → KH vẫn nhận Mock (an toàn)
  → Nếu 100% match trong 3 ngày → pass
Phase 3: Live               → KH nhận live response
```

### K7. 🌐 Đa Xí nghiệp — Routing theo Địa bàn

**Bài toán:** Công ty có 4 Xí nghiệp → request phải route đúng đội, đúng SLA.

**Routing Architecture:**

```
KH gọi Hotline → Auth lookup → Customer 360° (mock/live)
  → Đọc tọa độ GIS hoặc "Mã DMA của đồng hồ" (KHÔNG đọc cờ "Mã Xí Nghiệp" cứng)
  → Routing Engine query config table:
      "Cẩm Phả, Đông Triều"     → xi_nghiep_cam_pha  (SLA sửa ống: 4h)
      "Hồng Gai, Hạ Long"       → xi_nghiep_hong_gai (SLA sửa ống: 2h)
      "Bãi Cháy"                → xi_nghiep_bai_chay (SLA sửa ống: 2h)
      "Móng Cái, Bình Liêu"     → xi_nghiep_mong_cai (SLA sửa ống: 6h)
  → Route ticket đến queue Xí nghiệp tương ứng
  → Fallback: Không xác định → queue chung → Trưởng phòng phân manually
```

**SLA Engine động:**

```
SLA timeout = f(Loại_Sự_Cố, Mã_Xí_Nghiệp)

Ví dụ: Sửa ống vỡ
  + Hồng Gai (đô thị, giao thông tốt) → 2 giờ
  + Móng Cái (địa hình đồi núi)       → 6 giờ

Ví dụ: Khiếu nại hóa đơn
  + Tất cả xí nghiệp                   → 24 giờ phản hồi
```

**Config-driven 100%:**
- Routing table lưu trong DB/Cache, không hardcode
- Admin thêm/bớt quận huyện vào xí nghiệp mà không cần deploy
- KH chuyển địa bàn → routing tự động theo địa chỉ mới (dựa GIS/DMA, không dựa profile cứng)

### K8. 🔐 Mất đồng bộ Auth — Identity Propagation

**Bài toán:** Auth Layer (better-auth) issue UserID. Backend API (bạn Thương) cũng phải hiểu UserID này. Nếu 2 bên không đồng bộ → Orchestrator gửi request với UserID "USR-12345" nhưng Backend không biết user này là ai → trả 404 hoặc sai data.

**Giải pháp: JWT Token chuẩn hóa truyền xuống Backend**

Mỗi request từ Orchestrator → Backend API phải kèm JWT trong header `Authorization: Bearer <token>`. Token payload chứa:

```json
{
  "sub": "USR-12345",           // UserID duy nhất (better-auth primary key)
  "roles": ["customer"],         // RBAC: "customer" | "employee" | "manager" | "admin"
  "provider": "zalo",            // Kênh gốc: "zalo" | "hotline" | "counter" | "web"
  "session_id": "SES-67890",     // Session ID cho Context Preservation (K1)
  "xi_nghiep": "central",        // Xí nghiệp (MVP: hardcode "central")
  "iat": 1748995200,              // Issued at
  "exp": 1749081600               // Expiration
}
```

**Trách nhiệm phân rõ:**

| Bên | Trách nhiệm |
|-----|------------|
| **Orchestrator (bạn)** | Issue JWT, ký bằng secret key, gắn vào mọi request gọi Backend |
| **Backend Lõi (Thương)** | Verify JWT signature, extract `sub` để query data, check `roles` cho RBAC |

**Kịch bản lỗi & xử lý:**

```
Case 1: Token hết hạn (exp passed)
  → Backend trả 401 Unauthorized
  → Orchestrator tự động refresh token (better-auth refresh flow)
  → Retry request với token mới → KH không thấy gián đoạn

Case 2: UserID không tồn tại ở Backend (new user, chưa sync)
  → Backend trả 404 "User not found"
  → Orchestrator trả về: "Hồ sơ đang được cập nhật, xin vui lòng thử lại sau"
  → Log cảnh báo cho Admin kiểm tra sync

Case 3: Role không khớp (KH token nhưng gọi API chỉ dành NV)
  → Backend trả 403 Forbidden
  → Orchestrator trả về: "Bạn không có quyền thực hiện thao tác này"

Case 4: Secret key không khớp (Orchestrator & Backend dùng key khác nhau)
  → Backend trả 401 "Invalid signature"
  → **Đây là lỗi config — không bao giờ xảy ra trên production nếu deploy đúng**
```

**Shared Secret Strategy:**
- Secret key dùng để ký JWT lưu trong environment variable, **không hardcode**
- Orchestrator và Backend đọc cùng 1 giá trị từ `JWT_SECRET` env var
- Rotate key: Đặt `JWT_SECRET_OLD` + `JWT_SECRET_NEW` → Backend verify cả 2 → sau 24h xóa key cũ

---

## Target Users

### Primary Users

#### Persona 1: Tổng đài viên — "Lan"

- **Vai trò**: Tiếp nhận và xử lý cuộc gọi tại Hotline 1900.545.520
- **Công cụ**: Module CSKH qua Hotline Adapter + Auth (đăng nhập nhân viên)
- **Ngày làm việc**: Xử lý 60-80 cuộc gọi/ngày, mỗi cuộc 3-7 phút
- **Vấn đề hiện tại**: Phải hỏi KH mã số, địa chỉ, tra Google tìm thông tin — mất 2-3 phút mỗi cuộc chỉ để xác định KH là ai
- **Trải nghiệm mới**: Auth login → Hotline Adapter tự nhận diện SĐT gọi đến → Orchestrator gọi API Customer 360° → pop-up hồ sơ KH hiện ngay trên màn hình → Lan chỉ cần nói *"Chào anh Tuấn, em thấy tháng này hóa đơn nhà anh..."*
- **"Aha!" moment**: Cuộc gọi đầu tiên mà hệ thống tự hiện tên KH — *"Hệ thống biết mình là ai!"*

#### Persona 2: Khách hàng sinh hoạt — "Cô Nguyễn"

- **Vai trò**: Người dân sử dụng dịch vụ cấp nước
- **Công cụ**: Zalo OA, Hotline IVR, hoặc quầy giao dịch
- **Hành vi**: Gọi khi có sự cố (nước yếu, mất nước, rò rỉ), khi hỏi hóa đơn, khi khiếu nại. Không rành công nghệ.
- **Vấn đề hiện tại**: Không biết gọi ai, phải kể lại nhiều lần, chờ đợi không biết khi nào xong
- **Trải nghiệm mới**: Gọi Hotline → IVR 1 nhấn → tự nhận diện → tổng đài viên đã biết mình → báo sự cố xong → nhận Zalo thông báo tiến độ
- **"Aha!" moment**: Nhận tin Zalo *"Nước đã trở lại"* mà không phải gọi hỏi

#### Persona 3: Nhân viên CSKH tại quầy — "Minh"

- **Vai trò**: Phục vụ khách hàng đến trực tiếp tại điểm giao dịch
- **Công cụ**: Module CSKH qua Counter Adapter + Auth (đăng nhập nhân viên)
- **Hành vi**: Tra cứu hóa đơn, tiếp nhận khiếu nại, xử lý đăng ký dịch vụ, thu cước
- **Vấn đề hiện tại**: Phải mở nhiều hệ thống riêng lẻ để tra cứu thông tin KH
- **Trải nghiệm mới**: 1 màn hình duy nhất → Orchestrator aggregate dữ liệu từ nhiều API backend → hiển thị đầy đủ ngữ cảnh KH

### Secondary Users

#### Persona 4: Trưởng phòng Kinh doanh — "Anh Đức"

- **Vai trò**: Giám sát KPI, phê duyệt, phân tích
- **Công cụ**: Dashboard Adapter → Orchestrator gọi API thống kê
- **Nhu cầu**: Xem CSAT theo nhân viên, SLA theo địa bàn, số lượng ticket theo loại — không cần vào chi tiết từng ticket

#### Persona 5: Khách hàng lớn (KCN, Bệnh viện) — "KCN Cẩm Phả"

- **Vai trò**: Tổ chức có hợp đồng đặc thù, sản lượng lớn
- **Công cụ**: Mobile Adapter hoặc API tích hợp trực tiếp (EDI)
- **Nhu cầu**: Tra cứu hóa đơn hàng loạt, báo sự cố ưu tiên, liên hệ qua kênh riêng (email chính thức)
- **Đặc thù**: Cần routing ưu tiên → tổng đài viên có chuyên môn về KH lớn

### User Journey

#### Journey 1: Tổng đài viên xử lý cuộc gọi KH báo sự cố

```
1. Lan đăng nhập hệ thống (Auth layer → nhận token nhân viên)
2. Cuộc gọi đến → Hotline Adapter nhận SĐT → Orchestrator gọi API Customer 360° (mock)
3. Màn hình pop-up hồ sơ KH → Lan chào bằng tên
4. KH báo "nước yếu" → Lan chọn loại ticket "Sự cố" → Orchestrator gọi API tạo ticket (mock)
5. Orchestrator route request đến API sự cố GIS (mock) → kiểm tra nguyên nhân
6. Kết quả: "Đang bảo trì đường ống, dự kiến xong 14:00" → Lan thông báo cho KH
7. Sau cuộc gọi → CSAT survey tự động gửi qua SMS/Zalo
8. Lan đánh giá cuộc gọi → Orchestrator forward CSAT data đến API thống kê (mock)
```

#### Journey 2: KH báo sự cố qua Zalo OA

```
1. KH nhắn tin "Nhà tôi mất nước" qua Zalo OA
2. Zalo Adapter tiếp nhận → Auth layer xác thực KH (SĐT liên kết Zalo)
3. Orchestrator nhận dạng intent "báo sự cố" → yêu cầu chọn loại + gửi ảnh
4. KH gửi ảnh rò rỉ → Orchestrator gọi API upload + tạo ticket (mock)
5. Orchestrator trả về mã ticket + link tra cứu tiến độ
6. Khi ticket cập nhật → Notification Adapter gửi Zalo message cho KH
```

#### Journey 3: KH cao tuổi gọi Hotline

```
1. Cô Nguyễn gọi 1900 → IVR: "Nhấn 0 gặp tổng đài viên" (đơn giản, 1 bước)
2. Auth layer nhận diện SĐT → Orchestrator gọi API Customer 360° (mock)
3. Tổng đài viên thấy hồ sơ: 72 tuổi, KH thẻ ưu đãn, địa chỉ Hồng Gai
4. Tổng đài viên xử lý bằng ngôn ngữ đơn giản, không dùng thuật ngữ
5. Sau cuộc gọi → CSAT qua SMS (1 câu: "Anh/chị hài lòng không? Nhấn 1 Có / 2 Không")
```

---

## Success Metrics

### User Success Metrics

| Metric | Đo lường | 6 tháng | 12 tháng | 24 tháng |
|--------|----------|---------|----------|----------|
| **Thời gian xác thực KH** | Từ lúc gọi đến → tổng đài viên thấy hồ sơ | < 5 giây | < 3 giây | < 2 giây |
| **Tỷ lệ KH không phải kể lại** | KH xác nhận "không phải nhắc lại thông tin" | 70% | 90% | 95% |
| **Ticket routing chính xác** | Request được route đúng backend API ở lần đầu | 80% | 92% | 95% |
| **CSAT sau tương tác** | KH đánh giá ≥ 4/5 sao | 60% | 75% | 80% |
| **Tổng đài viên hài lòng** | Internal survey về công cụ CSKH | 70%+ | 85%+ | 90%+ |

### Technical Success Metrics

| Metric | Mục tiêu | Ghi chú |
|--------|----------|---------|
| **Mock → Live switch** | < 1 ngày mỗi endpoint | Config-driven, không sửa code |
| **Adapter response time** | < 200ms | Không tính backend latency |
| **Auth latency** | < 500ms | Login → token ready |
| **Multi-channel uptime** | 99.5%+ | Tất cả adapters |
| **Mock coverage** | 100% ban đầu → giảm dần | Khi backend sẵn sàng |
| **Graceful degradation** | 0% total outage | Luôn trả response (dù cached/queued) |
| **Context preservation** | 95%+ cross-channel context | KH chuyển kênh → giữ ngữ cảnh |

### Business Objectives

| Mục tiêu | Metric | 6 tháng | 12 tháng | 24 tháng |
|-----------|--------|---------|----------|----------|
| **Giảm thời gian xử lý cuộc gọi** | AHT (Average Handling Time) | -20% | -30% | -40% |
| **Giảm gọi nhỡ** | Abandon Rate | < 12% | < 8% | < 5% |
| **Giải quyết ngay lần đầu** | FCR (First Call Resolution) | 60% | 70% | 75%+ |
| **Giảm ticket "gọi nhắc lại"** | Ticket reopen rate | -20% | -40% | -60% |
| **Tăng hài lòng toàn công ty** | CSAT điểm trung bình | +0.5 | +1.0 | +1.5 |
| **SLA tuân thủ** | % ticket xử lý đúng SLA | 75% | 85% | 90%+ |

---

## MVP Scope

### MVP Definition (Phase 1)

**Mục tiêu MVP:** Chứng minh kiến trúc Orchestrator hoạt động — đặc biệt **Context Preservation** (KH chuyển kênh giữa chừng không mất ngữ cảnh). Nếu chỉ có 1 kênh, đây chỉ là backend Call Center truyền thống — không chứng minh được gì.

**MVP phải có ít nhất 2 kênh** để demo K1 (Context Preservation).

### MVP Core Features

| # | Feature | Chi tiết | Ảnh hưởng |
|---|---------|----------|-----------|
| 1 | **Auth Layer (better-auth)** | Đăng nhập nhân viên (tổng đài viên, CSKH quầy) + Xác thực KH qua SĐT/Zalo ID. RBAC cơ bản: Khách hàng / Nhân viên / Admin. | ✅ A-Z (DB riêng) |
| 2 | **Hotline Adapter** | Giả lập nhận request từ SĐT gọi đến. Tự động lookup KH → trả hồ sơ cho tổng đài viên. | Input adapter |
| 3 | **Zalo Adapter** | Nhận text message cơ bản từ KH qua Zalo OA. Xác thực qua Zalo ID liên kết SĐT. | Input adapter |
| 4 | **Orchestrator Core** | Request chuẩn hóa, routing đến 5 mock endpoints, ticket lifecycle cơ bản (create → read → update status). | Core engine |
| 5 | **Context Preservation (K1)** | Redis session store. KH chat Zalo lúc sáng → gọi Hotline chiều → tổng đài viên thấy lịch sử chat Zalo. | **Key differentiator** |
| 6 | **Mocking System** | 5 JSON files giả lập backend API. Hot reload config (mock → live). | Infrastructure |
| 7 | **Circuit Breaker cơ bản (K5)** | opossum: phát hiện API down → fallback cached data. KH luôn nhận response. | Resilience layer |

### 5 Mock Endpoints (Sufficient for MVP)

| Endpoint | Method | Purpose | Mock file |
|----------|--------|---------|-----------|
| `GET /customers/{phone}` | Read | Lấy định danh + ngữ cảnh KH | `mocks/customer360.json` |
| `POST /tickets` | Write | Tạo ticket mới | `mocks/create-ticket.json` |
| `GET /tickets/{id}` | Read | Tra cứu trạng thái ticket | `mocks/ticket-status.json` |
| `GET /gis/incidents?area={code}` | Read | Kiểm tra sự cố khu vực (chứng minh tích hợp phân tán) | `mocks/gis-incidents.json` |
| `POST /notifications` | Write | Gửi thông báo qua kênh (đóng vòng lặp) | `mocks/notifications.json` |

### MVP Architecture

```
┌──────────────────────────────────────────────────────┐
│                    MVP SCOPE                         │
│                                                      │
│  Zalo OA ───► Zalo Adapter ───┐                      │
│  Hotline ────► Hotline Adapter ┤                      │
│                                ▼                      │
│                     Auth Layer (better-auth)          │
│                     • User/Session DB                 │
│                     • RBAC: KH / NV / Admin           │
│                                │                      │
│                                ▼                      │
│                     Orchestrator Core                 │
│                     • Request chuẩn hóa               │
│                     • Routing đến mock endpoints      │
│                     • Ticket lifecycle                │
│                     • Context Preservation (Redis)    │
│                     • Circuit Breaker (opossum)       │
│                                │                      │
│              ┌─────────────────┼─────────────────┐    │
│              ▼                 ▼                 ▼    │
│        customer360.json   tickets.json   gis.json     │
│        (mock)             (mock)         (mock)       │
└──────────────────────────────────────────────────────┘
```

### Out of Scope for MVP (Gạch bỏ để bảo vệ deadline)

| ❌ Tính năng | Lý do loại bỏ | Khi nào làm? |
|-------------|---------------|-------------|
| **Đa Xí nghiệp routing (K7)** | Phức tạp setup dữ liệu địa bàn. MVP hardcode 1 queue trung tâm. | Phase 2 |
| **SLA Engine động** | Logic rule-engine phức tạp. MVP set cứng SLA 24h cho mọi ticket. | Phase 2 |
| **CSAT & Dashboards** | Giao diện báo cáo lãnh đạo tốn effort UI lớn. MVP tập trung data flow tổng đài viên. | Phase 3 |
| **DLQ / Queue retry (K5 cấp 2)** | Dead Letter Queue + auto-retry + notify sau 30 phút tốn nhiều resource. MVP chỉ trả HTTP 503 khi API down + cache rỗng. | Phase 2 |
| **Shadow Mode (K6)** | Chỉ cần khi migrate API liên quan Tiền. MVP toàn mock → chưa cần. | Khi backend ready |
| **Counter / Web / Mobile Adapters** | Thêm kênh = thêm adapter. MVP chỉ cần 2 kênh (Hotline + Zalo) để chứng minh concept. | Phase 2+ |

### MVP Success Criteria

**MVP thành công khi:**

| # | Criteria | Cách đo |
|---|----------|---------|
| 1 | **2 kênh hoạt động** — Hotline + Zalo đều gửi/nhận request | Demo end-to-end |
| 2 | **Context Preservation hoạt động** — KH chat Zalo → gọi Hotline → tổng đài viên thấy history | Test case K1 |
| 3 | **Auth phân quyền đúng** — KH chỉ xem data mình, NV xem theo quyền | RBAC test matrix |
| 4 | **5 mock endpoints trả đúng schema** — Request/response match OpenAPI spec | Automated test |
| 5 | **Circuit Breaker hoạt động** — Tắt mock server → fallback cache → KH vẫn nhận response | Kill mock server test |
| 6 | **Zero-Downtime Config Switch** — Thời gian downtime khi chuyển đổi endpoint từ mock → live (hoặc ngược lại) phải = **0ms**. Orchestrator nhận endpoint mới mà không cần restart process. | Config change + latency probe test |

### Future Vision (Post-MVP Roadmap)

```
Phase 1 (MVP)              Phase 2                      Phase 3
─────────────              ─────────                    ─────────
Auth + better-auth         Đa Xí nghiệp routing (K7)    CSAT & Dashboard
Hotline Adapter            SLA Engine động              Shadow Mode (K6)
Zalo Adapter               DLQ + Queue retry (K5 full)  Counter Adapter
Context Preservation (K1)  Web Adapter                  Mobile Adapter
5 Mock Endpoints           Mock → Live migration        Notification đa kênh
Circuit Breaker cơ bản     Graceful Degradation đầy đủ  AI Agent Assist
Redis session store        PostgreSQL cho routing config Knowledge Base
```

**Evolution path:** MVP chứng minh kiến trúc → Phase 2 thêm resilience + routing → Phase 3 hoàn thiện trải nghiệm đa kênh.
