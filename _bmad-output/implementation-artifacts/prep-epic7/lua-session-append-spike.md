# Preparation: Redis Lua Script Spike — SESSION_APPEND_LUA

**Mục đích:** Viết và test standalone Lua script cho atomic session event writes.
**Người phụ trách:** Charlie (Senior Dev)
**Ngày:** 2026-06-12

---

## 1. Lua Script — SESSION_APPEND_LUA

```lua
-- SESSION_APPEND_LUA
-- Atomic session event append + metadata update + TTL refresh
--
-- KEYS[1] = session:{userId}           (Hash — session metadata)
-- KEYS[2] = session:{userId}:events    (Sorted Set — session events)
--
-- ARGV[1] = event JSON string
-- ARGV[2] = TTL in seconds (e.g. 86400)
-- ARGV[3] = score (timestamp in milliseconds)
-- ARGV[4] = current ISO 8601 timestamp string
--
-- Returns: 1 on success

local sessionKey = KEYS[1]
local eventsKey = KEYS[2]
local event = ARGV[1]
local ttl = tonumber(ARGV[2])
local score = ARGV[3]
local updatedAt = ARGV[4]

-- 1. Append event to sorted set
redis.call('ZADD', eventsKey, score, event)

-- 2. Refresh TTL on events key
redis.call('EXPIRE', eventsKey, ttl)

-- 3. Get current event count (or default to 0 if new session)
local currentCount = tonumber(redis.call('HGET', sessionKey, 'eventCount') or '0')

-- 4. Update session metadata
redis.call('HSET', sessionKey, 'updatedAt', updatedAt, 'eventCount', tostring(currentCount + 1))

-- 5. Refresh TTL on session metadata key
redis.call('EXPIRE', sessionKey, ttl)

return 1
```

## 2. Standalone Test Script

```typescript
// spike/session-append-lua.test.ts
// Chạy trực tiếp: npx ts-node spike/session-append-lua.test.ts
// Yêu cầu: Redis chạy trên localhost:6379

import { createClient } from 'redis';

const SESSION_APPEND_LUA = `
local sessionKey = KEYS[1]
local eventsKey = KEYS[2]
local event = ARGV[1]
local ttl = tonumber(ARGV[2])
local score = ARGV[3]
local updatedAt = ARGV[4]

redis.call('ZADD', eventsKey, score, event)
redis.call('EXPIRE', eventsKey, ttl)

local currentCount = tonumber(redis.call('HGET', sessionKey, 'eventCount') or '0')
redis.call('HSET', sessionKey, 'updatedAt', updatedAt, 'eventCount', tostring(currentCount + 1))
redis.call('EXPIRE', sessionKey, ttl)

return 1
`;

async function runTests() {
  const client = createClient({ url: 'redis://localhost:6379' });
  await client.connect();

  const userId = 'USR-SPIKE-TEST';
  const sessionKey = `session:${userId}`;
  const eventsKey = `session:${userId}:events`;

  try {
    // Cleanup
    await client.del([sessionKey, eventsKey]);

    console.log('=== Test 1: Basic append ===');
    const result1 = await client.eval(
      SESSION_APPEND_LUA,
      { keys: [sessionKey, eventsKey], arguments: [
        JSON.stringify({ id: 'evt-1', type: 'session_started', channel: 'web' }),
        '86400',
        String(Date.now()),
        new Date().toISOString(),
      ]}
    );
    console.log('Result:', result1); // Expected: 1

    const metadata1 = await client.hGetAll(sessionKey);
    console.log('Metadata:', metadata1); // Expected: eventCount=1, updatedAt=...

    const events1 = await client.zRange(eventsKey, 0, -1);
    console.log('Events count:', events1.length); // Expected: 1

    console.log('\n=== Test 2: Multiple appends ===');
    for (let i = 2; i <= 5; i++) {
      await client.eval(
        SESSION_APPEND_LUA,
        { keys: [sessionKey, eventsKey], arguments: [
          JSON.stringify({ id: `evt-${i}`, type: 'invoice_viewed', channel: 'web' }),
          '86400',
          String(Date.now() + i * 1000),
          new Date().toISOString(),
        ]}
      );
    }

    const metadata2 = await client.hGetAll(sessionKey);
    console.log('Event count:', metadata2.eventCount); // Expected: 5

    const events2 = await client.zRange(eventsKey, 0, -1);
    console.log('Events in sorted set:', events2.length); // Expected: 5

    console.log('\n=== Test 3: TTL check ===');
    const ttlSession = await client.ttl(sessionKey);
    const ttlEvents = await client.ttl(eventsKey);
    console.log('TTL session:', ttlSession, '(should be ~86400)');
    console.log('TTL events:', ttlEvents, '(should be ~86400)');

    console.log('\n=== Test 4: Time-range query ===');
    const twoHoursAgo = Date.now() - 7200000;
    const recentEvents = await client.zRange(eventsKey, twoHoursAgo, Date.now() + 1000, { byScore: true });
    console.log('Recent events (last 2h):', recentEvents.length); // Expected: 5

    console.log('\n✅ All tests passed!');
  } finally {
    // Cleanup
    await client.del([sessionKey, eventsKey]);
    await client.quit();
  }
}

runTests().catch(console.error);
```

