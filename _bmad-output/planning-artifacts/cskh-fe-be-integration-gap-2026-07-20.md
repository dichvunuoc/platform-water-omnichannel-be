# CSKH FE ↔ BE — Integration Gap & Build Plan

- **Ngày:** 2026-07-20
- **Trạng thái:** Decisions locked (D0–D7 chốt 2026-07-20) — sẵn sàng bắt đầu Phase 0
- **BE:** `omichannel_be` (OmniCare — NestJS 11 + Fastify + Drizzle + PG, modular monolith, prefix `/bff`)
- **FE:** `water-platform/water-business/water-business-cskh-fe` (SolidJS + Vite + FSD, prefix `/api/cskh`)
- **Nguồn:** Khảo sát 2 phía + verify envelope ([response.dto.ts](../../src/libs/shared/http/dtos/response.dto.ts), [bff.controller.ts](../../src/modules/messaging/infrastructure/http/bff.controller.ts))

---

## 0. TL;DR

- **Mức khớp hiện tại: ~10–15%** — không có endpoint nào plug-and-play được.
- FE đang **chạy 100% qua MSW mock** ([handlers.ts](../..)), chưa gọi được BE thật dù 1 endpoint.
- 3 tầng đều mismatch: **(1) contract** (envelope/prefix), **(2) độ phủ resource** (BE thiếu phần lớn FE cần), **(3) data model** (enum/priority/entity khác).
- BE đã build phần **omnichannel ingest → inbox → reply** thật, nhưng **FE chưa dùng** tới (FE model hóa mọi thứ là "ticket phẳng").
- **Scope boundary có chủ ý:** `incident` không thuộc `omichannel_be` → service khác (theo `[[cskh-ticket-vs-incident-architecture]]`, `[[cskh-incident-pending]]`).

---

## 1. Ranh giới scope (chốt trước khi build)

| Domain | Phục vụ bởi | Ghi chú |
|---|---|---|
| Inbox / Conversation / Reply đa kênh | `omichannel_be` (đã build) | FE chưa wire |
| Ticket + SLA | `omichannel_be` (code-complete nhưng **không wire**, đang dùng stub) | Cần wire lại |
| Catalog, Dashboard, CSAT, Knowledge, Chatbot, Broadcast | `omichannel_be` (BE chưa có / mock) | Phải build thêm |
| **Incident (sự cố hiện trường)** | **service khác** (app-tu-phuc-vu / incident-service) | KHÔNG build trong omichannel_be |
| Auth / ui-settings / OTP | cần quyết định (BE chưa có auth) | Xem D6 |
| Softphone / Telephony | BE chỉ có endpoint cứng | XL — defer |

> ⚠️ **Quyết định chốt (D0):** confirm FE `cskh-fe` là **agent desktop** do `omichannel_be` phục vụ, còn phần incident/customer-self-service thuộc service khác. Nếu sai, toàn bộ plan phải sửa.

---

## 2. Mismatch cấu trúc (cross-cutting)

### 2.1 Envelope

| | FE kỳ vọng | BE thực tế |
|---|---|---|
| Success | `{ success, message, data, error }` | `{ success, statusCode, timestamp, path, method, data, message }` |
| Error | mã string `error` ∈ `NOT_FOUND, INVALID_STATUS, INVALID_KIND, INVALID_TRANSITION…` | chỉ `message` + HTTP `statusCode` |

**Resolution:** BE bổ sung trường `error` (mã nghiệp vụ) vào envelope + giữ `statusCode`. Không bỏ trường hiện có (backward-compat). File ảnh hưởng: [response.dto.ts](../../src/libs/shared/http/dtos/response.dto.ts), [global-exception.filter.ts](../../src/libs/shared/http/filters/global-exception.filter.ts), [response.interceptor.ts](../../src/libs/shared/http/interceptors/response.interceptor.ts).

### 2.2 Prefix route

- FE gọi `/api/cskh/*`; BE expose `/bff/*`, `/tickets/*`.
- **Resolution (D1):** thêm controller prefix `/api/cskh` (khuyến nghị) HOẶC đặt global prefix + sub-path. Không đổi `/bff` (đã có webhooks/consumer phụ thuộc).

### 2.3 Auth

- BE: "demo API không yêu cầu auth" ([main.ts:67-68](../../src/main.ts)).
- FE: 3 mode `mock | keycloak | backend-session`, mặc định `.env` = `mock`.
- **Resolution (D6):** quyết định sau. MVP có thể giữ mode `mock`/`keycloak` của FE, BE chưa wire guard.

