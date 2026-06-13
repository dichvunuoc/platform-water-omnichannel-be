-- src/modules/session/infrastructure/redis/scripts/session-append.lua
-- Atomic session event append + metadata update + TTL refresh
--
-- KEYS[1] = session:{userId}           (Hash — session metadata)
-- KEYS[2] = session:{userId}:events    (Sorted Set — session events)
--
-- ARGV[1] = event JSON string
-- ARGV[2] = TTL in seconds (e.g. 86400)
-- ARGV[3] = score (timestamp in milliseconds)
-- ARGV[4] = updatedAt ISO 8601 timestamp string
-- ARGV[5] = userId (for session initialization)
-- ARGV[6] = channel (for session initialization)
-- ARGV[7] = sessionId UUID (for session initialization)
--
-- Returns: 1 on success

local sessionKey = KEYS[1]
local eventsKey = KEYS[2]
local event = ARGV[1]
local ttl = tonumber(ARGV[2])
local score = ARGV[3]
local updatedAt = ARGV[4]
local userId = ARGV[5]
local channel = ARGV[6]
local sessionId = ARGV[7]

-- 1. Append event to sorted set
redis.call('ZADD', eventsKey, score, event)

-- 2. Refresh TTL on events key
redis.call('EXPIRE', eventsKey, ttl)

-- 3. Initialize session metadata on first write (HSETNX = set if not exists)
redis.call('HSETNX', sessionKey, 'sessionId', sessionId)
redis.call('HSETNX', sessionKey, 'userId', userId)
redis.call('HSETNX', sessionKey, 'channel', channel)
redis.call('HSETNX', sessionKey, 'createdAt', updatedAt)

-- 4. Get current event count (or default to 0 if new session)
local currentCount = tonumber(redis.call('HGET', sessionKey, 'eventCount') or '0')

-- 5. Update session metadata (always updated)
redis.call('HSET', sessionKey, 'updatedAt', updatedAt, 'eventCount', tostring(currentCount + 1))

-- 6. Refresh TTL on session metadata key
redis.call('EXPIRE', sessionKey, ttl)

return 1
