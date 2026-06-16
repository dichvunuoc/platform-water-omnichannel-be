# Hướng dẫn Test — IOC Customer Module CSKH

> Tài liệu chính thức về cách test dự án: unit tests, production smoke test, và kịch bản test thủ công.

---

## Mục lục

1. [Tổng quan các loại test](#1-tổng-quan-các-loại-test)
2. [Unit Tests (1018 tests)](#2-unit-tests-1018-tests)
3. [Production Smoke Test (Docker)](#3-production-smoke-test-docker)
4. [Test thủ công qua Swagger UI](#4-test-thủ-công-qua-swagger-ui)
5. [Authentication test flow](#5-authentication-test-flow)
6. [Webhook testing](#6-webhook-testing)
7. [Troubleshooting test](#7-troubleshooting-test)

---

## 1. Tổng quan các loại test

| Loại | Số lượng | Chạy khi nào | Tool |
|---|---|---|---|
| **Unit Tests** | 1018 (106 suites) | Mỗi commit / PR | Jest |
| **Production Smoke Test** | 41 endpoints | Verify Docker build | `scripts/smoke-test.sh` |
| **Manual API Test** | 54 operations | Dev / debug | Swagger UI + curl |

### Sơ đồ khi nào dùng cái nào

```
┌─────────────────────────────────────────────────────────┐
│ Mỗi lần đổi code:                                        │
│   npx jest          ← unit tests (nhanh, cô lập)         │
├─────────────────────────────────────────────────────────┤
│ Mỗi lần build Docker image:                              │
│   ./scripts/smoke-test.sh  ← test toàn bộ qua container │
├─────────────────────────────────────────────────────────┤
│ Khi dev/debug 1 endpoint cụ thể:                         │
│   Swagger UI (http://localhost:3000/api/docs)           │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Unit Tests (1018 tests)

### Yêu cầu

```bash
npm install   # hoặc: bun install
```

### Chạy

```bash
# Toàn bộ 1018 tests
npx jest

# Kết quả kỳ vọng:
# Test Suites: 106 passed, 106 total
# Tests:       1018 passed, 1018 total
# Time:        ~41s
```

### Các option hữu ích

```bash
# Chỉ 1 module
npx jest src/modules/payment

# Chỉ 1 file
npx jest src/modules/auth/domain/entities/user.entity.spec.ts

# Watch mode (tự chạy lại khi đổi code)
npx jest --watch

# Coverage report
npx jest --coverage
# → mở coverage/lcov-report/index.html
```

### Test coverage theo module

| Module | Spec files | Chất lượng |
|---|---|---|
| Auth | 8 | ⭐⭐⭐⭐⭐ Domain + guard + PII |
| Customer | 6 | ⭐⭐⭐⭐ Cache invalidation |
| Contract | 6 | ⭐⭐⭐ Pass-through |
| Meter | 9 | ⭐⭐⭐⭐⭐ BFF-computed logic |
| Billing | 10 | ⭐⭐⭐ Pass-through |
| Payment | 12 | ⭐⭐⭐⭐⭐ Orchestration + idempotency |
| Ticket | 14 | ⭐⭐⭐⭐ CSAT + webhook |
| Communication | 12 | ⭐⭐⭐⭐⭐ Fallback chain + rate limiter |
| Session | 7 | ⭐⭐⭐⭐ Lua atomic |

📖 Chi tiết: [test-coverage-db-schema-analysis.md](test-coverage-db-schema-analysis.md)

---

## 3. Production Smoke Test (Docker)

### Kịch bản tự động: `scripts/smoke-test.sh`

Test toàn bộ 9 modules + webhooks + Swagger trong 1 lệnh.

#### Yêu cầu

```bash
# Docker stack đang chạy
docker-compose up -d

# Verify healthy
curl http://localhost:3000/health
```

#### Chạy

```bash
# Chạy đầy đủ (auto-authenticate + test tất cả)
./scripts/smoke-test.sh

# Output:
# ━━━ 0. HEALTH CHECK ━━━
#   ✅ App healthy | Ports: 13 CB CLOSED
# ━━━ 1. AUTHENTICATION ━━━
#   ✅ Send OTP (0987654321)                              HTTP 200
#   ✅ Verify OTP → session cookie                        HTTP 200
#   ✅ GET /auth/me (session valid)                       HTTP 200
# ━━━ 2. CUSTOMER ━━━
#   ✅ Profile (GET /customers/profile)                   HTTP 200
#   ...
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   ✅ TẤT CẢ PASS: 41/41 tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### Options

```bash
./scripts/smoke-test.sh --json      # output JSON (cho CI/CD)
./scripts/smoke-test.sh --no-auth   # bỏ qua auth, dùng cookie có sẵn
./scripts/smoke-test.sh --help      # xem hướng dẫn
```

#### Môi trường (env vars)

```bash
BASE_URL=http://localhost:3000          # URL app
PG_CONTAINER=nestjs-ddd-postgres        # container postgres
INTER_SERVICE_API_KEY=test-inter-service-key-2026  # webhook key
COOKIE_FILE=/tmp/cskh-cookie.txt        # nơi lưu cookie
```

#### Exit code

- `0` = tất cả pass
- `1` = có fail (dùng cho CI/CD pipeline)

### Kịch bản này test gì?

| # | Nhóm | Số test | Nội dung |
|---|---|---|---|
| 0 | Health | 1 | Health endpoint + circuit breakers |
| 1 | Auth | 3 | Phone OTP → verify → session |
| 2 | Customer | 3 | Profile, timeline, related accounts |
| 3 | Contract | 4 | List, detail, versions, PDF |
| 4 | Meter | 5 | List, consumption, comparison, calibration, history |
| 5 | Billing | 5 | Invoices, tariff, fees |
| 6 | Payment | 5 | Create, history, debt, auto-debit |
| 7 | Ticket + KB | 9 | Create, status, feedback, KB search/rate |
| 8 | Communication | 6 | Alerts, notifications, preferences |
| 9 | Session | 2 | My session, events |
| 10 | Webhooks | 4 | Payment IPN + ticket (valid/bad key) |
| 11 | Swagger | 3 | HTML, bundle.js, OpenAPI JSON |
| **Total** | | **~50** | |

---

## 4. Test thủ công qua Swagger UI

### Mở Swagger

```
http://localhost:3000/api/docs
```

### Các bước test 1 endpoint

1. **Authenticate trước** (xem [mục 5](#5-authentication-test-flow))
2. Mở Swagger UI → click nút **Authorize** 🔒 (góc phải)
3. Không cần paste JWT — session cookie đã đủ (Swagger dùng cookie)
4. Chọn endpoint → click **Try it out**
5. Điền params/body → **Execute**

> ⚠️ **Lưu ý:** Swagger UI gửi cookie tự động nếu đã đăng nhập cùng domain. Nếu test qua curl, phải dùng `-b cookies.txt`.

### Lấy OpenAPI spec (JSON/YAML)

```bash
# JSON
curl http://localhost:3000/api/docs-json > openapi.json

# Import vào Postman/Insomnia
```

---

## 5. Authentication test flow

Hệ thống dùng **better-auth** với phone + OTP.

### Bước 1: Gửi OTP

```bash
curl -X POST http://localhost:3000/api/auth/phone-number/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"0987654321"}'
# → { "message": "code sent" }
```

### Bước 2: Lấy mã OTP

> Trong production thật, KH nhận OTP qua SMS. Khi test, đọc từ DB:

```bash
docker exec nestjs-ddd-postgres psql -U postgres -d nestjs_project -tAc \
  "SELECT split_part(value, ':', 1) FROM verification \
   WHERE identifier='0987654321' ORDER BY created_at DESC LIMIT 1;"
# → 403353  (ví dụ)
```

### Bước 3: Verify OTP → nhận cookie

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/auth/phone-number/verify \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"0987654321","code":"403353"}'
# → { "status": true, "token": "...", "user": {...} }
# Cookie lưu vào cookies.txt (HttpOnly, 7-day TTL)
```

### Bước 4: Gọi API đã xác thực

```bash
curl -b cookies.txt http://localhost:3000/customers/profile
curl -b cookies.txt http://localhost:3000/billing/invoices
```

### Validation test (auth)

```bash
# SĐT sai format → 400
curl -X POST http://localhost:3000/api/auth/phone-number/send-otp \
  -H "Content-Type: application/json" -d '{"phoneNumber":"123"}'
# → 400 "Invalid Vietnamese phone number format"

# Endpoint bảo vệ không cookie → 401
curl http://localhost:3000/customers/profile
# → 401 "Authentication token is required"
```

---

## 6. Webhook testing

Webhooks dùng `InterServiceApiKeyGuard` (KHÔNG dùng session cookie).

### Test với key đúng

```bash
# Payment IPN
curl -X POST http://localhost:3000/webhooks/payment/ipn \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-inter-service-key-2026" \
  -d '{
    "paymentId": "PAY-TEST",
    "invoiceId": "INV-2026-001",
    "customerId": "x",
    "amount": 100,
    "status": "success",
    "timestamp": "2026-06-13T10:00:00Z"
  }'
# → { "received": true }
```

```bash
# Ticket status change
curl -X POST http://localhost:3000/webhooks/ticket/status \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-inter-service-key-2026" \
  -d '{
    "ticketId": "TK1",
    "trackingId": "TK-2026-002",
    "customerId": "x",
    "oldStatus": "submitted",
    "newStatus": "in_progress",
    "updatedAt": "2026-06-13T10:00:00Z"
  }'
# → { "received": true }
```

### Security test (phải reject)

```bash
# Không có key → 403
curl -X POST http://localhost:3000/webhooks/payment/ipn \
  -H "Content-Type: application/json" -d '{"paymentId":"X"}'
# → 403 "Service configuration error"

# Key sai → 403
curl -X POST http://localhost:3000/webhooks/payment/ipn \
  -H "Content-Type: application/json" \
  -H "x-api-key: WRONG" -d '{"paymentId":"X"}'
# → 403
```

> ⚠️ Key được set trong `.env.docker.compose`: `INTER_SERVICE_API_KEY=test-inter-service-key-2026`

---

## 7. Troubleshooting test

| Vấn đề | Nguyên nhân | Fix |
|---|---|---|
| `smoke-test.sh: Permission denied` | Script chưa chmod | `chmod +x scripts/smoke-test.sh` |
| App not healthy | Stack chưa chạy | `docker-compose up -d` rồi chờ |
| Auth fail: không đọc được OTP | Container postgres sai tên | Check `docker ps`, set `PG_CONTAINER` |
| Endpoints 401 | Cookie hết hạn hoặc sai file | Xóa cookie, chạy lại auth flow |
| Endpoints 500 `PortFallbackException` | Docker image thiếu mocks | Rebuild: `docker build -t nestjs-bun-binary . && docker-compose up -d --force-recreate app` |
| Webhook 403 | `INTER_SERVICE_API_KEY` chưa set | Thêm vào `.env.docker.compose` + restart |
| Swagger trang trắng | Assets 404 (Bun binary) | Đã fix — rebuild image |
| `/api/auth/sign-in/phone` 404 | Sai route | Route đúng: `/api/auth/phone-number/send-otp` |
| `RANDOM` trùng SĐT | Test lại quá nhanh | Đổi số hoặc đợi 5 phút (OTP expire) |

### Test data cố định (mock)

Kịch bản dùng các ID có sẵn trong mock data:

| Loại | ID | Ghi chú |
|---|---|---|
| Contract | `CTR-2024-0001` | Hợp đồng mẫu |
| Meter | `MT-001` | Đồng hồ mẫu (calibration: expiring_soon) |
| Invoice | `INV-2026-001` | Hóa đơn unpaid |
| Ticket | `TK-2026-001` (closed), `TK-2026-002` (open) | Để test CSAT |
| Alert | `ALERT-2026-001` | Active alert |
| KB article | `art-1` | Bài viết mẫu |

---

## CI/CD integration

```yaml
# .github/workflows/test.yml (ví dụ)
- name: Unit tests
  run: npx jest

- name: Build & start Docker
  run: docker-compose up -d --build

- name: Wait for healthy
  run: until curl -sf http://localhost:3000/health; do sleep 2; done

- name: Smoke test
  run: ./scripts/smoke-test.sh --json > smoke-results.json

- name: Check results
  run: jq -e '.fail == 0' smoke-results.json
```

---

_Cập nhật: 2026-06-15_