---

## 3. Mapping endpoint-by-endpoint

Chú giải Gap: 🟢 khớp ý niệm / 🟡 khác shape / 🔴 BE chưa có / ⚫ BE có FE chưa dùng
Effort (BE): S < 1 ngày · M 1–3 ngày · L 3–7 ngày · XL > 1 tuần

### 3.1 Catalog & Dashboard

| # | FE cần | BE hiện có | Gap | Resolution | Effort |
|---|---|---|---|---|---|
| 1 | `GET /api/cskh/catalogs` → CatalogDto | ❌ (FE tự define) | 🔴 | BE thêm endpoint aggregate trả channels/topics/incKinds/priority/status/sentiment/agents (có thể từ config/DB) | S |
| 2 | `GET /api/cskh/dashboard` → DashDto (kpis, volByChannel, volByTopic, hourly[24], slaTrend, agents[]) | `GET /bff/operations/kpis` (mock cứng, shape khác) | 🟡🔴 | BE build read-side aggregate; FE shape là target | L |

### 3.2 Ticket & SLA

| # | FE cần | BE hiện có | Gap | Resolution | Effort |
|---|---|---|---|---|---|
| 3 | `GET /api/cskh/tickets?status&channel&topic&priority&q&page&pageSize` | `GET /bff/tickets/kanban`, `/tickets/kanban` (real, không wire) | 🟡 | Wire `TicketingModule` + thêm filter/paging theo field FE | M |
| 4 | `GET /api/cskh/tickets/{id}` (full messages) | `GET /bff/tickets/:id` | 🟡 | BE trả messages[] (link conversation→ticket) | M |
| 5 | `POST /api/cskh/tickets/{id}/reply` `{text}` | `POST /bff/conversations/:id/reply` | 🟡 | Adapter: reply theo ticket→conversation | M |
| 6 | `POST /api/cskh/tickets/{id}/assign` `{agent}` | `POST /bff/tickets/:id/reassign` (**mock**) | 🟡🔴 | BE implement reassign thật | M |
| 7 | `POST /api/cskh/tickets/{id}/status` `{status}` | `POST /bff/tickets/:id/advance` (**mock**) | 🟡🔴 | BE implement advance thật + map enum | M |
| 8 | `POST /api/cskh/tickets/{id}/resolve` | (như advance → resolved) | 🟡🔴 | BE implement resolve + clear slaLeftH | S |

### 3.3 Incident — tách khỏi scope (xem §1)

| # | FE cần | BE hiện có | Gap | Resolution |
|---|---|---|---|---|
| 9-12 | `GET /api/cskh/incidents`, `triage`, `kind`, `dispatch` | ❌ không có module | 🔴 (by design) | **Không build ở đây.** FE phải trỏ sang incident-service. Cần BFF/gateway route `/api/cskh/incidents/*` → service khác (D7) |

### 3.4 CSAT, Knowledge, Chatbot, Broadcast

| # | FE cần | BE hiện có | Gap | Resolution | Effort |
|---|---|---|---|---|---|
| 13 | `GET /api/cskh/csat` (avg/nps/dist/trend/byChannel/recent) | chỉ `POST /bff/csat` (submit) | 🔴 | BE thêm GET aggregate | M |
| 14 | `GET /api/cskh/knowledge` (kb[] grouped + canned[]) | chỉ `GET /bff/kb/search?q=` | 🔴 | BE thêm list grouped + canned | S–M |
| 15-16 | `GET/POST /api/cskh/chatbot` + `toggle` | ❌ | 🔴 | BE build module chatbot (state + intents stats) | M |
| 17-19 | `GET/POST /api/cskh/broadcasts` + `send` | ❌ (Epic 9 backlog) | 🔴 | BE build module broadcast | L |

### 3.5 Auth & realtime

| # | FE cần | BE hiện có | Gap | Resolution | Effort |
|---|---|---|---|---|---|
| 20 | `GET /auth/ui-settings` | ❌ | 🔴 | BE thêm endpoint (panel toggles) | S |
| 21-22 | `POST /auth/otp/{request,verify}` | ❌ | 🔴 | BE thêm (FE chưa nối UI) | M |
| RT | realtime (interaction.received, sla.warning) | Socket.io gateway **code có nhưng package thiếu** (`@nestjs/websockets`, `socket.io` không trong package.json) | ⚫→🟢 | Cài package + wire gateway + FE subscribe | M |

### 3.6 BE có — FE CHƯA dùng (cơ hội)

