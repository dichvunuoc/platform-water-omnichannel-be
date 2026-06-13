# Story 1.2: Resilient Communication Layer

Status: done

<!-- AC verification (2026-06-10 retro): All 8 ACs functionally delivered across Stories 1.1, 1.4, and 4.2.
Implementation lives in: PortRegistry, CircuitBreakerState, FallbackProvider, InboundIdempotencyService,
PortHttpClient, api-endpoints.yaml. Sprint-status correctly shows "done". -->

## Story

As a **customer using the app**,
I want every API call to be protected against downstream failures and duplicate processing,
so that I always get a response even when a backend service is down, and I never get charged twice for the same payment.

## Acceptance Criteria

### AC1: Per-Port Circuit Breaker Opens on Failure
**Given** a downstream service (e.g. Invoice Service) starts returning 5xx errors or timing out
**When** the failure rate exceeds 50% within the configured window (default 10s, min 5 requests)
**Then** the per-port Circuit Breaker opens for that specific port only
**And** subsequent calls fallback to cached data (if available) or a graceful message
**And** other ports (Payment, Ticketing, etc.) remain fully operational — unaffected.

### AC2: Circuit Breaker OPEN Returns Cached Response with Timestamp
**Given** the Circuit Breaker is OPEN for a port
**When** a KH requests data from that port (e.g. invoice list)
**Then** the system returns the last cached response with a timestamp label (e.g. "updated at 14:30")
**And** a structured warning is logged with correlation ID and port name.

### AC3: Circuit Breaker HALF_OPEN Probe
**Given** the Circuit Breaker is OPEN for a port
**When** the reset timeout elapses (default 10s)
**Then** the Circuit Breaker transitions to HALF_OPEN
**And** sends a single probe request — if successful, closes the circuit; if failed, re-opens.

### AC4: Static Cache Tier (TTL 12-24h)
**Given** port config specifies `cacheTier: static` (e.g. contract, tariff)
**When** a successful response is received
**Then** the response is cached with TTL 12-24h in Redis key `cache:port:{portName}:{hash}`.

### AC5: Dynamic Cache Tier (TTL 5-15 min)
**Given** port config specifies `cacheTier: dynamic` (e.g. invoice, ticket)
**When** a successful response is received
**Then** the response is cached with TTL 5-15 min in Redis.

### AC6: Transaction Cache Tier (NO CACHE)
**Given** port config specifies `cacheTier: none` (e.g. payment, document)
**When** a call is made
**Then** no caching occurs — every request hits the downstream service live.

### AC7: Inbound Idempotency
**Given** an inbound webhook request arrives (e.g. Zalo callback)
**When** the `idempotencyKey` is extracted (hash of messageId/callId)
**Then** Redis `GET idempotency:{hash}` is checked first
**And** if EXISTS → return cached response (200 OK, no reprocessing)
**And** if NOT EXISTS → process normally → `SET idempotency:{hash} = result` with TTL 24h.

### AC8: Outbound Idempotency
**Given** an outbound POST/PUT call from BFF to any downstream service
**When** the request is constructed
**Then** the `x-idempotency-key` header is automatically injected as `{correlationId}:{endpointHash}`
**And** the header is included in every `PortHttpClient` outbound call.

## Tasks / Subtasks

