# Hướng dẫn chạy Backend + Frontend — IOC CSKH (Cổng Khách hàng cấp nước)

> Nền tảng chăm sóc khách hàng đa kênh ngành nước. Backend = BFF NestJS (Docker). Frontend = Next.js 16 cổng khách hàng.
> Hướng dẫn này chạy trên **Windows** (PowerShell / Git Bash). Điều chỉnh cho macOS/Linux ở các lệnh `taskkill`/`kill`.

---

## 0. Yêu cầu

| Công cụ | Phiên bản | Kiểm tra |
|---|---|---|
| **Docker Desktop** | có WSL2 backend | `docker ps` (phải trả danh sách container, không lỗi pipe) |
| **Node.js** | ≥ 20 | `node -v` |
| **Git** | bất kỳ | `git -v` |

Clone 2 repo cùng cấp:
```bash
git clone https://github.com/dichvunuoc/platform-water-omnichannel-be.git IOC_Customer
git clone https://github.com/dichvunuoc/platform-water-omnichannel-fe.git IOC_Customer_FE
```

Cấu trúc mong muốn:
```
Workspace/
├── IOC_Customer/       ← Backend (BFF)
└── IOC_Customer_FE/    ← Frontend (Next.js)
```

---

## 1. Kiến trúc & luồng (quan trọng để hiểu)

```
Trình duyệt (:3001)  ──/api/bff/*──►  Next.js rewrite proxy  ──►  Backend BFF (:3000)
                └──/api/auth/*──►                                  (Fastify/NestJS)
                                                                     │
                                                                     ▼
                                                            Port adapters (mock/live)
                                                                     │
                                                            └─ mock: mocks/*.json
                                                            └─ live: Backend API thật
```

- **Frontend (:3001)** gọi **same-origin `/api/bff/*`** → Next proxy sang backend → **cookie HttpOnly tự gửi, không cần CORS**.
- Hiện **toàn bộ data là MOCK** (backend đọc `mocks/*.json`). Xác thực (login OTP) là THẬT (better-auth + Postgres/Redis).
- Backend `:3000`, Frontend `:3001` — **đừng đổi port** (config phụ thuộc).

---

## 2. Chạy Backend (BFF) — Docker

### 2.1. Đảm bảo file env tồn tại
Backend đọc `.env.docker.compose` (file này **bị gitignore**, không có trên GitHub). Kiểm tra:
```bash
cd IOC_Customer
ls .env.docker.compose
```
Nếu **thiếu**, tạo từ `.env.example` rồi đặt các giá trị. **Biến bắt buộc phải có**:
```ini
NODE_ENV=development                  # hoặc production
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<chuỗi-32-ký-tự>   # KHÔNG dùng secret mẫu khi production
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3001   # ← QUAN TRỌNG: origin của Frontend
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/nestjs_project
REDIS_URL=redis://redis:6379
```

> ⚠️ **`BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3001` là bắt buộc.** Nếu thiếu, đăng nhập sẽ báo `401 auth.unauthorized` vì better-auth (production) không trust origin của Frontend (chạy port khác).

### 2.2. Khởi động stack
```bash
cd IOC_Customer
docker-compose up -d --build
```
Đợi ~30–60s (postgres + redis healthcheck + app migrate). Kiểm tra:
```bash
docker ps                                  # nestjs-ddd-app / postgres / redis phải "Up"
curl http://localhost:3000/health          # → {"success":true,...,"data":{"status":"up"}}
```
Swagger UI: **http://localhost:3000/api/docs**

---

## 3. Chạy Frontend — Next.js

### 3.1. Đảm bảo `.env.local` tồn tại
```bash
cd ../IOC_Customer_FE
ls .env.local
```
Nếu thiếu, tạo `.env.local`:
```ini
BACKEND_BASE_URL=http://localhost:3000
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3001
```

### 3.2. Cài + chạy (port **3001**)
```bash
npm install
npm run dev          # chạy trên http://localhost:3001
```
Khi thấy `✓ Ready` → mở **http://localhost:3001**.

