# IOC Customer — Swagger Test Plan

> **Base URL:** `http://localhost:3000`
> **Swagger UI:** `http://localhost:3000/api/docs`
> **Ngày:** 2026-06-10
> **Mục tiêu:** Verify tất cả API endpoints hoạt động sau khi fix outbox + auth DB migration
> **Trạng thái:** ✅ **ĐÃ XÁC MINH** — 34/34 endpoints khớp với codebase (2026-06-10)

---

## 0. Smoke Test — App Startup

| # | Test | Method | URL | Expected | Ghi chú |
|---|------|--------|-----|----------|---------|
| 0.1 | App khởi động không crash | — | — | Log: `Database migrations completed successfully` | Verify auto-migration chạy |
| 0.2 | Liveness probe | GET | `/health/live` | `200` → `{ "status": "alive" }` | |
| 0.3 | Readiness probe | GET | `/health/ready` | `200` → `{ "status": "UP" }` | |
| 0.4 | Full health check | GET | `/health` | `200` → status, version, uptime | |

---

## 1. Auth — Đăng ký / Đăng nhập (Public)

### 1.1 Phone Registration — Gửi OTP

```
POST /auth/register-phone
Content-Type: application/json
```

**Body (hợp lệ):**
```json
{
  "phoneNumber": "0901234567",
  "name": "Nguyen Van A"
}
```
→ **200** — `{ "message": "OTP sent to phone number...", "phoneNumber": "0901234567" }`

**Body (số điện thoại sai format):**
```json
{
  "phoneNumber": "12345"
}
```
→ **400** — Validation error

**Body (thiếu phoneNumber):**
```json
{
  "name": "Test"
}
```
→ **400** — Validation error

### 1.2 Verify OTP

```
POST /auth/verify-otp
```

**Body:**
```json
{
  "phoneNumber": "0901234567",
  "code": "123456"
}
```
→ **200** — `{ "message": "OTP validated..." }`

**Body (OTP sai format):**
```json
{
  "phoneNumber": "0901234567",
  "code": "abc"
}
```
→ **400** — Validation error

### 1.3 OAuth Provider Callback

```
POST /auth/provider/callback
```

**Body (Zalo):**
```json
{
  "providerType": "zalo",
  "providerId": "zalo_12345",
  "name": "Zalo User"
}
```
→ **200** — `{ "message": "Provider zalo validated..." }`

**Body (Google):**
```json
{
  "providerType": "google",
  "providerId": "google_67890",
  "email": "test@gmail.com",
  "name": "Google User"
}
```
→ **200**

**Body (provider không hợp lệ):**
```json
{
  "providerType": "twitter",
  "providerId": "123"
}
```
→ **400** — Validation error

---

## 2. Auth — Authenticated Endpoints

> ⚠️ Các endpoint sau cần session/cookie auth. Vì better-auth dùng cookie-based session,
> bạn cần đăng nhập qua better-auth endpoint `/api/auth/verify-phone` trước,
> sau đó Swagger sẽ tự gửi cookie.

### 2.1 Get Current User

```
GET /auth/me
Authorization: Bearer <session-token>
```
→ **200** — `{ "userId": "...", "message": "Session verified..." }`
→ **401** nếu chưa đăng nhập

### 2.2 Link Provider

```
POST /auth/link-provider
Authorization: Bearer <session-token>
```

**Body:**
```json
{
  "providerType": "zalo",
  "providerId": "zalo_12345",
  "providerEmail": "test@zalo.me"
}
```
→ **200** — `{ "userId": "...", "message": "Provider link request validated..." }`
→ **401** nếu chưa đăng nhập

---

## 3. Customer — Hồ sơ khách hàng

### 3.1 Get Profile

```
GET /customers/profile
```
→ **200** — Customer 360° profile

### 3.2 Get Timeline

```
GET /customers/timeline
```
→ **200** — Interaction timeline

### 3.3 Get Related Accounts

```
GET /customers/related-accounts
```
→ **200** — KCN relationship tree

### 3.4 Update Profile

```
PUT /customers/profile
```

**Body:**
```json
{
  "name": "Nguyen Van B",
  "email": "newemail@example.com",
  "phoneNumber": "0912345678"
}
```
→ **200** — Updated profile

**Body (email sai format):**
```json
{
  "email": "not-an-email"
}
```
→ **400** — Validation error

---

## 4. Contract — Hợp đồng

### 4.1 Get Contracts List

```
GET /contracts
```
→ **200** — Danh sách hợp đồng

```
GET /contracts?status=active
```
→ **200** — Filter by status

### 4.2 Get Contract Detail

```
GET /contracts/{contractId}
```
→ **200** — Chi tiết hợp đồng
→ **400** nếu contractId sai format

### 4.3 Get Contract Versions

```
GET /contracts/{contractId}/versions
```
→ **200** — Version history

### 4.4 Get Contract PDF

```
GET /contracts/{contractId}/pdf
```
→ **200** — PDF download URL

---

## 5. Meter — Công tơ nước

### 5.1 Get Meter List

```
GET /meters
```
→ **200** — Array of meters (1 Customer : N Meters)

### 5.2 Consumption History

```
GET /meters/consumption
```
→ **200** — 12-month consumption history

### 5.3 Consumption Comparison

```
GET /meters/consumption/comparison?current=2026-05&previous=2026-04
```
→ **200** — Comparison data

**Query sai format:**
```
GET /meters/consumption/comparison?current=invalid&previous=invalid
```
→ **400** — "Invalid period parameters"

### 5.4 Reading Detail

```
GET /meters/consumption/2026-05
```
→ **200** — Reading detail + evidence photos

### 5.5 Calibration Status

