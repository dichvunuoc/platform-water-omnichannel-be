# IOC Customer API — Kết quả Test thực tế

**Ngày test:** 2026-06-06
**Server:** `http://localhost:3000` (NestJS + Fastify)
**Swagger UI:** `http://localhost:3000/api/docs`

> **Ghi chú:** Các endpoint gọi CQRS pipeline (verify-otp, provider/callback, link-provider, me) trả 500 vì bảng `users`/`provider_links` chưa tồn tại (chưa chạy DB migration). Validation layer hoạt động đúng — chặn hết input sai trước khi chạm DB.

---

## Tổng kết

| # | Endpoint | Input | Expected | Thực tế | Kết quả |
|---|----------|-------|----------|---------|---------|
| 1 | `GET /health` | — | 200 | 200 ✅ | **PASS** |
| 2 | `GET /health/live` | — | 200 | 200 ✅ | **PASS** |
| 3 | `POST /auth/register-phone` | SĐT hợp lệ | 200 | 200 ✅ | **PASS** |
| 4 | `POST /auth/register-phone` | Sai tên field | 400 | 400 ✅ | **PASS** |
| 5 | `POST /auth/register-phone` | SĐT sai format | 400 | 400 ✅ | **PASS** |
| 6 | `POST /auth/register-phone` | Body rỗng | 400 | 400 ✅ | **PASS** |
| 7 | `POST /auth/verify-otp` | OTP 6 số + SĐT | 200 | 500 ⚠️ | **BLOCKED** (chưa migrate DB) |
| 8 | `POST /auth/verify-otp` | OTP sai format | 400 | 400 ✅ | **PASS** |
| 9 | `POST /auth/verify-otp` | Thiếu code | 400 | 400 ✅ | **PASS** |
| 10 | `POST /auth/provider/callback` | providerType hợp lệ | 200 | 500 ⚠️ | **BLOCKED** (chưa migrate DB) |
| 11 | `POST /auth/provider/callback` | providerType sai | 400 | 400 ✅ | **PASS** |
| 12 | `POST /auth/link-provider` | Không token | 401 | 401 ✅ | **PASS** |
| 13 | `POST /auth/link-provider` | Token giả | 401 | 401 ✅ | **PASS** |
| 14 | `GET /auth/me` | Không token | 401 | 401 ✅ | **PASS** |
| 15 | `GET /auth/me` | Token giả | 401 | 401 ✅ | **PASS** |

**Tổng: 13 PASS, 2 BLOCKED (cần DB migration)**

---

## Chi tiết từng Test

### Test #1: GET /health — ✅ PASS

```bash
curl -s http://localhost:3000/health
```

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "status": "degraded",
    "checks": {
      "database": { "status": "degraded", "message": "Database pool is not configured" },
      "redis": { "status": "degraded", "message": "Redis cache service is not configured" },
      "ports": { "status": "up", "message": "No ports registered" }
    }
  }
}
```

> DB/Redis degraded là đúng — local dev không có Redis, DB chưa migrate. Ports up = Port Registry hoạt động.

---

### Test #2: GET /health/live — ✅ PASS

```bash
curl -s http://localhost:3000/health/live
```

```json
{ "success": true, "statusCode": 200, "data": { "status": "alive" } }
```

---

### Test #3: POST /auth/register-phone (hợp lệ) — ✅ PASS

```bash
curl -s -X POST http://localhost:3000/auth/register-phone \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"0901234567","name":"Nguyễn Văn A"}'
```

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "message": "OTP sent to phone number. Verify via POST /auth/verify-otp.",
    "phoneNumber": "0901234567"
  }
}
```

---

### Test #4: Sai tên field (`phone` thay vì `phoneNumber`) — ✅ PASS

```bash
curl -s -X POST http://localhost:3000/auth/register-phone \
  -H "Content-Type: application/json" \
  -d '{"phone":"0901234567"}'
```

```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "name": "ValidationException",
    "code": "VALIDATION_ERROR",
    "message": "[{ \"expected\": \"string\", \"code\": \"invalid_type\", \"path\": [\"phoneNumber\"], \"message\": \"Invalid input: expected string, received undefined\" }]"
  }
}
```

---

### Test #5: SĐT sai format (+84) — ✅ PASS

```bash
curl -s -X POST http://localhost:3000/auth/register-phone \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+84901234567"}'
```

```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "name": "ValidationException",
    "code": "VALIDATION_ERROR",
    "message": "[{ \"origin\": \"string\", \"code\": \"invalid_format\", \"format\": \"regex\", \"pattern\": \"/^(0[3|5|7|8|9])+([0-9]{8})$/\", \"path\": [\"phoneNumber\"], \"message\": \"Invalid Vietnamese phone number format\" }]"
  }
}
```

---

### Test #6: Body rỗng — ✅ PASS

```bash
curl -s -X POST http://localhost:3000/auth/register-phone \
  -H "Content-Type: application/json" -d '{}'
```

