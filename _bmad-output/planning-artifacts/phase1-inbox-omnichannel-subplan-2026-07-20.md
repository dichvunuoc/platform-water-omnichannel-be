# Phase 1 Sub-plan — Inbox đa kênh (conversation-centric)

- **Ngày:** 2026-07-20
- **Trạng thái:** Draft — chờ review + chốt P1-D1…D7 trước khi code
- **Cha:** `cskh-fe-be-integration-gap-2026-07-20.md` (Phase 1)
- **Mục tiêu:** FE inbox refactor Ticket-centric → **Conversation-centric**, wire BE đã build (Epic 1) + realtime, tắt MSW inbox.

---

## 0. Phát hiện quan trọng (đọc sâu 2 phía)

### 0.1 BE đã đúng conversation-centric — giữ nguyên
BE `messaging` real đã model đúng: `Conversation` (ACTIVE/CLOSED/ARCHIVED) + `Message` (direction INBOUND/OUTBOUND, senderType CUSTOMER/AGENT/BOT/SYSTEM) + `CustomerProfile`. Read-side `ConversationReadDao` có `InboxItem` (list) + `ConversationDetail` (full thread + customer360 stub + ticketChip). **Đây là design đúng, FE phải nương theo.**

### 0.2 FE Ticket-centric — phải refactor, KHÔNG phải "đổi tên"
FE `Ticket` ([ticket/model.ts:21](water-business-cskh-fe/src/entities/ticket/model.ts)) flatten mọi thứ (customer + SLA + messages + topic + AI) vào 1 object. Khi sang conversation-centric, FE tách thành `Conversation` + `Message` + `Customer360` — 3 entity riêng. Đây là paradigm shift thật, ảnh hưởng state/UI/routing.

### 0.3 Hai model khác hoàn toàn — bảng so sánh field

| Field FE `Ticket` cần | BE có ở? | Nguồn / Ghi chú |
|---|---|---|
| `id` | ✅ | `ConversationDetail.id` |
| `code` (YC24512) | ❌ | BE không sinh code display → defer hoặc gen |
| `topic` | ❌ | Phase 2 (classification) |
| `channel` | ⚠️ | BE `ZALO/APP/FACEBOOK/EMAIL/VOIP` vs FE `hotline/zalo/app/web/facebook` — lệch enum |
| `kind` (sự cố) | ❌ | Incident, service khác (D7) |
| `priority` | ❌ | Phase 2 (ticket) |
| `status` | ⚠️ | BE `ACTIVE/CLOSED/ARCHIVED` (3) vs FE `new/progress/waiting/resolved/closed` (5) — **không map 1-1** |
| `sentiment`, `aiTag`, `aiConf` | ❌ | AI, defer (Phase 4/gating `tweaks().ai`) |
| `name` | ✅ | `customer360.name` / `CustomerProfile.name` |
| `maHb` | ❌ | BE có `contract`, không có `maHb` |
| `phone` | ⚠️ | `CustomerProfile.phone` (endpoint riêng) — **embedded `customer360` trong detail THIẾU phone** |
| `addr`, `phuong` | ⚠️ | `customer360.address`; `phuong` không có |
| `custType` | ⚠️ | `CustomerProfile.customerType` — embedded thiếu |
| `preview` | ✅ | `InboxItem.lastMessage.content` |
| `messages` | ✅ | `ConversationDetail.messages` (shape khác — xem §1.3) |
| `agent` (tên) | ❌ | BE không gán agent name lên conversation (chỉ presence) |
| `openedAt`, `ageH`, `msgTime` | ⚠️ | Compute từ `createdAt`/`updatedAt` (BE dùng `Date`, FE đang dùng display string/float hour) |
| `slaLeftH`, `slaTotalH` | ⚠️ | `ticketChip.slaDeadline` (ISO) — không có leftH/totalH numeric |
| `unread` | ❌ | BE không track unread per agent |

→ **Phase 1 không thể cover hết.** Cần scope (P1-D3).