`/bff/inbox`, `/bff/conversations/:id`, `/bff/bootstrap`, presence, resolve-identity, assign-customer, create-ticket, dispatch-work-order, `/bff/customers/:id`, `/bff/ai/*`, `/webhooks/*`. → Đề xuất FE mở rộng inbox page dùng `/bff/conversations` (Customer360, conversation lifecycle) — sau phase ticket.

---

## 4. Data model mismatch

| Trường | FE | BE | Resolution |
|---|---|---|---|
| **Ticket status** | `new\|progress\|waiting\|resolved\|closed` | `RECEIVED\|IN_PROGRESS\|WAITING\|RESOLVED\|CLOSED` | BE map tại biên (serialization): `RECEIVED→new`, `IN_PROGRESS→progress`. Giữ internal enum BE. |
| **Priority** | `urgent\|high\|normal\|low` + `slaH` (2/8/24/72h) | `P0–P3` + dual-clock (ack + resolve) | BE map `P0→urgent, P1→high, P2→normal, P3→low`; tính `slaLeftH/slaTotalH` từ dual-clock resolve-deadline. |
| **Entity** | 1 `TicketDto` (messages[] + customer + SLA) | 2 aggregate: `Conversation` + `Ticket` | BE compose tại BFF: join conversation.messages + ticket + customer360 → `TicketDto`. |
| **Channel** | `hotline\|zalo\|app\|web\|facebook` | `ZALO\|APP\|FACEBOOK\|EMAIL\|VOIP` | BE thêm `HOTLINE`, `WEB` (hoặc alias); FE thêm `EMAIL/VOIP` nếu cần. |
| **Trường VN-hóa FE cần** | `topic, kind, sentiment, aiTag, aiConf, maHb, phone, addr, phuong, custType, preview` | thiếu phần lớn trong Ticket entity | BE thêm columns/VO `topic, kind, sentiment, aiTag/aiConf, maHb, custType, phuong` (migration mới). |

---

## 5. Kế hoạch build theo phase

> **Nguyên tắc (tái cơ cấu 2026-07-20): core đa kênh trước, supporting sau.**
> Service là CSKH **đa kênh cho nhân viên** → inbox/hội thoại đa kênh (đã build thật ở BE, Epic 1) là **core** và phải wire sớm. Tránh xây feature phụ trợ (dashboard/catalog) trên model "ticket phẳng" sai ngay từ đầu — nếu không, khi refactor sang conversation-centric ở cuối sẽ đập đi xây lại state/UI/routing (tech debt lớn). Realtime socket cũng cần verify sớm vì đang thiếu package ở BE.

### Phase 0 — Contract alignment ✅ DONE (2026-07-20)
- BE: thêm `error` vào envelope + exception filter chuẩn hóa mã lỗi (D3).
- BE: thêm controller prefix `/api/cskh` (`CskhController`) song song `/bff` (D1, D2).
- FE: giữ nguyên parser `unwrapEnvelope` (đã đúng target).
- **Verify (pass):** `curl /api/cskh/health` → `{"success":true,"data":{...},"error":null}`; 404 → `{"success":false,"error":"Not Found","message":"..."}`.
- **Lưu ý build:** `nest-cli.json` `tsConfigPath` đổi sang `tsconfig.build.json`; `ticketing` module exclude khỏi build (broken — Phase 2 wire lại thì **REMOVE** dòng exclude `src/modules/ticketing` trong `tsconfig.build.json`).
- **Refinement (Phase 1+):** HttpException path trả `error` = NestJS label ("Not Found"); nếu FE cần mã chuẩn ("NOT_FOUND") thì map thêm tại filter. Domain `BaseException` path đã trả đúng `code`.

### Phase 1 — Inbox đa kênh & Customer360 (CORE) · effort L–XL
- BE: expose phần đã build thật qua alias `/api/cskh/*` + chuẩn hóa envelope — `/bff/inbox`, `/bff/conversations/:id`, `/bff/conversations/:id/reply|close|archive`, `/bff/customers/:id`, presence.
- BE: cài `@nestjs/websockets` + `socket.io` (đang thiếu package) → wire `MessagingGateway` realtime (`interaction.received`, `conversation.started`, `sla.warning`).
- FE: **refactor inbox sang conversation-centric** — entity Conversation (messages[] + Customer360 + presence) thay Ticket-centric; cập nhật state management, UI components (thread/bubble/composer), routing. Inbox là nơi nhân viên làm việc chính.
- FE: tắt MSW inbox → thật; subscribe realtime.
- **Verify:** nhân viên nhận/trả lời hội thoại đa kênh (Zalo/App/Facebook/Email) end-to-end + realtime update + Customer360 screen-pop.

