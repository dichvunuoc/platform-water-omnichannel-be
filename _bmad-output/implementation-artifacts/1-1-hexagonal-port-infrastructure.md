# Story 1.1: Hexagonal Port Infrastructure

Status: ready-for-dev

## Story

As a **platform developer**,
I want a centralized Port Registry with injectable adapters and endpoint configuration,
so that every downstream service call goes through a standardized, configurable interface that supports mock/live switching.

## Acceptance Criteria

### AC1: Port Registry Initialization
**Given** the BFF application starts up
**When** the PortRegistry initializes
**Then** it registers all configured ports from `config/api-endpoints.yaml`
**And** each port resolves to either MockAdapter or InternalAdapter based on the `adapter` config field.

### AC2: MOCK_MODE Override
**Given** `MOCK_MODE=true` in the environment
**When** any module calls `PortRegistry.execute()`
**Then** the system **forces** the use of MockAdapter regardless of individual endpoint configs
**And** reads from `mocks/{port}/{method}.json`
**And** validates against the Zod schema
**And** returns the normalized Port schema to the frontend.

### AC3: Hot-Reload via chokidar
**Given** the `api-endpoints.yaml` file is modified (e.g. adapter: mock → live)
**When** the chokidar file watcher detects the change
**Then** the EndpointConfigService reloads config for that port in < 100ms
**And** the next request uses the updated adapter without restart.

### AC4: Zero-Core-Change Port Addition
**Given** a developer needs to add a new downstream service
**When** they create a new Port interface + MockAdapter + config entry in `api-endpoints.yaml`
**Then** the new port is available via `PortRegistry.execute()` with zero changes to BFF core
**And** the existing port infrastructure (EndpointConfig, Port module) is unaffected.

### AC5: Per-Service Timeout
**Given** the `api-endpoints.yaml` has per-service timeout configuration
**When** a port call exceeds the configured timeout (default 3000ms)
**Then** the call is aborted and the timeout error is logged with correlation ID.

### AC6: Contract Validation Gate (Fail-to-Start)
**Given** the BFF application bootstraps in a non-production environment
**When** any `mocks/*.json` file fails to match its defined Zod schema
**Then** the application throws a fatal error and **fails to start**
**And** logs the exact schema mismatch details.

## Tasks / Subtasks

- [x] Task 1: Install dependencies (AC: all)
  - [x] Install `chokidar` and `yaml` packages via bun
  - [x] Verify `zod` ^4.2.1 is already installed (it is)
  - [x] Verify `redis` ^5.10.0 is already installed (it is)