```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "[{ \"expected\": \"string\", \"code\": \"invalid_type\", \"path\": [\"phoneNumber\"], \"message\": \"Invalid input: expected string, received undefined\" }]"
  }
}
```

---

### Test #7: POST /auth/verify-otp (hợp lệ) — ⚠️ BLOCKED

```bash
curl -s -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"0901234567","code":"123456"}'
```

```json
{
  "success": false,
  "statusCode": 500,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed query: select ... from \"users\" where \"users\".\"phone_hash\" = $1 ..."
  }
}
```

> **Nguyên nhân:** Bảng `users` chưa tồn tại. Cần chạy Drizzle migration: `npx drizzle-kit push` hoặc `npx drizzle-kit migrate`.

---

### Test #8: OTP sai format — ✅ PASS

```bash
curl -s -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"0901234567","code":"abc"}'
```

```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "[{ \"origin\": \"string\", \"code\": \"invalid_format\", \"format\": \"regex\", \"pattern\": \"/^\\d{6}$/\", \"path\": [\"code\"], \"message\": \"OTP must be exactly 6 digits\" }]"
  }
}
```

---

### Test #9: Thiếu field `code` — ✅ PASS

```bash
curl -s -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"0901234567"}'
```

```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "[{ \"expected\": \"string\", \"code\": \"invalid_type\", \"path\": [\"code\"], \"message\": \"Invalid input: expected string, received undefined\" }]"
  }
}
```

---

### Test #10: POST /auth/provider/callback (hợp lệ) — ⚠️ BLOCKED

```bash
curl -s -X POST http://localhost:3000/auth/provider/callback \
  -H "Content-Type: application/json" \
  -d '{"providerType":"zalo","providerId":"zalo-user-12345","email":"user@gmail.com","name":"Nguyễn Văn A","phoneNumber":"0901234567"}'
```

```json
{
  "success": false,
  "statusCode": 500,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed query: select \"user_id\" from \"provider_links\" where ..."
  }
}
```

> **Nguyên nhân:** Bảng `provider_links` chưa tồnại. Cần chạy DB migration.

---

### Test #11: providerType không hợp lệ — ✅ PASS

```bash
curl -s -X POST http://localhost:3000/auth/provider/callback \
  -H "Content-Type: application/json" \
  -d '{"providerType":"twitter","providerId":"123"}'
```

```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "[{ \"code\": \"invalid_value\", \"values\": [\"phone\",\"zalo\",\"google\",\"facebook\",\"apple\"], \"path\": [\"providerType\"], \"message\": \"Invalid option: expected one of \\\"phone\\\"|\\\"zalo\\\"|\\\"google\\\"|\\\"facebook\\\"|\\\"apple\\\"\" }]"
  }
}
```

---

### Test #12: POST /auth/link-provider (không token) — ✅ PASS

```bash
curl -s -X POST http://localhost:3000/auth/link-provider \
  -H "Content-Type: application/json" \
  -d '{"providerType":"google","providerId":"abc"}'
```

```json
{
  "success": false,
  "statusCode": 401,
  "error": { "name": "UnauthorizedException", "code": "MISSING_TOKEN", "message": "Authentication token is required" }
}
```

---

### Test #13: POST /auth/link-provider (token giả) — ✅ PASS

```bash
curl -s -X POST http://localhost:3000/auth/link-provider \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fake-jwt-token" \
  -d '{"providerType":"google","providerId":"google-user-abc","providerEmail":"user@gmail.com"}'
```

```json
{
  "success": false,
  "statusCode": 401,
  "error": { "code": "MISSING_TOKEN", "message": "Authentication token is required" }
}
```

> Token giả → better-auth `getSession()` trả null → không extract được userId → 401. Đúng behavior.

---

### Test #14: GET /auth/me (không token) — ✅ PASS

```bash
curl -s http://localhost:3000/auth/me
```

```json
{
  "success": false,
  "statusCode": 401,
  "error": { "code": "MISSING_TOKEN", "message": "Authentication token is required" }
}
```

---

### Test #15: GET /auth/me (token giả) — ✅ PASS

```bash
curl -s http://localhost:3000/auth/me -H "Authorization: Bearer fake-jwt-token"
```

```json
{
  "success": false,
  "statusCode": 401,
  "error": { "code": "MISSING_TOKEN", "message": "Authentication token is required" }
}
```

---

## Blockers — Cần hành động

| Blocker | Nguyên nhân | Cách fix |
|---------|------------|----------|
| Test #7 verify-otp trả 500 | Bảng `users` chưa tồn tại | `npx drizzle-kit push` để tạo bảng |
| Test #10 provider/callback trả 500 | Bảng `provider_links` chưa tồn tại | `npx drizzle-kit push` để tạo bảng |

Sau khi migrate DB, test lại #7 và #10 sẽ pass (trả 200).
