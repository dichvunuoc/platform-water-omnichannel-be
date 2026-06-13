# Build & Swagger Test Error Report — 2026-06-12 (Updated)

**Project:** IOC Customer — Module CSKH
**Status:** ⚠️ Build fixed, runtime error prevents app startup without Redis
**Tests:** ✅ 112 suites, 1072 tests pass

---

## Phase 1: TypeScript Build Errors — ✅ ALL FIXED

### Summary of 13 build errors found and fixed:

| # | Category | Count | Fix Applied |
|---|----------|-------|-------------|
| 1 | Wrong import paths in Ticket module (`../../dtos/` → `../dtos/`) | 8 files | ✅ Fixed |
| 2 | ChannelType vs NotificationChannel mapping incomplete | 2 files | ✅ Fixed |
| 3 | Redis `zRange` with `byScore` → `zRangeByScore` | 1 file | ✅ Fixed |
| 4 | Test mock `undefined` type mismatch | 2 files | ✅ Fixed |
| 5 | `tsconfig.json` missing `include` for type augmentation | 1 file | ✅ Fixed |

**Verification:** `npx tsc --noEmit` → 0 errors. `npx jest` → 112 suites, 1072 tests pass.

---

## Phase 2: Runtime Errors — App Cannot Start Without Redis

### 🔴 RUNTIME-1: RedisSessionStore crashes when Redis unavailable

**File:** `src/modules/session/infrastructure/redis/redis-session.store.ts:31`

```
TypeError: this.cacheService.getClient is not a function
    at RedisSessionStore.getRawClient
    at RedisSessionStore.onModuleInit
```

**Root cause:** `PortModule` provides `CACHE_SERVICE_TOKEN` as either `RedisCacheService` (when `REDIS_HOST` set) or `MemoryCacheService` (fallback). `RedisSessionStore` injects this token and calls `getClient()` which returns a raw Redis client — but `MemoryCacheService` has no `getClient()` method.

**Impact:** App crashes during bootstrap when Redis is not configured. Entire app fails to start — no endpoints accessible.

**Fix options:**
1. **Add Redis to dev environment** — Set `REDIS_HOST=localhost` in `.env` after starting Redis
2. **Guard `RedisSessionStore` behind Redis availability** — Make `SessionModule` conditional: only register when Redis is available
3. **Add `getClient()` to `MemoryCacheService`** — Return a no-op/mock Redis client (not recommended — would silently fail)
4. **Create `InMemorySessionStore`** — Implement `ISessionStore` using Map/SortedMap for dev without Redis

**Recommended:** Option 1 for immediate fix, Option 4 for robust dev experience.

---

### 🟡 RUNTIME-2: Lua Script Not Copied to Dist on Build

**File:** `src/modules/session/infrastructure/redis/scripts/session-append.lua`

```
ENOENT: no such file or directory, open 'dist/src/modules/session/infrastructure/redis/scripts/session-append.lua'
```

**Root cause:** `nest build` only compiles `.ts` files. Non-TS assets (`.lua`, `.json`) are not copied to `dist/` by default.

**Status:** ✅ Fixed — Updated `nest-cli.json` with `assets` config:
```json
"assets": [
  { "include": "**/*.lua", "outDir": "dist/src" }
]
```

---

## Phase 3: Swagger Endpoint Test — BLOCKED by RUNTIME-1

The app cannot start without Redis. Endpoint testing requires Redis running.

**Full endpoint list to test once Redis is available:**

### Auth Module (4 endpoints)
| Method | Route | Notes |
|--------|-------|-------|
| POST | `/auth/register` | |
| POST | `/auth/login` | |
| POST | `/auth/logout` | |
| GET | `/auth/session` | |

### Customer Module (3 endpoints)
| Method | Route | Notes |
|--------|-------|-------|
| GET | `/customers/profile` | Requires auth |
| GET | `/customers/timeline` | Requires auth |
| GET | `/customers/:id/accounts` | Requires auth |

### Contract Module (4 endpoints)
| Method | Route | Notes |
|--------|-------|-------|
| GET | `/contracts` | Requires auth |
| GET | `/contracts/:id` | Requires auth |
| GET | `/contracts/:id/versions` | Requires auth |
| GET | `/contracts/:id/pdf` | Requires auth |

### Meter Module (5 endpoints)
| Method | Route | Notes |
|--------|-------|-------|
| GET | `/meters/customer/:id` | Requires auth |
| GET | `/meters/:id/readings` | Requires auth |
| GET | `/meters/:id/history` | Requires auth |
| GET | `/meters/:id/reading/:readingId` | Requires auth |
| GET | `/meters/:id/calibration` | Requires auth |