> Nếu giao diện **không có style** (nền trắng, chữ đen, link xanh) → thiếu `postcss.config.mjs`. File này đã có trong repo; nếu chưa có, tạo nó với nội dung:
> ```js
> const config = { plugins: { "@tailwindcss/postcss": {} } };
> export default config;
> ```
> rồi **restart** `npm run dev`.

---

## 4. Đăng nhập (OTP giả lập dev)

Backend ở chế độ dev **không gửi SMS** — OTP được ghi vào log.

1. Mở **http://localhost:3001/login**.
2. Nhập số điện thoại bất kỳ, ví dụ `0987654321` → **Gửi mã OTP**.
3. Lấy OTP từ log backend:
   ```bash
   docker logs nestjs-ddd-app 2>&1 | grep -oE "OTP for .*: [0-9]{6}" | tail -1
   ```
   → ví dụ `OTP for ******4321: 829920` → mã là **829920**.
4. Nhập 6 chữ số → **Xác thực** → vào **Tổng quan**.

---

## 5. Các URL

| URL | Mục đích |
|---|---|
| http://localhost:3001 | Frontend (cổng khách hàng) |
| http://localhost:3001/login | Đăng nhập |
| http://localhost:3000/health | Health check backend |
| http://localhost:3000/api/docs | Swagger UI backend |

---

## 6. Dừng hệ thống

```bash
# Dừng backend (giữ dữ liệu trong volume)
cd IOC_Customer && docker-compose down

# Dừng frontend: Ctrl+C trong terminal đang chạy npm run dev
```

---

## 7. Xử lý sự thường gặp

### 7.1. Lỗi `ECONNREFUSED` / proxy trả `500 Internal Server Error`
→ **Backend chưa lên hoặc Docker sập.**
```bash
docker ps                      # container app có "Up" không?
curl http://localhost:3000/health
```
Nếu Docker báo lỗi pipe (`open //./pipe/dockerDesktopLinuxEngine`) → **Docker Desktop đã sập**:
- Khởi động lại Docker Desktop (system tray → Restart), hoặc
- `wsl --shutdown` rồi mở lại Docker Desktop.

### 7.2. Đăng nhập báo `401 auth.unauthorized`
→ Thiếu/ sai `BETTER_AUTH_TRUSTED_ORIGINS`. Sửa `.env.docker.compose`:
```ini
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3001
```
rồi `docker-compose up -d app` (hoặc `--build` nếu đổi code).

### 7.3. "Ghost server" — hành vi lạ, lúc được lúc không, `EADDRINUSE :3001`
→ Có nhiều tiến trình Next.js đè port 3001 (tách IPv4 `0.0.0.0` / IPv6 `::1`). Triệt để:
```bash
# Windows (PowerShell):
taskkill /F /IM node.exe
# rồi chạy lại duy nhất 1 lần: npm run dev
```
Kiểm tra chỉ 1 PID giữ 3001: `netstat -ano | findstr :3001`.

### 7.4. Giao diện "xấu", không card/viền/màu
→ Tailwind không chạy (thiếu `postcss.config.mjs`). Xem mục 3.2.

### 7.5. Đổi giao diện sang tối/sáng
Theme đang **ép sáng** (`forcedTheme="light"` trong `src/components/providers.tsx`). Đổi palette ở `src/app/globals.css` (`:root`).

---

## 8. Ghi chú về dữ liệu (mock vs live)

- **Mọi data nghiệp vụ hiện là MOCK** (hóa đơn, công nợ, đồng hồ, ticket...) — cố định, lặp lại cho mọi user.
- **Xác thực là THẬT** (better-auth ghi Postgres/Redis thật).
- Khi Backend API thật sẵn sàng: đổi `adapter: mock → live` từng port trong `IOC_Customer/config/api-endpoints.yaml`, set `BACKEND_BASE_URL` trỏ tới API thật. **Frontend không cần sửa gì.**

---

## Tóm tắt nhanh (copy-paste)

```bash
# Terminal 1 — Backend
cd IOC_Customer
docker-compose up -d --build
curl http://localhost:3000/health

# Terminal 2 — Frontend
cd IOC_Customer_FE
npm install
npm run dev
# → http://localhost:3001

# Lấy OTP đăng nhập:
docker logs nestjs-ddd-app 2>&1 | grep -oE "OTP for .*: [0-9]{6}" | tail -1
```