```
GET /meters/{meterId}/calibration
```
→ **200** — Calibration status + isWarning flag

### 5.6 Meter History

```
GET /meters/{meterId}/history
```
→ **200** — Replacement/repair history

---

## 6. Billing — Hóa đơn & Tariff

### 6.1 Invoice List (phân trang)

```
GET /billing/invoices
```
→ **200** — Paginated invoice list

```
GET /billing/invoices?month=2026-05&status=unpaid&page=1&limit=10
```
→ **200** — Filtered invoices

### 6.2 Invoice Detail

```
GET /billing/invoices/{invoiceId}
```
→ **200** — Invoice detail + line items + CQT code

### 6.3 Invoice PDF

```
GET /billing/invoices/{invoiceId}/pdf
```
→ **200** — E-invoice PDF URL

### 6.4 Tariff Plan

```
GET /billing/tariff/{contractId}
```
→ **200** — Tiered pricing plan

### 6.5 Tariff Breakdown

```
GET /billing/tariff/{contractId}/breakdown?invoiceId={invoiceId}
```
→ **200** — Invoice-specific tier breakdown

### 6.6 Applicable Fees

```
GET /billing/tariff/{contractId}/fees
```
→ **200** — Environmental, drainage, VAT, surcharges

---

## 7. Payment — Thanh toán

### 7.1 Create Payment

```
POST /payments
```

**Body:**
```json
{
  "invoiceId": "INV-2026-001",
  "method": "qr_code"
}
```
→ **200** — QR code / payment link

**Body (method không hợp lệ):**
```json
{
  "invoiceId": "INV-2026-001",
  "method": "cash"
}
```
→ **400** — Validation error

### 7.2 Payment History

```
GET /payments/history
```
→ **200** — Paginated history

```
GET /payments/history?page=1&limit=10&status=completed
```
→ **200** — Filtered history

### 7.3 Batch Payment

```
POST /payments/batch
```

**Body:**
```json
{
  "invoiceIds": ["INV-001", "INV-002", "INV-003"],
  "method": "bank_transfer"
}
```
→ **200** — Single QR / payment link

### 7.4 Auto Debit Setup

```
POST /payments/auto-debit
```

**Body:**
```json
{
  "bankAccount": "1234567890"
}
```
→ **200** — Auto debit registered

### 7.5 Outstanding Debt

```
GET /payments/debt
```
→ **200** — Debt with aging buckets

### 7.6 Debt History

```
GET /payments/debt/history
```
→ **200** — Chronological debt history

---

## 8. Tickets — Báo sự cố

### 8.1 Create Ticket

```
POST /tickets
```

**Body:**
```json
{
  "type": "water_outage",
  "description": "Không có nước từ sáng nay",
  "imageUrls": ["https://example.com/photo1.jpg"]
}
```
→ **200** — `{ "trackingId": "TK-2026-001", "status": "submitted", "createdAt": "..." }`

**Body (type không hợp lệ):**
```json
{
  "type": "invalid_type",
  "description": "Test"
}
```
→ **400** — Validation error

**Body (description quá dài):**
```json
{
  "type": "leak",
  "description": "...2001+ chars..."
}
```
→ **400** — Validation error

### 8.2 Get Upload URL

```
POST /tickets/upload-url
```

**Body:**
```json
{
  "fileName": "leak-photo.jpg",
  "fileType": "image/jpeg"
}
```
→ **200** — `{ "uploadUrl": "https://...", "fileKey": "...", "expiresAt": "..." }`

**Body (file type không hỗ trợ):**
```json
{
  "fileName": "doc.pdf",
  "fileType": "application/pdf"
}
```
→ **400** — Validation error

---

## 9. Webhooks — Payment IPN (Internal)

```
POST /webhooks/payment/ipn
x-api-key: <inter-service-api-key>
```

**Body:**
```json
{
  "paymentId": "PAY-001",
  "status": "completed",
  "transactionRef": "TXN-12345"
}
```
→ **200** — `{ "received": true }`

> ⚠️ Cần header `x-api-key` hợp lệ, nếu không sẽ bị guard chặn.

---

## 10. Edge Cases & Negative Tests

| # | Test | Expected |
|---|------|----------|
| 10.1 | GET endpoint không tồn tại (`/api/nonexistent`) | **404** |
| 10.2 | POST với body rỗng đến endpoint cần body | **400** |
| 10.3 | Truy cập authenticated endpoint không có session | **401** |
| 10.4 | Contract/Meter/Invoice ID với ký tự đặc biệt | **400** |
| 10.5 | SQL injection attempt trong query param | **400** (Zod validate) |
| 10.6 | XSS attempt trong description field | Zod validate hoặc sanitize |

---

## Checklist Nhanh

```
☑ 0.1  App start không crash — migration chạy OK
☑ 0.2  /health/live → 200
☑ 0.3  /health/ready → 200
☑ 1.1  POST /auth/register-phone → 200
☑ 1.2  POST /auth/verify-otp → 200
☑ 1.3  POST /auth/provider/callback → 200
☑ 3.1  GET /customers/profile → 200/401
☑ 4.1  GET /contracts → 200/401
☑ 5.1  GET /meters → 200/401
☑ 6.1  GET /billing/invoices → 200/401
☑ 7.1  POST /payments → 200/401
☑ 7.5  GET /payments/debt → 200/401
☑ 8.1  POST /tickets → 200/401
☑ 10.3 Unauthenticated access → 401
```

> **Lưu ý:** Vì backend adapter hiện đang ở chế độ **mock** (PortHttpClient),
> các endpoint CQRS sẽ trả về mock data. Khi kết nối Backend API thật,
> cần test lại toàn bộ flow end-to-end.
