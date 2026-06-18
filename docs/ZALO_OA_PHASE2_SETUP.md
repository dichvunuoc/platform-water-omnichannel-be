# Zalo OA — Phase 2: Cắm OA thật & demo đa kênh (Cloudflare Tunnel)

> Tài liệu đi kèm branch `feat/zalo-omnichannel-webhook`.
> Phase 1 (code + stub) đã xong và verify: webhook → outbox → subscriber → RecordSessionEvent → hiện trên timeline.
> Phase 2 = đưa OA Zalo **thật** vào + expose backend ra Internet bằng **Cloudflare Tunnel** để Zalo OA gọi webhook được.

---

## 0. Điều kiện đã sẵn sàng (Phase 1)

- Webhook `/webhooks/zalo/callback` có guard HMAC + rawBody, idempotent (SETNX), xử lý async qua Outbox.
- `ZaloOaClient` + `ZaloTokenManager` (refresh) + `ZaloOAuthStateService` (nonce chống tampering).
- Account Linking: khách nhắn lần đầu → OA trả link OAuth (scope `phone_number`) → callback → resolve user → lưu `provider_links`.
- Image distroless **đã bake CA bundle** → outbound HTTPS (refresh token, gửi tin) verify được chứng chỉ.

Mặc định `ZALO_OA_ENABLED=false` (outbound là stub/log). Flip `=true` + cấp credentials là live.

---

## 1. Tạo đường hầm HTTPS-public (Cloudflare Tunnel)

Zalo OA chỉ gọi webhook **HTTPS public**. Dùng Cloudflare Tunnel (free, an toàn, không mở port).

### 1.1. Cài `cloudflared`
- Windows: tải `cloudflared.exe` từ https://github.com/cloudflare/cloudflared/releases (hoặc `winget install Cloudflare.cloudflared`).
- macOS/Linux: `brew install cloudflared` / xem docs Cloudflare.

### 1.2. Mở đường hầm tới backend (:3000)
```bash
cloudflared tunnel --url http://localhost:3000
```
Cloudflare in ra 1 URL dạng:
```
https://<ngẫu-nhiên>.trycloudflare.com
```
→ đây là **public origin** của backend. **Không tắt terminal này** trong lúc demo. (Ghi lại URL — bước 3 dùng.)

> Nâng cao: cấu hình tunnel cố định + domain riêng (`cloudflared tunnel create ...` + DNS CNAME) để URL ổn định qua nhiều lần chạy.

### 1.3. Kiểm tra đường hầm
```bash
curl https://<tunnel>.trycloudflare.com/health
# → {"success":true,...,"data":{"status":"up"}}
```

---

## 2. Đăng ký Zalo Official Account (OA)

1. Vào https://developers.zalo.me → đăng nhập Zalo của bạn.
2. Tạo **Official Account (OA)** (menu: Official Account / Quản lý OA test).
3. Lấy các credentials sau (ghi lại — bước 3 set env):
   - **OA ID**
   - **OA Access Token** + **Refresh Token** (mục API/Token; refresh dùng để gia hạn access token ~15–24h)
   - **App ID** + **App Secret** (dành cho OAuth permission scope `phone_number`)
   - **Webhook Secret Key** (= `ZALOA_SECRET_KEY`, dùng ký HMAC payload gửi về)
4. **Cài đặt Webhook**:
   - URL: `https://<tunnel>.trycloudflare.com/webhooks/zalo/callback`
   - Tick sự kiện: **User send text message** (người dùng gửi tin văn bản).
5. **OAuth redirect URI** (dành cho Account Linking): `https://<tunnel>.trycloudflare.com/api/auth/zalo/callback` — khai báo trong cấu hình OAuth app Zalo + set `ZALO_REDIRECT_URI`.

---

## 3. Set env thật + bật OA

Sửa `.env.docker.compose` (file local, đã gitignore — không commit secret):
```ini
# Zalo OA — LIVE
ZALO_OA_ENABLED=true
ZALOA_SECRET_KEY=<Webhook Secret Key từ bước 2>
ZALO_OA_ID=<OA ID>
ZALO_OA_APP_ID=<App ID>
ZALO_OA_APP_SECRET=<App Secret>
ZALO_OA_REFRESH_TOKEN=<Refresh Token>
ZALO_OA_BASE_URL=https://openapi.zaloapp.com

# OAuth (Account Linking) — redirect về tunnel
ZALO_APP_ID=<App ID>
ZALO_APP_SECRET=<App Secret>
ZALO_REDIRECT_URI=https://<tunnel>.trycloudflare.com/api/auth/zalo/callback

# Cho phép origin của Frontend gọi auth cross-origin (đã có từ Phase trước)
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3001
```

