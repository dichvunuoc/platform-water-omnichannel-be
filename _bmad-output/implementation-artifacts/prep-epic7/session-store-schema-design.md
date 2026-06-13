# Preparation: Session Store Schema Design

**Mục đích:** Thiết kế schema cho session store trước khi Epic 7 Story 7.1 bắt đầu.
**Người phụ trách:** Elena (Junior Dev) — review bởi Charlie (Senior Dev)
**Ngày:** 2026-06-12

---

## 1. Redis Key Structure

### Session Metadata — Hash

```
Key:   session:{userId}
Type:  Hash (HSET/HGETALL)
TTL:   86400s (24h) — configurable 86400-172800 (24-48h)
```

| Field | Type | Mô tả |
|-------|------|--------|
| `sessionId` | string | UUID — unique per session |
| `userId` | string | UserID từ auth layer |
| `channel` | string | Channel hiện tại: `zalo` \| `web` \| `hotline` \| `counter` |
| `createdAt` | string | ISO 8601 timestamp |
| `updatedAt` | string | ISO 8601 timestamp — cập nhật mỗi event |
| `eventCount` | number | Tổng số events trong session |

### Session Events — Sorted Set

```
Key:   session:{userId}:events
Type:  Sorted Set (ZADD/ZRANGEBYSCORE)
TTL:   86400s (24h) — cùng TTL với session metadata
Score: Unix timestamp (milliseconds)
Value: JSON string của event
```

### Event Payload Schema

```typescript
interface SessionEvent {
  id: string;           // UUID
  type: SessionEventType;
  timestamp: string;    // ISO 8601
  channel: ChannelType;
  content: Record<string, unknown>;
}

type SessionEventType =
  | 'zalo_message_received'
  | 'call_started'
  | 'call_completed'
  | 'ticket_created'
  | 'ticket_status_changed'
  | 'payment_completed'
  | 'payment_failed'
  | 'notification_sent'
  | 'invoice_viewed'
  | 'alert_acknowledged'
  | 'session_started'
  | 'session_continued';

type ChannelType = 'zalo' | 'web' | 'hotline' | 'counter';
```

## 2. TTL Strategy

| Parameter | Giá trị | Ghi chú |
|-----------|---------|---------|
| Default TTL | 86400s (24h) | Configurable qua env `SESSION_TTL_SECONDS` |
| Max TTL | 172800s (48h) | Per architecture spec (NFR-R3) |
| TTL refresh | Mỗi event write | Lua script refresh TTL trên CẢ session key và events key |
| Persistence | Redis AOF | Bắt buộc — session survive restart (NFR-R4) |

## 3. Access Patterns

| Thao tác | Redis Command | O() | Use case |
|----------|---------------|-----|----------|
| Append event | `EVAL SESSION_APPEND_LUA` | O(log N) | Mỗi KH interaction |
| Get full session | `HGETALL session:{userId}` | O(1) | Load session context |
| Get recent events (last 2h) | `ZRANGEBYSCORE ... {now-2h} {now}` | O(log N + M) | Session continuation |
| Get all events | `ZRANGEBYSCORE ... 0 +inf` | O(N) | Session history (admin) |
| Check session exists | `EXISTS session:{userId}` | O(1) | Auth middleware |
| Get event count | `HGET session:{userId} eventCount` | O(1) | Dashboard metrics |

## 4. Atomicity Requirements

**SESSION_APPEND_LUA script phải đảm bảo trong 1 round-trip:**

1. `ZADD session:{userId}:events {score} {event_json}` — append event
2. `EXPIRE session:{userId}:events {ttl}` — refresh TTL events key
3. `HSET session:{userId} updatedAt {now} eventCount {count+1}` — update metadata
4. `EXPIRE session:{userId} {ttl}` — refresh TTL metadata key

**KHÔNG BAO GIỜ** thực hiện riêng lẻ — race condition khi KH tương tác đa kênh đồng thời.

## 5. Integration Points với Codebase Hiện Tại

### Inject Dependency

```typescript
// Session service sẽ inject:
constructor(
  @Inject(CACHE_SERVICE_TOKEN) private readonly cacheService: ICacheService,
) {}

// Truy cập raw Redis client qua:
const client = (this.cacheService as RedisCacheService).getClient();
await client.eval(SESSION_APPEND_LUA, ...);
```

### ICacheService Extension (Cần thiết cho Epic 7)

```typescript
// Option A: Thêm method vào ICacheService
interface ICacheService {
  // ... existing methods
  eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown>;
}

// Option B: Tạo ISessionStore interface riêng
interface ISessionStore {
  appendEvent(userId: string, event: SessionEvent): Promise<void>;
  getSession(userId: string): Promise<SessionMetadata | null>;
  getEvents(userId: string, from?: number, to?: number): Promise<SessionEvent[]>;
}
```

**Khuyến nghị:** Option B — tạo `ISessionStore` riêng. Session store là domain concern, không phải generic cache. `ICacheService` giữ role làm cache layer.

## 6. Key Naming Convention

```
session:{userId}              → Hash: session metadata
session:{userId}:events       → Sorted Set: session events
```

Ví dụ:
```
session:USR-12345             → metadata hash
session:USR-12345:events      → events sorted set
```

**Không dùng prefix** — khác với cache keys (`cache:port:*`), session keys dùng namespace riêng.

## 7. Test Strategy cho Lua Script Spike

1. **Unit test standalone** — Chạy Lua script trực tiếp trên Redis test instance
2. **Concurrency test** — 100 goroutines cùng append events, verify không mất data
3. **TTL test** — Verify TTL refresh đúng sau mỗi write
4. **Atomicity test** — Verify metadata (eventCount, updatedAt) luôn consistent với events
5. **Edge cases** — Empty session, expired session, very large event payloads

---

_Tài liệu này là input cho Epic 7 Story 7.1 — Session Store & Event Recording._