### 0.4 R0 — Envelope error shape (CORRECTION Phase 0) 🔴
FE Zod schema ([envelope.ts:13-16](water-business-cskh-fe/src/shared/api/envelope.ts#L13)):
```ts
apiErrorSchema = z.object({ code: z.string(), detail: z.string().nullish() })
// success:false → error: apiErrorSchema.nullish()  ← OBJECT, không phải string
```
Phase 0 BE trả `error` = string (`"Not Found"`). FE gọi `envelopeSchema(DataDto).parse(json)` → error response **fail Zod parse**. Success path OK (`error:null`), nhưng error path gãy.

**→ Cần correction Phase 0:** BE trả `error` = `{ code: string, detail?: string|null }`. Xem P1-D1.

### 0.5 R1 — Realtime transport mismatch
- BE `MessagingGateway` dùng **`@nestjs/websockets` + `socket.io`** (namespace `/agent`, emit `interaction.received`/`conversation.started`/`sla.warning`) — **package CHƯA cài** trong `package.json`.
- FE `RealtimeClient` interface chỉ có event SCADA (`stations.telemetry`, `alerts.created`); transport dự kiến **SignalR** (comment), hiện `MockRealtimeEmitter`/`NoopRealtimeClient`. **Không có event conversation nào.**

**→ Cần chốt transport** (P1-D2): socket.io (BE đã code, ít công) hay SignalR (FE dự định, BE phải viết lại gateway).

---

## 1. Contract alignment — CHỐT TRƯỚC CODE (review từng schema)

> Nguyên tắc: BE là source of truth cho conversation model, nhưng enrich field FE cần. FE Zod schema = contract thực thi.

### 1.1 Envelope (sau R0 fix)
```ts
// success
{ success: true,  message: string|null, data: T, error: null }
// error
{ success: false, message: string|null, data: null, error: { code: string, detail: string|null } }
// code examples: NOT_FOUND, INVALID_TRANSITION, VALIDATION_ERROR, INTERNAL_SERVER_ERROR
```
(BE giữ thêm `statusCode/timestamp/path/method` — FE ignore, không break vì Zod `.passthrough()` hoặc FE chỉ đọc field cần — **verify FE schema có strict không** ở P1-D1.)

### 1.2 ConversationDto (list item + detail)
```ts
interface ConversationListItemDto {
  id: string
  channel: ChannelCode              // mapped FE-friendly: 'zalo'|'app'|'facebook'|'email'|'voip'
  status: ConvStatus                // 'active'|'closed'|'archived'
  customer: { id: string|null; name: string; custType?: string }
  preview: string                   // lastMessage.content
  lastMessageAt: string             // ISO
  unread: number                    // P1-D7: BE track hay FE compute
}

interface ConversationDetailDto extends ConversationListItemDto {
  messages: MessageDto[]
  customer360: Customer360Dto
  ticketChip?: { ticketId: string|null; slaDeadline: string|null }
  createdAt: string; updatedAt: string
}
```

### 1.3 MessageDto (map từ BE)
```ts
interface MessageDto {
  id: string
  from: 'cust'|'agent'|'bot'|'sys'   // map senderType: CUSTOMER→cust, AGENT→agent, BOT→bot, SYSTEM→sys
  text: string                        // content
  direction: 'in'|'out'               // INBOUND→in, OUTBOUND→out (FE có thể không cần)
  attachments: string[]               // URL/kind
  time: string                        // ISO (FE format display)
}
```

### 1.4 Customer360Dto (BE phải enrich)
```ts
interface Customer360Dto {
  id: string
  name: string
  phone?: string
  address?: string
  phuong?: string                     // BE thêm
  maHb?: string                       // BE thêm (hoặc = contract)
  custType?: string                   // 'sh'|'kddv'|'hcsn'|'sx'
  custTypeLabel?: string              // BE trả label VN (thay FE map local TYPE)
  contract?: string
  stats?: { ticketCount: number; openCount: number; csat: number }   // BE thêm (P1-D4)
  recentHistory?: Array<{ title: string; status: string; at: string }> // BE thêm
}
```

### 1.5 Realtime events (socket.io, sau P1-D2)
```ts
// BE emit, FE subscribe
'conversation.message_received': { conversationId, messageId, from, text, channel, time }
'conversation.started':          { conversationId, channel, customerName, time }
'conversation.updated':          { conversationId, status?, unread? }
// (sla.warning giữ cho Phase 2)
```

### 1.6 Enum mapping (tại BE serialize layer — D4)
- Channel: `ZALO→zalo, APP→app, FACEBOOK→facebook, EMAIL→email, VOIP→voip` (FE thêm `hotline/web` sau)
- ConvStatus: `ACTIVE→active, CLOSED→closed, ARCHIVED→archived` (FE inbox dùng 3 giá trị này, **KHÔNG dùng 5-status ticket**)
- SenderType: `CUSTOMER→cust, AGENT→agent, BOT→bot, SYSTEM→sys`

---

## 2. BE tasks

| # | Task | File | Note |
|---|---|---|---|
| B1 | **R0 fix envelope**: `error` → `{code, detail}` object | `response.dto.ts`, `global-exception.filter.ts` | Correction Phase 0 |
| B2 | Cài `@nestjs/websockets` + `socket.io` | `package.json` | Blocker realtime |
| B3 | Wire `MessagingGateway` (đã code) + verify boot | `messaging.module.ts` (đã register, cần package) | |
| B4 | CskhController delegate: `/api/cskh/inbox`, `/conversations/:id`, `/conversations/:id/reply\|close\|archive`, `/customers/:id`, presence | `cskh.controller.ts` | Inject cùng service `BffController` dùng |
| B5 | Serialization layer: map enum (channel/status/senderType) + compose `ConversationDto` | mới `cskh.dto.ts` + mapper | D4 |
| B6 | Enrich `ConversationReadDao`: thêm `unread`, `customer` tách, `preview` rõ | `conversation-read-dao.ts` | P1-D7 unread |
| B7 | `Customer360Dto` enrich: phone/custType/maHb/phuong/custTypeLabel (+ stats/history nếu P1-D4) | `customer-360.port.ts`, mock adapter | |
| B8 | Reply response: trả full `ConversationDetailDto` (FE invalidate pattern) | `cskh.controller.ts` | P1-D6 |
| B9 | Map error code chuẩn: `NOT_FOUND`, `INVALID_TRANSITION`, `VALIDATION_ERROR` | exception filter + domain throws | |

## 3. FE tasks

| # | Task | File | Note |
|---|---|---|---|
| F1 | Tạo entity `conversation`: `ConversationDto`, `MessageDto`, `Customer360Dto` + Zod schemas | `entities/conversation/{model,api}.ts` | Mới |
| F2 | API client: `useInbox()`, `useConversation(id)`, `useReply()`, `useCustomer360()` → `/api/cskh/*` | `entities/conversation/api.ts` | Thay `entities/ticket` cho inbox |
| F3 | Refactor [inbox page](water-business/water-business/water-business-cskh-fe/src/pages/inbox/index.tsx) 3 cột sang conversation-centric (state, list, thread, composer) | `pages/inbox/index.tsx` | **Lớn nhất** |
| F4 | Customer360 panel: render từ `Customer360Dto` thật, bỏ hardcode `TYPE`/stats/history/relatedApps | `pages/inbox/index.tsx` L151-278 | |
| F5 | Realtime: thêm `conversation.*` events vào `RealtimeEvents` + impl socket.io client | `shared/api/realtime/{types,client,socket-io-client.ts}` | P1-D2 |
| F6 | Subscribe realtime trong inbox: push message mới, bump unread, update list | `pages/inbox/index.tsx` | |
| F7 | Tắt MSW handler inbox (giữ mock cho page khác) | `shared/api/mocks/handlers.ts` | |
| F8 | Channel/status catalog: thêm `email/voip`/`active/closed/archived` nếu thiếu | `mocks/data/cskh.ts` + catalog model | |

## 4. Thứ tự thực thi (sequence có dependency)

```
Step 0: Review sub-plan + chốt P1-D1…D7            ← BẠN (before any code)
Step 1: B1 (R0 envelope fix) + verify               ← BE, correction Phase 0
Step 2: B2+B3 (socket.io package + wire gateway)    ← BE, unblock realtime
Step 3: B5 (serialization + enum map) + B6+B7 (enrich read model + customer360)
Step 4: B4+B8+B9 (CskhController delegate endpoints)
        ── checkpoint: BE endpoint sẵn sàng, curl verify ──
Step 5: F1+F2 (FE entity + api client)
Step 6: F3+F4 (refactor inbox + customer360 panel)
        ── checkpoint: inbox chạy REST (no realtime) ──
Step 7: F5+F6 (realtime subscribe)
Step 8: F7+F8 (tắt MSW + catalog) + E2E verify
```

## 5. Decisions ĐÃ CHỐT (locked 2026-07-20)

- **P1-D1 ✅ (R0)** Envelope: BE trả `error` = `{code, detail}` object (khớp FE Zod `apiErrorSchema`). *Correction Phase 0 — Step 1.*
- **P1-D2 ✅ (R1)** Realtime: **socket.io**. FE viết lại client theo socket.io, tận dụng gateway BE đã code (chỉ thiếu package).
- **P1-D3 ✅ Scope Minimal**: Phase 1 chỉ enrich `id, channel, status, messages, customer(name/phone/address/custType), preview, lastMessageAt`. **Defer:** topic, kind, sentiment, aiTag/aiConf, code, priority, slaLeftH/totalH, maHb, unread, msgTime.
- **P1-D4 ✅ Enum mapping**: tại BE serialize layer. FE inbox dùng 3-status `active/closed/archived`.
- **P1-D5 ✅ Customer360**: endpoint riêng `GET /api/cskh/customers/:id` (full profile khi cần).
- **P1-D6 ✅ Reply response**: trả full `ConversationDetailDto` (FE invalidate cache).
- **P1-D7 ✅ Unread**: defer Phase 1.5. Phase 1 trả `unread: 0` (hoặc FE compute client-side).

## 6. Risks

- **R-1** Socket.io package cài nhưng gateway có thể lỗi runtime (auth JWT, room join) — cần verify boot + 1 client test.
- **R-2** FE refactor inbox lớn (F3) — nếu breakdown thành sub-PR: state → list → thread → composer → customer360.
- **R-3** `ConversationReadDao` enrich (B6) có thể cần migration (thêm cột unread) → phụ thuộc DB. Nếu chưa có DB, dùng in-memory/derive tạm.
- **R-4** Channel `hotline/web` (FE) không có ở BE → FE tạm ẩn hoặc BE thêm enum value.
- **R-5** `time` display: FE đang dùng "HH:mm" string, BE trả ISO → FE format. Không blocking.
- **R-6** FE Zod schema strict: nếu `.strict()`, BE trả field thừa (statusCode/timestamp/path/method) sẽ fail parse → FE dùng `.passthrough()` hoặc BE trả tối giản. Verify ở P1-D1.