- [ ] Task 1: Enhance PortRegistry with Circuit Breaker integration (AC: #1, #2, #3)
  - [ ] 1.1 Update `PortRegistry` to create a `CircuitBreakerState` instance per registered port
  - [ ] 1.2 In `execute()`: wrap adapter call in CB logic — call `cb.recordSuccess()` on 2xx, `cb.recordFailure()` on 5xx/timeout
  - [ ] 1.3 When `cb.getState() === OPEN`: skip adapter call, return `FallbackProvider.getCached()` data
  - [ ] 1.4 When `cb.shouldAttemptReset()` (HALF_OPEN): allow single probe, close or re-open based on result
  - [ ] 1.5 Add `_metadata.cachedAt` timestamp to fallback responses so KH sees "updated at HH:MM"
  - [ ] 1.6 Log structured warning on CB open/fallback with `correlationId`, `portName`, `cbState`

- [ ] Task 2: Implement tiered cache read/write in PortRegistry (AC: #4, #5, #6)
  - [ ] 2.1 Before adapter call: check `cacheTier` from `EndpointConfigService` — skip cache for `'transaction'` or `useCache: false`
  - [ ] 2.2 Cache read: `RedisCacheService.get(cacheKey)` where `cacheKey = cache:port:{portName}:{hashOfParams}`
  - [ ] 2.3 Cache write on success: `RedisCacheService.set(cacheKey, data, ttl)` with tier-based TTL:
  - [ ] `static` → 43200s (12h)
  - [ ] `dynamic` → 900s (15 min)
  - [ ] `transaction` → skip (no write)
  - [ ] 2.4 Hash function for cache key: `JSON.stringify(params) → simple hash` (consistent, deterministic)
  - [ ] 2.5 On cache hit: return data immediately with `_metadata.cachedAt` timestamp, skip downstream call

- [ ] Task 3: Implement inbound idempotency service (AC: #7)
  - [ ] 3.1 Create `src/libs/shared/port/inbound-idempotency.service.ts`
  - [ ] 3.2 `check(key: string): Promise<IdempotencyResult>` — `Redis GET idempotency:{key}` → `{ hit: boolean, data?: any }`
  - [ ] 3.3 `store(key: string, result: any): Promise<void>` — `Redis SET idempotency:{key} = JSON.stringify(result)` with TTL 86400s (24h)
  - [ ] 3.4 Use existing `RedisCacheService` (inject via `CACHE_SERVICE_TOKEN`)
  - [ ] 3.5 Key format: `idempotency:{hash}` where hash = SHA-256 of messageId/callId

- [ ] Task 4: Enhance PortHttpClient with outbound idempotency (AC: #8)
  - [ ] 4.1 In `PortHttpClient.request()`: inject `x-idempotency-key` header for all POST/PUT calls
  - [ ] 4.2 Header value: `{correlationId}:{portName}:{hashOfParams}` — deterministic per unique request
  - [ ] 4.3 GET/DELETE calls: no idempotency key needed (cache handles GET dedup)
  - [ ] 4.4 Log idempotency key at debug level for tracing

- [ ] Task 5: Wire idempotency into PortRegistry execute flow (AC: #7, #8)
  - [ ] 5.1 Add optional `idempotencyKey` param to `PortRegistry.execute()`
  - [ ] 5.2 When provided: check inbound idempotency FIRST (before cache check)
  - [ ] 5.3 On idempotency hit: return cached result immediately, log at info level
  - [ ] 5.4 On new processing: after successful execution → store result via `InboundIdempotencyService.store()`

- [ ] Task 6: Register idempotency providers in PortModule (AC: #7)
  - [ ] 6.1 Add `InboundIdempotencyService` to `PortModule` providers
  - [ ] 6.2 Export `InboundIdempotencyService` from barrel `index.ts`

- [ ] Task 7: Write comprehensive tests (AC: all)
  - [ ] 7.1 `port-registry.service.spec.ts` — CB open/close/half-open, cache tiers, idempotency
  - [ ] 7.2 `inbound-idempotency.service.spec.ts` — check hit/miss, store, TTL, key format
  - [ ] 7.3 `port-http-client.service.spec.ts` — idempotency header injection on POST/PUT only
  - [ ] 7.4 Integration scenario: CB OPEN → cached response → CB HALF_OPEN → probe → close

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story **extends** the Port Registry built in Story 1.1. It does NOT create new infrastructure from scratch — it adds resilience, caching, and idempotency layers into the existing `PortRegistry.execute()` flow.

#### What Story 1.1 Built (ASSUME COMPLETE)

| Component | Location | What It Provides |
|-----------|----------|-----------------|
| PortRegistry | `src/libs/shared/port/port-registry.service.ts` | `register()`, `execute()` — route adapter calls |
| PortHttpClient | `src/libs/shared/port/port-http-client.service.ts` | `fetch` + timeout + correlation ID |
| MockAdapterBase | `src/libs/shared/port/mock-adapter.base.ts` | JSON read + Zod validation |
| InternalAdapterBase | `src/libs/shared/port/internal-adapter.base.ts` | HTTP call via PortHttpClient |
| EndpointConfigService | `src/libs/shared/endpoint-config/endpoint-config.service.ts` | YAML config + chokidar reload |
| PortModule | `src/libs/shared/port/port.module.ts` | Global NestJS module |

#### What ALREADY EXISTS — DO NOT REINVENT

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **CircuitBreakerState** | `src/libs/shared/resilience/circuit-breaker.state.ts` | `recordSuccess()`, `recordFailure()`, `getState()`, `shouldOpen()`, `open()`, `close()`, `halfOpen()`, `shouldAttemptReset()`, `getMetrics()`. **USE THIS** — one instance per port. |
| **FallbackProvider** | `src/libs/shared/resilience/fallback.provider.ts` | `register(portName, fallbackFn)`, `execute(portName, params)`, `getCached(portName)`, `setCached(portName, data)`. **USE THIS** for CB OPEN → fallback flow. Also has `CommonFallbacks` utility. |
| **RedisCacheService** | `src/libs/shared/caching/redis-cache.service.ts` | `get<T>(key)`, `set<T>(key, value, ttl?)`, `delete(key)`, `exists(key)`. **USE THIS** for all caching. Inject via `CACHE_SERVICE_TOKEN`. |
| **IdempotencyService** | `src/libs/shared/cqrs/idempotency/idempotency.service.ts` | Already has idempotency logic with `@Idempotent` decorator. **Review first** — may extend or use as reference. The inbound idempotency for webhooks has different key format (`idempotency:{hash}`) vs what CQRS idempotency uses. Create a separate `InboundIdempotencyService` in port module. |
| **RequestContextProvider** | `src/libs/shared/context/request-context.provider.ts` | `current()` → `IRequestContext` with `correlationId`. **USE THIS** for outbound idempotency key generation. |
| **Structured Logger** | `src/libs/shared/observability/structured-logger.service.ts` | All CB/cache/idempotency logging. |
| **Exception Classes** | `src/libs/core/common/exceptions/` | `NotFoundException`, `ForbiddenException`, `BusinessRuleException`, `ValidationException`. NEVER `new Error()`. |

#### Circuit Breaker Integration Pattern

```typescript
// In PortRegistry — per-port CB state
private circuitBreakers = new Map<string, CircuitBreakerState>();

register(name: string, mockAdapter: IPortAdapter, liveAdapter: IPortAdapter, config: PortConfig): void {
  // Create per-port CB with config thresholds
  const cb = new CircuitBreakerState({
    errorThreshold: config.circuitBreaker?.errorThreshold ?? 50,
    resetTimeout: config.circuitBreaker?.resetTimeout ?? 10000,
    minRequests: config.circuitBreaker?.minRequests ?? 5,
  });
  this.circuitBreakers.set(name, cb);

  // Register fallback function
  this.fallbackProvider.register(name, async () => {
    const cached = await this.getFromCache(name, {});
    return cached ?? { _metadata: { degraded: true, message: 'Service temporarily unavailable' } };
  });

  // ... store in ports Map
}

async execute<T>(portName: string, method: string, params: Record<string, any>): Promise<T> {
  const cb = this.circuitBreakers.get(portName)!;
  const config = this.configService.getEndpointConfig(portName);

  // 1. Check CB state
  if (cb.getState() === CircuitState.OPEN) {
    if (cb.shouldAttemptReset()) {
      cb.halfOpen(); // Allow single probe
    } else {
      // Return fallback (cached or graceful)
      this.logger.warn('Circuit breaker OPEN', { portName, correlationId: this.getCorrelationId() });
      return this.fallbackProvider.execute(portName, params) as T;
    }
  }

  // 2. Check cache (skip for transaction tier or useCache: false)
  if (config.cacheTier !== 'transaction' && params.useCache !== false) {
    const cached = await this.getFromCache(portName, method, params);
    if (cached) return { ...cached, _metadata: { cachedAt: cached._cachedAt } } as T;
  }

  // 3. Execute via adapter
  try {
    const result = await adapter.execute(method, params);
    cb.recordSuccess();

    // 4. Cache result (skip for transaction tier)
    if (config.cacheTier !== 'transaction') {
      await this.setToCache(portName, method, params, result, config.cacheTier);
    }
    return result as T;
  } catch (error) {
    cb.recordFailure();

    if (cb.shouldOpen()) {
      cb.open();
      this.logger.error('Circuit breaker tripped OPEN', { portName, error: error.message });
    }
    throw error; // Re-throw — caller decides fallback behavior
  }
}
```

#### Cache Key Strategy

```
Key pattern: cache:port:{portName}:{hashOfParams}
Hash function: deterministic, consistent across restarts

TTL by tier:
  static    → 43200s (12h)
  dynamic   → 900s  (15 min)
  transaction → NO CACHE (never write)
```

Hash function for cache keys:

```typescript
private hashParams(params: Record<string, any>): string {
  // Deterministic hash — sort keys, stringify, then hash
  const sorted = Object.keys(params).sort().reduce((acc, key) => {
    acc[key] = params[key];
    return acc;
  }, {} as Record<string, any>);
  const str = JSON.stringify(sorted);
  // Simple hash (or use crypto.createHash('sha256').update(str).digest('hex').slice(0, 16))
  return createHash('sha256').update(str).digest('hex').slice(0, 16);
}
```

#### Inbound Idempotency Key Format

```
Key: idempotency:{sha256Hash}
Where hash = SHA-256(messageId | callId) — the raw webhook identifier
TTL: 86400s (24h)

Flow:
  1. Adapter receives webhook → extract messageId/callId
  2. Hash → idempotencyKey
  3. Redis GET idempotency:{hash}
  4. EXISTS → return cached response (200 OK)
  5. NOT EXISTS → process → Redis SET idempotency:{hash} = result, TTL 24h
```

#### Outbound Idempotency Header

```
Header: x-idempotency-key
Value: {correlationId}:{portName}:{paramsHash}
Applied: POST and PUT calls only (via PortHttpClient)
NOT applied: GET, DELETE (cache handles GET dedup, DELETE is idempotent by spec)
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Create a single CB for all ports | Per-port `CircuitBreakerState` instance (30 total) |
| Create new cache service | Inject `CACHE_SERVICE_TOKEN` → `RedisCacheService` |
| Create new idempotency from scratch without checking existing | Review `IdempotencyService` in `libs/shared/cqrs/idempotency/`, then create `InboundIdempotencyService` in port module (different key format/scope) |
| Cache transaction-tier ports | `cacheTier: 'transaction'` → skip cache read AND write |
| Return `null` when CB is OPEN and no cache | Return graceful response with `_metadata.degraded: true` and message |
| Use `setTimeout` for CB reset timing | Use `CircuitBreakerState.shouldAttemptReset()` which tracks time internally |
| Hardcode TTL values | Read from config via `EndpointConfigService.getEndpointConfig()` |
| Store full response body in idempotency key | Store lightweight result summary (status + key data), not full payload |

### 🧪 Testing Requirements

**Key test scenarios:**

1. **CB Opens on failure threshold** — Mock adapter to fail 6/10 calls in 10s window → verify `cb.getState() === OPEN`
2. **CB OPEN returns cached data** — Pre-populate cache → force CB OPEN → verify cached data returned with `_metadata.cachedAt`
3. **CB OPEN with no cache returns graceful** — Force CB OPEN, no cache → verify `{ _metadata: { degraded: true } }` returned
4. **CB HALF_OPEN probe** — Force CB OPEN → wait reset timeout → verify single probe → success closes circuit
5. **CB HALF_OPEN probe fails** — Force CB OPEN → probe fails → verify CB re-opens
6. **CB isolation** — Invoice port CB OPEN → verify Payment port still fully operational
7. **Static cache tier** — Successful call → verify `RedisCacheService.set()` called with TTL ~43200s
8. **Dynamic cache tier** — Successful call → verify TTL ~900s
9. **Transaction cache tier** — Successful call → verify `RedisCacheService.set()` NOT called
10. **Cache hit skips downstream** — Pre-populate cache → verify adapter NOT called
11. **Inbound idempotency hit** — Store result → call with same key → verify cached result returned, adapter NOT called
12. **Inbound idempotency miss** — New key → verify processing happens, result stored with 24h TTL
13. **Outbound idempotency header** — POST request → verify `x-idempotency-key` header present
14. **Outbound idempotency not on GET** — GET request → verify `x-idempotency-key` header NOT present

### Project Structure Notes

- New file: `src/libs/shared/port/inbound-idempotency.service.ts` — Inbound webhook dedup
- Modified files: `port-registry.service.ts`, `port-http-client.service.ts`, `port.module.ts`
- No new directories needed — everything extends the `src/libs/shared/port/` module from Story 1.1
- DI token pattern: `INBOUND_IDEMPOTENCY_SERVICE_TOKEN` in `port.interface.ts` or dedicated constants

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Port Response Cache Strategy]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns — Error Handling Chain]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns — Idempotency]
- [Source: _bmad-output/planning-artifacts/architecture.md#Anti-Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2: Resilient Communication Layer]
- [Source: _bmad-output/planning-artifacts/prd.md#FR35 (NO CACHE), FR69-FR70 (Idempotency)]
- [Source: _bmad-output/project-context.md#Idempotency — Two Boundaries]
- [Source: _bmad-output/project-context.md#Cache TTL Strategy]
- [Source: _bmad-output/project-context.md#Error Handling Chain]
- [Source: src/libs/shared/resilience/circuit-breaker.state.ts]
- [Source: src/libs/shared/resilience/fallback.provider.ts]
- [Source: src/libs/shared/caching/redis-cache.service.ts]
- [Source: src/libs/shared/cqrs/idempotency/idempotency.service.ts]
- [Source: src/libs/shared/context/request-context.provider.ts]

## Dev Agent Record

### Agent Model Used

SM Agent (Scrum Master — Bob)

### Debug Log References

### Completion Notes List

### File List