## 3. Concurrency Test (Stress Test)

```typescript
// spike/session-append-concurrency.test.ts
// Verify atomicity under concurrent writes

import { createClient } from 'redis';

// ... (same SESSION_APPEND_LUA as above)

async function concurrencyTest() {
  const client = createClient({ url: 'redis://localhost:6379' });
  await client.connect();

  const userId = 'USR-CONCURRENCY-TEST';
  const sessionKey = `session:${userId}`;
  const eventsKey = `session:${userId}:events`;

  try {
    await client.del([sessionKey, eventsKey]);

    const PARALLEL_WRITERS = 10;
    const EVENTS_PER_WRITER = 10;
    const TOTAL_EXPECTED = PARALLEL_WRITERS * EVENTS_PER_WRITER;

    console.log(`Writing ${TOTAL_EXPECTED} events from ${PARALLEL_WRITERS} parallel writers...`);

    const writers = Array.from({ length: PARALLEL_WRITERS }, (_, writerId) =>
      (async () => {
        const writerClient = createClient({ url: 'redis://localhost:6379' });
        await writerClient.connect();
        try {
          for (let i = 0; i < EVENTS_PER_WRITER; i++) {
            await writerClient.eval(
              SESSION_APPEND_LUA,
              { keys: [sessionKey, eventsKey], arguments: [
                JSON.stringify({ id: `w${writerId}-e${i}`, type: 'notification_sent', channel: 'zalo' }),
                '86400',
                String(Date.now()),
                new Date().toISOString(),
              ]}
            );
          }
        } finally {
          await writerClient.quit();
        }
      })()
    );

    await Promise.all(writers);

    // Verify
    const metadata = await client.hGetAll(sessionKey);
    const events = await client.zRange(eventsKey, 0, -1);

    console.log('Expected events:', TOTAL_EXPECTED);
    console.log('Actual events:', events.length);
    console.log('Event count in metadata:', metadata.eventCount);

    if (parseInt(metadata.eventCount) === TOTAL_EXPECTED && events.length === TOTAL_EXPECTED) {
      console.log('✅ Concurrency test PASSED — no data loss!');
    } else {
      console.log('❌ Concurrency test FAILED — data mismatch!');
    }
  } finally {
    await client.del([sessionKey, eventsKey]);
    await client.quit();
  }
}

concurrencyTest().catch(console.error);
```

## 4. Edge Cases để Test

| Case | Input | Expected |
|------|-------|----------|
| Session mới | Chưa có session key | Tự tạo metadata + events, eventCount=1 |
| Session hết hạn | TTL đã hết | Tạo mới session (eventCount reset về 1) |
| Event payload lớn | JSON > 10KB | Hoạt động bình thường (Redis value limit 512MB) |
| Score trùng | 2 events cùng timestamp | Cả 2 đều được ghi (Redis sorted set cho phép duplicate scores) |
| TTL refresh | Append vào session sắp hết | TTL được refresh về 86400s |

## 5. Integration Notes cho Epic 7

1. **Script loading**: Load script 1 lần khi module init → lưu SHA → dùng `EVALSHA` thay vì `EVAL` để tiết kiệm bandwidth
2. **Error handling**: Nếu `EVALSHA` trả về NOSCRIPT → fallback `EVAL` với full script
3. **Event dedup**: Mỗi event có `id` UUID — nếu cần dedup, kiểm tra trước khi append (không trong scope Lua script)
4. **ISessionStore interface**: Tạo interface riêng, inject qua `SESSION_STORE_TOKEN`

---

_Spike artifact cho Epic 7 Story 7.1. Test trước khi tích hợp vào NestJS._