### Phase 2 — Ticket & SLA gắn vào conversation · effort L–XL
- BE: **wire `TicketingModule`** (app.module + export `ticketsTable` + cài `@nestjs/schedule` + migration) — blocker lớn ([sprint-status.yaml](../implementation-artifacts/sprint-status.yaml) `ticketing-module: backlog`).
- BE: thêm columns VN-hóa qua 1 migration (D5: topic, kind, sentiment, aiTag, aiConf, maHb, custType, phuong).
- BE #3–#8: list/detail/assign/status/resolve + map enum/priority tại serialization (D4).
- Tích hợp: ticket gắn vào conversation đang chạy (link conv↔ticket); advance/resolve thực hiện trong luồng hội thoại.
- FE: tắt MSW tickets → thật; render ticket/SLA trong ngữ cảnh conversation (không phải view riêng biệt thuần túy).
- **Verify:** Kanban + advance + resolve + SLA enrichment end-to-end.

### Phase 3 — Catalog & Dashboard (supporting, lùi xuống) · effort L
- BE #1 catalogs (S), #2 dashboard aggregate (L — read-side join).
- FE: tắt 2 MSW handler → data thật.
- **Verify:** shell load catalog; dashboard render số thật.

### Phase 4 — CSAT + Knowledge · effort M
- BE #13 csat aggregate, #14 knowledge list grouped.
- **Verify:** 2 page render thật.

### Phase 5 — Chatbot + Broadcast + Auth · effort L
- BE #15–#16 chatbot, #17–#19 broadcast, #20 ui-settings, #21–#22 OTP (D6).
- **Verify:** 3 page render thật + ui-settings load.

### Phase 6 — Mở rộng (defer)
- Softphone/telephony (XL), Customer360 thật (wave-3), AI endpoint thật, broadcast edit, KB/canned CRUD.

### Out-of-scope (gateway route khi service sẵn sàng)
- Incident #9–#12 → incident-service (D7). FE giữ mock cho page incident tới khi gateway route.

---

## 6. Quyết định ĐÃ CHỐT (locked 2026-07-20)

- **D0 ✅** Scope: `cskh-fe` = agent desktop do `omichannel_be` phục vụ. Incident (sự cố hiện trường) → service khác (incident-service). Plan giữ nguyên.
- **D1 ✅** Prefix: BE thêm controller `/api/cskh` song song `/bff`.
- **D2 ✅** Route: giữ `/bff` song song, migrate dần (không bỏ ngay).
- **D3 ✅** Envelope: BE thêm trường `error` (mã nghiệp vụ), giữ `statusCode/message`. FE giữ parser hiện tại.
- **D4 ✅** Mapping status/priority tại serialization layer của BE (giữ enum nội bộ BE). Ánh xạ: `RECEIVED→new, IN_PROGRESS→progress, WAITING→waiting, RESOLVED→resolved, CLOSED→closed`; `P0→urgent, P1→high, P2→normal, P3→low`.
- **D5 ✅** Trường VN-hóa: thêm đầy đủ columns qua 1 migration — `topic, kind, sentiment, aiTag, aiConf, maHb, custType, phuong` (kiểu cụ thể define khi implement Phase 2).
- **D6 ✅** Auth MVP: FE giữ mode `keycloak`/`mock`; BE chưa wire auth guard. `ui-settings` trả tĩnh. Auth proper = scope riêng.
- **D7 ✅** Incident routing: gateway route `/api/cskh/incidents/*` → incident-service khi sẵn sàng; trước đó FE giữ mock cho page incident.

---

## 7. Risks

- **R1** — Wire `TicketingModule` kéo theo 3 blocker phụ thuộc (app.module, schema export, `@nestjs/schedule`). Phải giải quyết đồng thời.
- **R2** — Socket.io package thiếu → realtime gateway sẽ lỗi resolve khi instantiate.
- **R3** — Dashboard/CSAT/Broadcast aggregate cần nguồn dữ liệu thật; BE hiện toàn mock → "build thật" vẫn phụ thuộc data pipeline.
- **R4** — Incident nếuFE hard-trỏ `/api/cskh/incidents` mà gateway chưa route → page incident gãy khi tắt mock.
- **R5** — Envelope `error` code: FE kỳ vọng mã cố định (`INVALID_TRANSITION`…); BE phải emit đúng mã để FE branch logic.