### Billing Module (7 endpoints)
| Method | Route | Notes |
|--------|-------|-------|
| GET | `/billing/tariffs` | Requires auth |
| GET | `/billing/tariffs/:contractId` | Requires auth |
| GET | `/billing/fees/:contractId` | Requires auth |
| GET | `/billing/invoices` | Requires auth |
| GET | `/billing/invoices/:id` | Requires auth |
| GET | `/billing/invoices/:id/pdf` | Requires auth |
| GET | `/billing/consumption/:contractId` | Requires auth |

### Payment Module (6 endpoints)
| Method | Route | Notes |
|--------|-------|-------|
| POST | `/payments/initiate` | Requires auth |
| GET | `/payments/history` | Requires auth |
| POST | `/payments/webhook/ipn` | `InterServiceApiKeyGuard` |
| POST | `/payments/auto-debit` | Requires auth |
| GET | `/payments/debt` | Requires auth |
| GET | `/payments/debt/history` | Requires auth |

### Ticket Module (7 endpoints)
| Method | Route | Notes |
|--------|-------|-------|
| POST | `/tickets` | Requires auth |
| GET | `/tickets/status/:id` | Requires auth |
| GET | `/tickets/history` | Requires auth |
| POST | `/tickets/feedback` | Requires auth |
| GET | `/tickets/kb/categories` | Requires auth |
| GET | `/tickets/kb/search` | Requires auth |
| GET | `/tickets/kb/:id` | Requires auth |

### Communication Module (7 endpoints)
| Method | Route | Notes |
|--------|-------|-------|
| GET | `/proactive-notifications/active` | Requires auth |
| GET | `/proactive-notifications/history` | Requires auth |
| POST | `/proactive-notifications/:alertId/acknowledge` | Requires auth |
| POST | `/notifications/dispatch` | Requires auth |
| GET | `/notifications/preferences` | Requires auth |
| PATCH | `/notifications/preferences` | Requires auth |
| GET | `/notifications/history` | Requires auth |

### Session Module (2 endpoints)
| Method | Route | Notes |
|--------|-------|-------|
| GET | `/sessions/me` | Requires auth + Redis |
| GET | `/sessions/me/events` | Requires auth + Redis |

### Webhook Module (3 endpoints)
| Method | Route | Notes |
|--------|-------|-------|
| POST | `/webhooks/payment/ipn` | `InterServiceApiKeyGuard` |
| POST | `/webhooks/ticket/status` | `InterServiceApiKeyGuard` |
| POST | `/webhooks/zalo/callback` | `ZaloSignatureGuard` + raw body |

### Health (1 endpoint)
| Method | Route | Notes |
|--------|-------|-------|
| GET | `/health` | Public |

---

## Files Modified (All Build Fixes)

| File | Change |
|------|--------|
| `ticket/application/commands/handle-ticket-webhook.command.ts` | Import path fix |
| `ticket/application/commands/rate-article.command.ts` | Import path fix |
| `ticket/application/commands/submit-feedback.command.ts` | Import path fix |
| `ticket/application/queries/get-article.query.ts` | Import path fix |
| `ticket/application/queries/get-kb-categories.query.ts` | Import path fix |
| `ticket/application/queries/get-ticket-history.query.ts` | Import path fix |
| `ticket/application/queries/get-ticket-status.query.ts` | Import path fix |
| `ticket/application/queries/search-articles.query.ts` | Import path fix |
| `communication/application/commands/handlers/dispatch-notification.handler.ts` | Complete channel mapping |
| `session/infrastructure/redis/redis-session.store.ts` | `zRange` → `zRangeByScore`, import `ChannelType` |
| `session/infrastructure/redis/redis-session.store.spec.ts` | Mock + assertions updated |
| `payment/application/queries/handlers/get-debt-history.handler.spec.ts` | `undefined as any` |
| `payment/application/queries/handlers/get-outstanding-debt.handler.spec.ts` | `undefined as any` |
| `tsconfig.json` | Added `"include": ["src/**/*"]` |
| `nest-cli.json` | Added `assets` for `.lua` files |

---

## Remaining Issues

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | App requires Redis to start — `RedisSessionStore` incompatible with `MemoryCacheService` | 🔴 HIGH | Open — needs Redis or in-memory session store |
| 2 | Swagger endpoint testing blocked by RUNTIME-1 | 🟡 MEDIUM | Blocked |
| 3 | Auth flow not tested (register/login/token) | 🟡 MEDIUM | Blocked |

---

_Report updated: 2026-06-12_