Restart backend để nhận env:
```bash
cd IOC_Customer
docker-compose up -d app
```

---

## 4. Validate HMAC scheme với Zalo thật

Guard hiện verify `X-ZECA-Signature` header (HMAC SHA-256 over raw body). **Zalo thực tế** có thể ký bằng cơ chế hơi khác (ví dụ trường `mac` trong JSON body). Khi OA thật gửi tin đầu tiên:

1. Theo dõi log: `docker logs -f nestjs-ddd-app`.
2. Nếu guard **reject** (403) → Zalo dùng scheme khác. Mở `src/libs/shared/security/zalo-signature.guard.ts`, adapt:
   - Đọc `mac` field trong body (thay vì header `X-ZECA-Signature`), hoặc
   - Điều chỉnh data được hash (raw body trừ field `mac`).
   - **Giữ nguyên**: tính HMAC trên raw body + `timingSafeEqual`. **Không bao giờ bypass** verify.

---

## 5. Kịch bản demo "sống" (magic moment)

1. **Chuẩn bị**: mở Frontend http://localhost:3001 → đăng nhập (SĐT đã có tài khoản trong hệ thống) → vào **Phiên tương tác** (`/sessions`).
2. **Link 1 lần**: dùng Zalo trên điện thoại tìm OA test → gửi 1 tin ("chào"). Backend thấy chưa link → OA **trả link OAuth**. Bấm link → cấp quyền `phone_number` → backend resolve SĐT → lưu `provider_links(zalo, <zalo_user_id>, userId)`. (Sau bước này, Zalo user ↔ tài khoản portal đã map.)
3. **Gửi tin thật**: từ Zalo OA gửi: *"Nhà tôi ở khu A bị mất nước, kiểm tra giúp!"*.
4. **Quan sát**:
   - Backend log: `Recorded Zalo message from <zalo_user_id> → user <userId>`.
   - **Portal refresh** (F5 trang Phiên tương tác) → dòng `zalo_message_received` (channel: Zalo) nhảy lên timeline với đúng nội dung + thời gian. ✅
5. **Test idempotency**: gửi lại đúng tin đó nhiều lần (hoặc ép Zalo retry) → timeline **không nhân bản** (1 event duy nhất).

---

## 6. Troubleshooting

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Zalo không gọi webhook (log không thấy POST) | Webhook URL sai / tunnel tắt / sự kiện chưa tick | Check `curl https://<tunnel>/health`; tick "user send text"; giữ terminal tunnel mở |
| Webhook 403 Forbidden | HMAC scheme lệch (mac field vs header) | Adapt guard theo mục 4, KHÔNG bypass |
| `Zalo OA sendMessage failed: HTTP 401` | Access token hết hạn + refresh fail | Check `ZALO_OA_REFRESH_TOKEN` hợp lệ; xem log `Zalo token refresh failed` |
| Outbound TLS fail (SSL handshake) | CA bundle thiếu | Đã fix trong Dockerfile (stage `certs`). Nếu rebuild lại image, đảm bảo giữ stage này |
| Tin gửi nhưng timeline không lên | Sender chưa link | Làm lại bước 2 (OAuth link); check `provider_links` có row |
| Event nhân bản | Idempotency tắt / Redis flush | `InboundIdempotencyService` cần Redis (CACHE_SERVICE_TOKEN); không FLUSHDB giữa chừng |

---

## 7. Lưu ý production (sau demo)

- **Không dùng Cloudflare Tunnel quick (`trycloudflare`) cho prod** — cấu hình tunnel cố định + domain công ty + DNS CNAME, hoặc reverse proxy (Nginx/HAProxy) theo chuẩn DevOps.
- **Secrets**: không commit `.env.docker.compose`. Dùng secret manager (Vault / AWS Secrets Manager / GitHub Actions secrets) khi deploy.
- **Rate limit OA**: Zalo giới hạn throughput OA; hệ thống đã có `RedisRateLimiterService` cho notification — cân nhắc áp dụng thêm cho OA reply nếu traffic cao.
- **Monitoring**: đã có Loki/Prometheus/Grafana trong stack — thêm alert cho `zalo.inbound` outbox FAILED + token refresh FAILED.
