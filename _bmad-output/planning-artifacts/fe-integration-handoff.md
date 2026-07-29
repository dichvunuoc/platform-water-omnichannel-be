# FE Integration Handoff — tách 2 screen + switch real BE

> BE `omichannel_be` Phase 1 + 2 hoàn tất. FE `water-business-cskh-fe` cần tách 2 screen
> (Inbox hợp nhất = Conversation, Ticket Kanban = Ticket) + switch từ fixture sang real BE.
> Tài liệu này là blueprint cho team FE.

## 1. Kiến trúc 2 screen (theo plan [backend-build-plan-omnicare §9](backend-build-plan-omnicare-2026-06-20.md))

| Screen | Entity | Module BE | Endpoint BE | Phase |
|---|---|---|---|---|
| **Inbox hợp nhất** | Conversation (thread đa kênh + Customer360) | messaging | `/api/cskh/inbox`, `/api/cskh/conversations/:id` | 1 ✅ |
| **Ticket & SLA Kanban** | Ticket (P0-P3 + SLA dual-clock + workflow) | ticketing | `/tickets/kanban`, `/tickets/:id`, `/tickets/:id/advance` | 2 ✅ |

FE hiện gộp nhầm 2 screen — trang "Inbox" đọc `/api/cskh/tickets` (Ticket shape). Cần tách.

## 2. Screen 1: Inbox hợp nhất (Conversation-centric)

### Endpoints FE cần gọi

```bash
# List hội thoại (phân trang + filter channel)
GET /api/cskh/inbox?page=1&limit=20&channel=zalo&status=active
→ { items: ConversationListItemDto[], total, page, limit, hasNext }

# Chi tiết hội thoại (full thread + Customer360)
GET /api/cskh/conversations/:id
→ ConversationDetailDto { id, channel, status, customer, preview, messages[], customer360, ... }

# Agent reply
POST /api/cskh/conversations/:id/reply
Body: { content: "text", agentId?: "agent-mvp" }
→ ConversationDetailDto (re-fetched, full thread)
```

### Data shape (FE types)

```ts
type ChannelCode = 'zalo' | 'app' | 'facebook' | 'email' | 'voip'
type ConvStatus = 'active' | 'closed' | 'archived'
type MessageFrom = 'cust' | 'agent' | 'bot' | 'sys'

interface ConversationListItem {
  id: string
  channel: ChannelCode
  status: ConvStatus
  customer: { id: string | null; name: string }
  preview: string                    // lastMessage content
  lastMessageAt: string              // ISO
  unread: number                     // Phase 1: luôn 0
}

interface ConversationDetail extends ConversationListItem {
  messages: Message[]
  customer360: Customer360 | null
  createdAt: string
  updatedAt: string
}

interface Message {
  id: string
  from: MessageFrom                  // 'cust' | 'agent' | 'bot' | 'sys'
  text: string
  attachments: string[]
  time: string                       // ISO
}

interface Customer360 {
  id: string
  name: string
  phone?: string
  address?: string
  custType?: string
  contract?: string
}
```

### Envelope (mọi response)

```ts
{ success: true,  data: T, error: null }                          // success
{ success: false, data: null, error: { code: string, detail?: string | null } }  // error
```

FE unwrap: `response.data`. Error code: `NOT_FOUND`, `BAD_REQUEST`, `INTERNAL_SERVER_ERROR`.

### Field mapping cũ → mới (FE refactor)

| FE cũ (Ticket) | FE mới (Conversation) | Ghi chú |
|---|---|---|
| `t.name` | `c.customer.name` | Customer name |
| `t.channel` | `c.channel` | Giữ nguyên ('zalo'/'app'/...) |
| `t.preview` | `c.preview` | Last message |
| `t.msgTime` | `fmtRelative(c.lastMessageAt)` | ISO → relative |
| `t.messages[].from` | `c.messages[].from` | Giữ ('cust'/'agent') |
| `t.messages[].text` | `c.messages[].text` | Giữ |
| `t.messages[].time` | `fmtClock(c.messages[].time)` | ISO → HH:mm |
| `t.maHb` | `c.customer360?.contract` | Từ Customer360 |
| `t.phone` | `c.customer360?.phone` | Từ Customer360 |
| `t.status` (new/progress/...) | `c.status` (active/closed/archived) | **KHÁC enum!** |

**Drop tạm** (Phase 1.5+): topic badge, priority pill, sentiment, SLA bar, AI summary, code.

## 3. Screen 2: Ticket & SLA Kanban

### Endpoints

```bash
# Kanban (tickets theo stage + SLA enrichment)
GET /tickets/kanban
→ { total, slaBreachedCount, slaWarningCount, RECEIVED: [], IN_PROGRESS: [], WAITING: [], RESOLVED: [], CLOSED: [] }

# Ticket detail
GET /tickets/:id
→ { id, conversationId, channel, title, stage, priority, assignee, slaDeadline, ... }

# Advance stage (kéo thả Kanban)
POST /tickets/:id/advance
Body: { newStage: "IN_PROGRESS" }  // RECEIVED|IN_PROGRESS|WAITING|RESOLVED|CLOSED
→ { ok: true, ticketId, stage }
```

### Data shape

