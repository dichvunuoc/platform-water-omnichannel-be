# Phase 3 — Ý tưởng + định hướng

> Phase 1 (Messaging) + Phase 2 (Ticketing) hoàn tất. Phase 3 tập trung vào
> **Customer 360 Identity** + **đa kênh thật** + **production readiness**.

## Trạng thái hiện tại

| Mảng | Đã có | Thiếu |
|---|---|---|
| Conversation ingest | ✅ Webhook 5 kênh + persist + realtime | ❌ Channel adapter thật (Zalo OA API, FB, SMTP) |
| Inbox hợp nhất | ✅ `/api/cskh/inbox` + `/conversations/:id` + reply | ❌ Customer360 enrich chưa có data thật (mock 3 profiles) |
| Ticket & SLA | ✅ Real aggregate + state machine + SLA worker + event-driven | ✅ Hoàn chỉnh |
| Customer 360 | ⚠️ Port + adapter (config-gated) + mock 3 profiles | ❌ Auto identity resolution (customerChannelId → customerId) |
| Notification | ✅ gRPC → notification-be-rs (3 triggers) | ✅ Hoàn chỉnh |
| Event bus | ⚠️ In-process (IEventBus) | ❌ RabbitMQ cho production |
| Auth | ❌ Chưa wire (demo mode) | ❌ Keycloak SA + RBAC guards |
| Realtime | ✅ socket.io gateway + IoAdapter | ✅ Hoàn chỉnh |

## 4 hướng Phase 3 ( xếp theo impact × effort )

### A. Customer 360 Identity Resolution — 🔴 Ưu tiên cao nhất

**Vấn đề**: Mỗi conversation có `customerChannelId` (Zalo user id / App userId / SĐT) nhưng `customerId` luôn null (chưa resolve). Agent không biết ai đang chat.

**Giải pháp event-driven** (giống Conversation→Ticket pattern):

```
ConversationStarted event
  → IdentityResolutionHandler (mới, subscribe event)
  → ICustomer360Port.resolveIdentity(channel, customerChannelId)
  → Nếu tìm thấy → conversation.assignCustomer(customerId) → save
  → Nếu không tìm thấy → đánh dấu "chưa xác định" (agent link thủ công sau)
```

**Implementation**:
1. `IdentityResolutionHandler` — subscribe `ConversationStarted`, gọi port, link customer
2. Enrich `Customer360BffAdapter` — gọi cskh-bff `/api/cskh/customers/resolve` (note handoff đã có)
3. `AssignCustomerHandler` đã có (manual link qua `/bff/conversations/:id/assign-customer`) — giữ
4. Cross-channel: cùng customerId → group conversations (inbox có thể filter)

**Value**: Agent biết ngay ai đang chat + profile 360° (tên, SĐT, địa chỉ, mã danh bộ, loại KH, công nợ).

**Effort**: M (1-2 ngày — pattern đã có từ Conversation→Ticket).

### B. Real Channel Adapter (Zalo OA) — 🟡 Impact cao, cần credentials

**Vấn đề**: Webhook endpoints có sẵn (`/webhooks/zalo`) nhưng không có tin thật (Zalo OA chưa connect).

**Giải pháp**:
1. Đăng ký Zalo OA (cần team business + Zalo credentials)
2. Config Zalo OA webhook URL → trỏ về omichannel_be `/webhooks/zalo`
3. `ZaloOutboundAdapter` (đã có khung) — config `ZALOA_ACCESS_TOKEN` → gửi reply thật
4. Test E2E: KH nhắn Zalo → agent inbox → reply → KH nhận trên Zalo

**Value**: Demo thật kênh Zalo (high-impact cho stakeholder demo).

**Effort**: S (code) + external (Zalo OA setup, credentials). Code sẵn — chỉ config.

### C. Production Infrastructure — 🟡 Cần cho deploy

**3 mảng**:

1. **RabbitMQ event bus** — thay in-process IEventBus bằng AMQP publisher/consumer
   - Outbox processor publish → RabbitMQ exchange `water-platform`
   - Các module subscribe queue riêng (ticketing, realtime, notification)
   - **Value**: Reliable delivery, survive restart, chuẩn platform (spec `03-event-bus.md`)
   - **Effort**: L (3-5 ngày — message serialization, consumer, retry, DLQ)

2. **Redis** — presence + cache (hiện in-memory fallback)
   - Config `REDIS_URL` → PresenceService + IdempotencyService + ConversationReadDao cache
   - **Value**: Persist presence across restart, cache inbox queries
   - **Effort**: S (config-only, code đã support Redis, chỉ set REDIS_URL)

3. **Auth (Keycloak RBAC)** — wire guards cho `/api/cskh/*`
   - JWT validation middleware (Keycloak JWKS)
   - Role-based: `agent` (inbox, reply, advance), `supervisor` (dashboard, kanban), `admin` (all)
   - **Value**: Production-ready, multi-tenant, audit trail
   - **Effort**: M (2-3 ngày — guard + role check + test)

### D. Feature Completeness — 🟢 Polish

1. **CSAT close-loop**: ticket close → auto-send CSAT survey (notification-be-rs) → KH rate → reopen if <3★
   - Event-driven: `TicketClosed` event → CSAT handler → notification send
   - **Effort**: M

2. **Dashboard real metrics**: aggregate từ conversations + tickets (thay mock)
   - `/api/cskh/dashboard` đọc từ ConversationReadDao.countActive + TicketRepository.findAll
   - **Effort**: S-M

3. **Close/archive conversation workflow**: đã có command + endpoint, cần test + FE wire
   - **Effort**: S

4. **Broadcast real send**: bulk qua notification-be-rs (template `cskh.broadcast`)
   - **Effort**: S

## Đề xuất roadmap Phase 3

```
Step 1: Customer 360 Identity Resolution (A)     ← event-driven auto-resolve
Step 2: Redis config (C.2)                       ← quick win, production cache
Step 3: Auth RBAC (C.3)                          ← production guards
Step 4: RabbitMQ event bus (C.1)                 ← platform standard
Step 5: CSAT close-loop (D.1)                    ← feature complete
Step 6: Zalo OA real (B)                         ← khi có credentials
```

## Note: mỗi hướng cần gì từ team khác

| Hướng | omichannel_be (tôi làm) | Team khác (note handoff) |
|---|---|---|
| A. Customer 360 | IdentityResolutionHandler + enrich | cskh-bff .NET endpoint `/customers/resolve` |
| B. Zalo OA | Config adapter | Zalo OA registration + webhook URL |
| C.1 RabbitMQ | AMQP publisher/consumer | RabbitMQ server config |
| C.2 Redis | Config-only | Redis server |
| C.3 Auth | Guards + role check | Keycloak realm + SA client |
| D.1 CSAT | Event handler + notification trigger | — |
| D.2 Dashboard | Aggregate read queries | — |