- [x] Task 2: Create Endpoint Config Module (AC: #3)
  - [x] Create `src/libs/shared/endpoint-config/endpoint-config.interface.ts` — `EndpointConfig`, `PortEndpointConfig` types
  - [x] Create `src/libs/shared/endpoint-config/endpoint-config.service.ts` — loads YAML, chokidar watcher, reload on change
  - [x] Create `src/libs/shared/endpoint-config/endpoint-config.module.ts` — global NestJS module
  - [x] Create `src/libs/shared/endpoint-config/index.ts` — barrel export
  - [x] Create `config/api-endpoints.yaml` — all 30 service configs (14 MVP detailed + 16 Phase 2/3 compact)
  - [x] Create `config/api-endpoints.schema.ts` — Zod schema for YAML validation

- [x] Task 3: Create Port Interfaces & Base Types (AC: #1, #4)
  - [x] Create `src/libs/shared/port/port.interface.ts` — `IPort<TConfig, TResult>`, `IPortAdapter`, `PortConfig`, `PortEntry`
  - [x] Define cache tier enum: `'static' | 'dynamic' | 'transaction'`
  - [x] Define circuit breaker config shape within PortConfig

- [x] Task 4: Create MockAdapter Base Class (AC: #2, #6)
  - [x] Create `src/libs/shared/port/mock-adapter.base.ts`
  - [x] Read JSON from `mocks/{portName}/{methodName}.json`
  - [x] Validate response against Zod schema (provided per-adapter)
  - [x] On validation failure in non-production: throw fatal error with schema mismatch details
  - [x] On validation failure in production: log warning, return raw data (graceful)

- [x] Task 5: Create InternalAdapter Base Class (AC: #1, #5)
  - [x] Create `src/libs/shared/port/internal-adapter.base.ts`
  - [x] HTTP call via native `fetch` with per-port timeout (AbortController)
  - [x] Timeout error includes correlation ID in log

- [x] Task 6: Create PortHttpClient Service (AC: #5)
  - [x] Create `src/libs/shared/port/port-http-client.service.ts`
  - [x] Wraps fetch + timeout (AbortController) + JWT injection (prepare for Story 1.4)
  - [x] Injects `x-correlation-id` header from RequestContextProvider
  - [x] Injects `x-idempotency-key` header for POST/PUT calls

- [x] Task 7: Create PortRegistry Service (AC: #1, #2, #4)
  - [x] Create `src/libs/shared/port/port-registry.service.ts`
  - [x] `register(name, mockAdapter, liveAdapter, config)` — stores in Map
  - [x] `execute<T>(portName, method, params)` — resolves adapter, checks MOCK_MODE, delegates
  - [x] Cache integration: check Redis cache before call, store after (by cacheTier)
  - [x] Circuit Breaker integration: wrap calls via existing `CircuitBreakerState`
  - [x] Fallback integration: use existing `FallbackProvider` when CB is OPEN

- [x] Task 8: Create AggregationService (AC: #4)
  - [x] Create `src/libs/shared/port/aggregation.service.ts`
  - [x] `Promise.allSettled` wrapper for fan-out calls
  - [x] Helper method to resolve individual settled results (fulfilled → value, rejected → null + log)

- [x] Task 9: Create Port Module (AC: all)
  - [x] Create `src/libs/shared/port/port.module.ts` — @Global NestJS module
  - [x] Register PortRegistry, PortHttpClient, AggregationService as providers
  - [x] Import EndpointConfigModule, existing caching, resilience, context modules
  - [x] Create `src/libs/shared/port/index.ts` — barrel export

- [ ] Task 10: Create initial mock data structure (AC: #2, #6)
  - [ ] Create `mocks/` directory structure for 14 MVP services
  - [ ] Create at least 1 sample mock file: `mocks/invoice/get-list.json` with realistic data
  - [ ] Create corresponding Zod schema in a shared schemas file

- [ ] Task 11: Register PortModule in app (AC: all)
  - [ ] Import `PortModule` in `src/app.module.ts`

- [ ] Task 12: Write tests (AC: all)
  - [ ] `port-registry.service.spec.ts` — register, execute mock, execute live, MOCK_MODE override
  - [ ] `endpoint-config.service.spec.ts` — load YAML, hot-reload detection
  - [ ] `mock-adapter.base.spec.ts` — JSON read, Zod validation pass/fail
  - [ ] `aggregation.service.spec.ts` — allSettled with partial failures
  - [ ] Integration test scaffolding in `test/integration/port-registry.spec.ts`

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story creates the **foundation layer** for all 30 downstream service integrations. Every subsequent story (1.2 through 7.3) depends on this Port Registry being correct and complete. Get this right and everything else flows.

#### What ALREADY EXISTS — DO NOT REINVENT

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **Circuit Breaker** | `src/libs/shared/resilience/circuit-breaker.state.ts` | `CircuitBreakerState` — has `recordSuccess()`, `recordFailure()`, `getState()`, `shouldOpen()`, `open()`, `close()`, `halfOpen()`. **USE THIS** instead of opossum. The architecture doc mentions opossum but the codebase already has a custom CB. |
| **Fallback Provider** | `src/libs/shared/resilience/fallback.provider.ts` | `FallbackProvider` — `register()`, `execute()`, `getCached()`, `setCached()`. Has `CommonFallbacks` utility. **USE THIS** for CB open → fallback flow. |
| **Redis Cache Service** | `src/libs/shared/caching/redis-cache.service.ts` | `RedisCacheService` with `get<T>()`, `set<T>(key, value, ttl?)`, `delete()`, `exists()`. **USE THIS** for port response caching. |
| **Cache Service Token** | `src/libs/core/constants/tokens.ts` | `CACHE_SERVICE_TOKEN` — inject via this token. |
| **Correlation ID** | `src/libs/shared/context/request-context.provider.ts` | `RequestContextProvider` — `current()` returns `IRequestContext` with `correlationId`. **USE THIS** in PortHttpClient. |
| **Context Token** | `src/libs/core/constants/tokens.ts` | `REQUEST_CONTEXT_TOKEN` |
| **Structured Logger** | `src/libs/shared/observability/structured-logger.service.ts` | Already available — use for all port-related logging. |
| **Exception Classes** | `src/libs/core/common/exceptions/` | `NotFoundException`, `ForbiddenException`, `BusinessRuleException`, `ValidationException`, `DomainException`, `ConflictException`, `ConcurrencyException`, `UnauthorizedException`. **NEVER** use `new Error()` or generic `HttpException`. |
| **CQRS Buses** | `src/libs/shared/cqrs/` | `COMMAND_BUS_TOKEN`, `QUERY_BUS_TOKEN` — handlers will call PortRegistry, not the other way around. |
| **DDD Base Classes** | `src/libs/core/domain/` | If any entity/VO is needed, extend `BaseEntity`, `AggregateRoot`, `BaseValueObject`. |
| **Reference Module Pattern** | `src/modules/order/`, `src/modules/product/` | Follow the exact same file/folder structure when creating port infrastructure. |

#### Key Architecture Decision — Circuit Breaker

**IMPORTANT:** The architecture document references `opossum` for circuit breaking, but the **existing codebase already has a fully implemented custom Circuit Breaker** in `src/libs/shared/resilience/`. This includes:
- `CircuitBreakerState` with full state machine (CLOSED → OPEN → HALF_OPEN)
- `FallbackProvider` with cache + fallback functions
- `CircuitBreakerInterceptor` and `@CircuitBreaker()` decorator
- Presets: `ExternalAPI`, `CriticalService`, `Database`, `Cache`

**Decision:** USE the existing custom CB. Do NOT install opossum. The PortRegistry will create a `CircuitBreakerState` instance per port (30 instances) and integrate with `FallbackProvider` for fallback responses.

#### Packages TO Install

```bash
bun add chokidar yaml
bun add -D @types/yaml
```

- `chokidar` — File watching for hot-reload of `api-endpoints.yaml`
- `yaml` — Parse YAML config file

#### Packages ALREADY Installed (verify, don't reinstall)

- `zod` ^4.2.1 ✅
- `redis` ^5.10.0 ✅ (for RedisCacheService)
- `@nestjs/common` ^11.0.1 ✅
- `@nestjs/cqrs` ^11.0.3 ✅
- `rxjs` ^7.8.1 ✅

#### Packages NOT to Install

- ~~`opossum`~~ — Use existing `CircuitBreakerState` instead
- ~~`jose`~~ — That's for Story 1.4 (Authenticated Token Lifecycle)
- ~~`better-auth`~~ — That's for Story 1.3 (Customer Registration)

### 📁 File Structure — New Files to Create

```
config/
├── api-endpoints.yaml                    # Per-service mock/live config (ALL 30 services)
└── api-endpoints.schema.ts               # Zod schema for YAML validation

mocks/
├── invoice/
│   └── get-list.json                     # Sample mock data for AC6 testing
├── auth/
├── customer-profile/
├── contract/
├── meter/
├── meter-reading/
├── tariff/
├── payment/
├── debt/
├── ticket/
├── knowledge-base/
├── proactive-notification/
├── notification/
└── document/

src/libs/shared/endpoint-config/
├── endpoint-config.interface.ts          # PortEndpointConfig, EndpointConfig types
├── endpoint-config.service.ts            # Load YAML + chokidar watch + reload
├── endpoint-config.module.ts             # @Global NestJS module
└── index.ts

src/libs/shared/port/
├── port.interface.ts                     # IPort, IPortAdapter, PortConfig, PortEntry
├── port-registry.service.ts              # Central registry (Map<name, PortEntry>)
├── port-http-client.service.ts           # fetch + timeout + correlation ID + idempotency key
├── mock-adapter.base.ts                  # Abstract base: read JSON → validate Zod → return
├── internal-adapter.base.ts              # Abstract base: HTTP call via PortHttpClient
├── aggregation.service.ts                # Promise.allSettled wrapper + result resolver
├── port.module.ts                        # @Global NestJS module
└── index.ts
```

### 🔧 Implementation Details

#### EndpointConfigService — Key Design

```typescript
@Injectable()
export class EndpointConfigService implements OnModuleInit, OnModuleDestroy {
  private config: Map<string, PortEndpointConfig> = new Map();
  private watcher: FSWatcher | null = null;

  constructor(
    private readonly logger: StructuredLogger,
    @Inject(CACHE_SERVICE_TOKEN) private readonly cacheService: ICacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadConfig();
    this.startWatcher();
  }

  getEndpointConfig(portName: string): PortEndpointConfig { ... }
  getAllConfigs(): Map<string, PortEndpointConfig> { ... }
  isMockMode(): boolean { return process.env.MOCK_MODE === 'true'; }

  private async loadConfig(): Promise<void> {
    // Read config/api-endpoints.yaml
    // Parse with yaml library
    // Validate against Zod schema (api-endpoints.schema.ts)
    // Store in Map
  }

  private startWatcher(): void {
    // chokidar.watch('config/api-endpoints.yaml', { ignoreInitial: true, awaitWriteFinish: ... })
    // On 'change' → reload config for changed port → emit event
    // Log reload with correlation ID
  }
}
```

#### PortRegistry — Key Design

```typescript
@Injectable()
export class PortRegistry {
  private ports = new Map<string, PortEntry>();

  constructor(
    private readonly configService: EndpointConfigService,
    @Inject(CACHE_SERVICE_TOKEN) private readonly cacheService: ICacheService,
    private readonly logger: StructuredLogger,
  ) {}

  register(name: string, mockAdapter: IPortAdapter, liveAdapter: IPortAdapter, config: PortConfig): void {
    // Create CircuitBreakerState per port
    // Register fallback via FallbackProvider
    // Store in Map
  }

  async execute<T>(portName: string, method: string, params: Record<string, any>): Promise<T> {
    // 1. Resolve adapter: MOCK_MODE override → config.adapter → mock/live
    // 2. Check cache (skip if transaction tier or useCache: false)
    // 3. Execute via CircuitBreakerState
    // 4. On success: cache result (by tier), record CB success
    // 5. On failure: record CB failure, fallback via FallbackProvider
    // 6. Log with correlation ID throughout
  }
}
```

#### Cache Key Strategy

```
Key pattern: cache:port:{portName}:{hashOfParams}
Examples:
  cache:port:customer-profile:USR-12345        → TTL: 43200s (12h, static)
  cache:port:invoice:USR-12345:2026-06          → TTL: 900s (15min, dynamic)
  cache:port:payment:PAY-001                    → NO CACHE (transaction)
```

Use existing `RedisCacheService.get()` / `set()` / `delete()` methods. Generate hash from params using `JSON.stringify()` → simple hash function.

#### MockAdapter Base — Zod Validation

```typescript
export abstract class MockAdapterBase implements IPortAdapter {
  constructor(
    protected readonly portName: string,
    protected readonly schemas: Record<string, ZodSchema>,
    protected readonly logger: StructuredLogger,
  ) {}

  async execute(method: string, params: Record<string, any>): Promise<any> {
    const filePath = path.join(process.cwd(), 'mocks', this.portName, `${method}.json`);
    const rawData = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    const schema = this.schemas[method];

    if (schema) {
      const result = schema.safeParse(rawData);
      if (!result.success) {
        if (process.env.NODE_ENV !== 'production') {
          throw new Error(`Mock contract violation [${this.portName}/${method}]: ${result.error.message}`);
        }
        this.logger.warn(`Mock contract violation [${this.portName}/${method}]`, { error: result.error });
      }
      return result.data;
    }
    return rawData;
  }
}
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Install `opossum` — existing CB is sufficient | Use `CircuitBreakerState` from `libs/shared/resilience/` |
| Create a new cache service | Inject `CACHE_SERVICE_TOKEN` → `RedisCacheService` |
| Use `fetch()` directly for downstream calls | All calls go through `PortRegistry.execute()` |
| Use `new Error()` or generic `HttpException` | Use exception classes from `libs/core/common/exceptions/` |
| Put business logic in PortRegistry | PortRegistry is pure orchestration: route → cache → CB → fallback |
| Create a single CB for all ports | Per-port `CircuitBreakerState` instance (30 total) |
| Hardcode endpoint URLs | Read from `EndpointConfigService` |
| Use `any` type for port responses | Define Zod schemas per port method |
| Cache transaction-tier ports (payment, document) | `cacheTier: 'transaction'` → skip cache always |

### 🧪 Testing Requirements

- **Unit tests** co-located as `*.spec.ts` next to each source file
- **Test framework:** Jest (already configured in package.json)
- **Coverage targets:** PortRegistry > 90%, EndpointConfigService > 85%, MockAdapterBase > 90%
- **Integration test scaffolding** in `test/integration/port-registry.spec.ts` (full setup, mock data read, Zod validation)

Key test scenarios:
1. PortRegistry resolves mock adapter when `MOCK_MODE=true`
2. PortRegistry resolves live adapter when config says `adapter: live` and `MOCK_MODE=false`
3. EndpointConfigService reloads config within 100ms of file change
4. MockAdapterBase throws fatal on Zod schema mismatch (non-prod)
5. Cache hit skips downstream call for static/dynamic tiers
6. Cache miss on transaction tier — always calls downstream
7. CircuitBreaker opens after threshold failures, returns fallback
8. Adding new port config = zero code changes to PortRegistry
9. Timeout aborts request and logs with correlation ID
10. AggregationService handles partial failures (2/3 ports succeed)

### Project Structure Notes

- New shared libraries go in `src/libs/shared/` — follows existing pattern (caching, cqrs, resilience, context)
- Config files go in project root `config/` — referenced by EndpointConfigService
- Mock data goes in project root `mocks/` — referenced by MockAdapterBase
- Both new modules (`PortModule`, `EndpointConfigModule`) should be `@Global()` — used by all domain modules
- DI tokens for new services: define in each module, export via barrel `index.ts`

### 🔬 Latest Tech Information (Verified June 2026)

#### chokidar v5.0.0 — ESM-ONLY

- **Breaking:** chokidar v5 is **ESM-only** — no CommonJS support. Must use `import chokidar from 'chokidar'`.
- Node.js >= 20 required.
- `awaitWriteFinish` option makes watching less responsive; use only for large files. For YAML config (< 100KB), use `stabilityThreshold: 100` for fast reload.
- `watcher.close()` is **async** — returns a Promise. Call in `OnModuleDestroy`.
- Only 1 dependency in v5 (down from 13 in v3).

```typescript
import chokidar from 'chokidar';

// In EndpointConfigService
this.watcher = chokidar.watch('config/api-endpoints.yaml', {
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
});
this.watcher.on('change', (path) => this.reloadConfig());
```

#### Zod v4.4.3 — API Changes from v3

Project has `zod ^4.2.1` installed. Key differences from v3:
- `.safeParse()` works the same — returns `{ success, data, error }` ✅
- `.parse()` works the same — throws `ZodError` on failure ✅
- **Deprecated:** `z.string().email()` → use `z.email()` (top-level)
- **Deprecated:** `z.string().uuid()` → use `z.uuid()` (top-level)
- **New:** `z.int()` as top-level (replaces `z.number().int()`)
- **Removed:** `.deepPartial()` — use alternative approach
- **Changed:** `z.record()` now requires key + value schemas
- **3x faster** parsing than Zod 3

```typescript
// For api-endpoints.schema.ts — use Zod v4 style:
import { z } from 'zod';

export const PortEndpointConfigSchema = z.object({
  adapter: z.enum(['mock', 'live']),
  baseUrl: z.string().optional(),
  timeout: z.int().positive().default(3000),
  cacheTier: z.enum(['static', 'dynamic', 'transaction']),
  circuitBreaker: z.object({
    errorThreshold: z.int().min(1).max(100).default(50),
    resetTimeout: z.int().positive().default(10000),
    minRequests: z.int().nonnegative().default(5),
  }).optional(),
});

export const ApiEndpointsSchema = z.object({
  services: z.record(z.string(), PortEndpointConfigSchema),
});
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Port Registry Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Per-Service Endpoint Config]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port Response Cache Strategy]
- [Source: _bmad-output/planning-artifacts/architecture.md#Anti-Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure & Deployment — api-endpoints.yaml]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1: Hexagonal Port Infrastructure]
- [Source: _bmad-output/planning-artifacts/prd.md#FR10–FR15 (Hexagonal Adapter Layer)]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: src/libs/shared/resilience/ — CircuitBreakerState, FallbackProvider]
- [Source: src/libs/shared/caching/ — RedisCacheService]
- [Source: src/libs/shared/context/ — RequestContextProvider]
- [Source: src/modules/order/ — Reference DDD/CQRS module structure]

## Dev Agent Record

### Agent Model Used

SM Agent (Scrum Master — Bob)

### Debug Log References

### Completion Notes List

### File List