```ts
interface TicketKanbanItem {
  id: string                     // "SC-MS422JLT"
  conversationId: string | null
  channel: string                // ZALO/APP/FACEBOOK/... (UPPERCASE — khác inbox!)
  title: string
  stage: string                  // RECEIVED|IN_PROGRESS|WAITING|RESOLVED|CLOSED
  priority: string               // P0|P1|P2|P3
  assignee: string | null
  createdAt: number              // timestamp
  slaDeadline: number            // timestamp
  slaRemainingMs: number
  slaColor: 'green'|'yellow'|'red'|'gray'
  slaWarning: boolean
  slaBreached: boolean
}
```

### Stage transitions (state machine)

```
RECEIVED → IN_PROGRESS → WAITING → RESOLVED → CLOSED
                ↑                      |
                └── CSAT reopen ───────┘ (FR27, < 3★)
```

## 4. Realtime (socket.io)

### Kết nối

```ts
import { io } from 'socket.io-client'

// Fake JWT (MVP — gateway chỉ base64-decode payload, không verify signature)
const b64u = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url')
const fakeJwt = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: 'agent-mvp' })}.sig`

const socket = io('http://localhost:4001/agent', {
  transports: ['websocket'],
  auth: { token: fakeJwt },        // hoặc real JWT từ Keycloak
})
```

### Events FE subscribe

| Event | Payload | Khi nào | Screen affected |
|---|---|---|---|
| `interaction.received` | `{ conversationId, messageId, from, text, channel, time }` | Customer gửi tin mới | Inbox (push message + bump list) |
| `conversation.started` | `{ conversationId, channel, customerName, time }` | Hội thoại mới | Inbox (add to list) |
| `sla.warning` | `{ ticketId, conversationId, slaDeadline, remainingMs, severity, stage, assignee }` | SLA sắp hết/quá hạn | Ticket Kanban (update SLA color) |

### Pattern (TanStack Query)

```ts
// Khi nhận interaction.received → invalidate queries
socket.on('interaction.received', (p) => {
  queryClient.invalidateQueries({ queryKey: ['inbox'] })
  if (p.conversationId === activeId) {
    queryClient.invalidateQueries({ queryKey: ['conversation', p.conversationId] })
  }
})

socket.on('sla.warning', (p) => {
  queryClient.invalidateQueries({ queryKey: ['kanban'] })
})
```

## 5. Env config

```env
# .env (water-business-cskh-fe)
VITE_API_URL=http://localhost:4001          # BE omichannel_be
VITE_REALTIME_URL=http://localhost:4001/agent  # Socket.io namespace /agent
VITE_ENABLE_MSW=false                        # Tắt MSW (hoặc passthrough cho /api/cskh/inbox + /conversations)
VITE_AUTH_MODE=mock                          # MVP (mock-auth client-side)
VITE_USE_MOCK_AUTH=true
```

## 6. Migration guide (FE refactor checklist)

### Inbox hợp nhất (Conversation-centric)

- [ ] Tạo `entities/conversation/` (types matching §2 + Zod schemas)
- [ ] API hooks: `useInbox()`, `useConversation(id)`, `useReply()`
- [ ] Refactor [pages/inbox/index.tsx](pages/inbox/index.tsx): `useTickets` → `useInbox`, Ticket → Conversation
- [ ] Customer360 panel: dùng `conversation.customer360` thật (bỏ hardcode TYPE/stats/history)
- [ ] Channel/status enum: switch sang Conversation (active/closed/archived, lowercase)
- [ ] Time helpers: `fmtClock(iso)` + `fmtRelative(iso)` cho message time + lastMessageAt
- [ ] Drop tạm: topic badge, priority, sentiment, SLA bar, AI summary

### Ticket Kanban (mới hoặc refactor page tickets)

- [ ] Page riêng `/tickets` (hoặc giữ `/tickets` hiện nhưng đổi data source)
- [ ] API: `useKanban()` → `GET /tickets/kanban` (KHÔNG qua `/api/cskh/` prefix — direct `/tickets/`)
- [ ] Kanban columns: RECEIVED, IN_PROGRESS, WAITING, RESOLVED, CLOSED
- [ ] SLA badge per ticket (color: green/yellow/red/gray)
- [ ] Drag-drop advance: `POST /tickets/:id/advance { newStage }`

### Realtime

- [ ] `shared/api/realtime/socket-io-client.ts` (SocketIoRealtimeClient)
- [ ] Subscribe 3 events (interaction.received, conversation.started, sla.warning)
- [ ] onCleanup unsub

## 7. CORS

BE đã enable `@fastify/cors` cho `http://localhost:4322` (FE dev port). Nếu FE chạy port khác → update `main.ts` CORS origins.

## 8. Test E2E (FE + BE)

```bash
# 1. Start BE
cd omichannel_be && PORT=4001 bun run start

# 2. Seed data
bun scripts/seed-conversations.ts    # 2 hội thoại (Zalo + FB)

# 3. Start FE
cd water-business-cskh-fe && bun run dev   # http://localhost:4322

# 4. Test:
# - Inbox: hiện hội thoại thật từ BE
# - Click hội thoại → thread messages
# - Reply → message mới xuất hiện
# - Realtime: mở 2 tab, 1 tab gửi reply → tab kia auto-update
```
