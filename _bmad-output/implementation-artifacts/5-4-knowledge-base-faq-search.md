# Story 5.4: Knowledge Base & FAQ Search

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **customer (Bà Lan)**,
I want to search for help articles in Vietnamese and browse by topic,
so that I can find answers myself without calling anyone.

## Acceptance Criteria

### AC1: Browse FAQ Categories (FR48)
**Given** an authenticated customer navigates to "Help & FAQ"
**When** the BFF receives the request
**Then** it calls `IKnowledgeBasePort.getCategories()` via PortRegistry
**And** returns a list of topic categories: hóa đơn, ghi chỉ số, sự cố, thanh toán, lắp đặt mới.

### AC2: Search Articles in Vietnamese (FR47)
**Given** a customer types a search query in Vietnamese
**When** they submit the search (with or without diacritics, e.g. "hoa don" or "hóa đơn")
**Then** the BFF calls `IKnowledgeBasePort.searchArticles(query)` via PortRegistry as a **pure pass-through** — BFF does NOT implement any search logic (no regex, no string matching, no NLP)
**And** the Knowledge Base Service downstream handles Vietnamese language processing (diacritics normalization, synonyms, Elasticsearch or equivalent)
**And** returns matching articles with title, summary, and relevance score from the downstream service.

### AC3: View Article Detail (FR48)
**Given** a customer taps on an article
**When** the article detail loads
**Then** the BFF calls `IKnowledgeBasePort.getArticle(articleId)` via PortRegistry
**And** returns the full article content with category, author, and last updated date.

### AC4: Rate Article (FR49)
**Given** a customer finishes reading an article
**When** they tap "Helpful" or "Not Helpful"
**Then** the BFF calls `IKnowledgeBasePort.rateArticle(articleId, helpful)` via PortRegistry
**And** records the rating without requiring additional authentication beyond the session.

### AC5: Static Cache (FR67)
**Given** knowledge base data is fetched successfully
**When** the response is cached
**Then** the cache key follows `cache:port:knowledge-base:{hash}` with TTL 12-24h (static tier).

## Tasks / Subtasks

- [x] Task 1: Add Knowledge Base DI Token (AC: all)
  - [x] Add `KNOWLEDGE_BASE_PORT_TOKEN = Symbol('IKnowledgeBasePort')` to `constants/tokens.ts`

- [x] Task 2: Create Knowledge Base DTOs (AC: #1, #2, #3, #4)
  - [x] Create `src/modules/ticket/application/dtos/knowledge-base.dto.ts` (NEW file — separate from ticket.dto.ts)
  - [x] `KbCategorySchema` — `{ id, name, slug, articleCount }`
  - [x] `KbArticleSummarySchema` — `{ id, title, summary, category, relevanceScore? }`
  - [x] `KbArticleDetailSchema` — `{ id, title, content, category, author, updatedAt }`
  - [x] `SearchArticlesResponseSchema` — `{ articles: KbArticleSummarySchema[], total, query }`
  - [x] `SearchArticlesQuerySchema` — `{ q, category?, page?, pageSize? }` (controller query params)
  - [x] `RateArticleRequestSchema` — `{ helpful: boolean }` (controller input)
  - [x] `RateArticleResponseSchema` — `{ articleId, helpful, ratedAt }` (port response)
  - [x] Export all TypeScript types

- [x] Task 3: Create Knowledge Base Port & Mock Adapter (AC: all)
  - [x] Create `src/modules/ticket/infrastructure/ports/knowledge-base.port.ts`
  - [x] `IKnowledgeBasePort` interface extending `IPortAdapter`
  - [x] `MockKnowledgeBaseAdapter` extending `MockAdapterBase` with schemas for: get-categories, search-articles, get-article, rate-article
  - [x] Create `mocks/knowledge-base/get-categories.json` — Vietnamese topic categories
  - [x] Create `mocks/knowledge-base/search-articles.json` — mock search results
  - [x] Create `mocks/knowledge-base/get-article.json` — mock article detail
  - [x] Create `mocks/knowledge-base/rate-article.json` — mock rating response

- [x] Task 4: Create KB Query Handlers (AC: #1, #2, #3)
  - [x] Create `src/modules/ticket/application/queries/get-kb-categories.query.ts` + handler
  - [x] Create `src/modules/ticket/application/queries/search-articles.query.ts` + handler
  - [x] Create `src/modules/ticket/application/queries/get-article.query.ts` + handler
  - [x] All handlers inject `PortRegistry`, call `execute('knowledge-base', method, params)`
  - [x] `getCategories` and `getArticle` use default caching (static tier)
  - [x] `searchArticles` uses default caching (static tier — KB content rarely changes)

- [x] Task 5: Create Rate Article Command + Handler (AC: #4)
  - [x] Create `src/modules/ticket/application/commands/rate-article.command.ts`
  - [x] Create `src/modules/ticket/application/commands/handlers/rate-article.handler.ts`
  - [x] Handler: `execute('knowledge-base', 'rate-article', { articleId, helpful })` with `useCache: false`
  - [x] Returns `RateArticleResult`

- [x] Task 6: Create Knowledge Base Controller (AC: #1, #2, #3, #4)
  - [x] Create `src/modules/ticket/infrastructure/http/knowledge-base.controller.ts` (NEW file)
  - [x] `GET /knowledge-base/categories` → dispatch `GetKbCategoriesQuery`
  - [x] `GET /knowledge-base/search` → dispatch `SearchArticlesQuery` (query param: q, category, page, pageSize)
  - [x] `GET /knowledge-base/articles/:articleId` → dispatch `GetArticleQuery`
  - [x] `POST /knowledge-base/articles/:articleId/rate` → dispatch `RateArticleCommand`
  - [x] Inject BOTH `QUERY_BUS_TOKEN` and `COMMAND_BUS_TOKEN`

- [x] Task 7: Update TicketModule Registration (AC: all)
  - [x] Add `MockKnowledgeBaseAdapter` to providers with `useExisting` for `KNOWLEDGE_BASE_PORT_TOKEN`
  - [x] Add all KB query handlers + `RateArticleHandler` to providers
  - [x] Add `KnowledgeBaseController` to controllers
  - [x] Register `knowledge-base` port with `PortRegistry` in `onModuleInit` (cacheTier: static)
  - [x] Export `KNOWLEDGE_BASE_PORT_TOKEN`
  - [x] Update barrel exports

- [x] Task 8: Write comprehensive tests (AC: all)
  - [x] `knowledge-base.port.spec.ts` — mock adapter reads all 4 JSON files, validates schemas
  - [x] `get-kb-categories.handler.spec.ts` — verify PortRegistry call
  - [x] `search-articles.handler.spec.ts` — verify PortRegistry call with query + filters
  - [x] `get-article.handler.spec.ts` — verify PortRegistry call with articleId
  - [x] `rate-article.handler.spec.ts` — verify PortRegistry call, useCache: false
  - [x] `knowledge-base.controller.spec.ts` — all 4 endpoints, query params, validation
  - [x] Test search with Vietnamese diacritics passes through unchanged (pure pass-through)

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story introduces a **NEW PORT** (`knowledge-base`, Port #11) inside the existing `ticket` module. Per architecture:
- Port #11: `knowledge-base` | `IKnowledgeBasePort` | **ticket module** | methods: searchArticles, getArticle, getArticlesByCategory, rateArticle, getCategories | **static** cache tier | MVP
- Separate controller: `knowledge-base.controller.ts` (NOT mixed into `ticket.controller.ts`)
- Separate port file: `knowledge-base.port.ts` (alongside `ticket.port.ts` and `document.port.ts`)
- Separate DTOs file: `knowledge-base.dto.ts` (KB has no overlap with ticket DTOs)

This makes the ticket module the **home of THREE ports**: `ticket` (dynamic), `document` (transaction), `knowledge-base` (static).

#### What ALREADY EXISTS — DO NOT RECREATE

| Component | Location | Status |
|-----------|----------|--------|
| **Ticket Module** | `ticket.module.ts` | ✅ Registered in app.module.ts — ADD KB port + controller + handlers |
| **DI Tokens** | `constants/tokens.ts` | ✅ Has `TICKET_PORT_TOKEN`, `DOCUMENT_PORT_TOKEN` — ADD `KNOWLEDGE_BASE_PORT_TOKEN` |
| **Port pattern** | `infrastructure/ports/ticket.port.ts` | ✅ Template for new port file |
| **Controller pattern** | `infrastructure/http/ticket.controller.ts` | ✅ Template for new controller (dual bus injection) |
| **Query handler pattern** | `queries/handlers/get-ticket-status.handler.ts` | ✅ Template for KB query handlers |
| **Command handler pattern** | `commands/handlers/create-ticket.handler.ts` | ✅ Template for rate-article handler |
| **DTO pattern** | `application/dtos/ticket.dto.ts` | ✅ Template — create separate `knowledge-base.dto.ts` |
| **Mock JSON pattern** | `mocks/ticket/*.json` | ✅ Template — create `mocks/knowledge-base/*.json` |

#### ⚡ Key Architecture Points

**This is a PURE PASS-THROUGH port — the most critical rule:**
- BFF does NOT implement ANY search logic — no regex, no string matching, no NLP, no diacritics normalization
- BFF does NOT implement Vietnamese language processing — that's the downstream Knowledge Base Service
- BFF does NOT filter, sort, or rank articles — downstream handles all of that
- The ONLY thing BFF does: validate Zod schema → call port → return response
- If the user searches "hoa don" or "hóa đơn", BFF passes the raw query string to downstream untouched

**Cache Tier: `static` (12-24h)** — KB content changes rarely (articles, categories).
Exception: `rateArticle` uses `useCache: false` (write operation).

**Port methods (from architecture Port Catalog #11):**
- `getCategories` — returns topic categories
- `searchArticles` — accepts query string, returns matching articles
- `getArticlesByCategory` — NOT in scope (not in AC, can be added later if needed)
- `getArticle` — returns article detail by ID
- `rateArticle` — records helpful/not helpful

**Port Name in PortRegistry:** `knowledge-base` (NOT `kb`, NOT `knowledgeBase`)
**Mock JSON directory:** `mocks/knowledge-base/` (NEW directory — doesn't exist yet)

#### What ALREADY EXISTS in Other Modules — REUSE PATTERNS

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **Port file pattern** | `ticket/infrastructure/ports/ticket.port.ts` | `ITicketPort` + `MockTicketAdapter` — EXACT template for `IKnowledgeBasePort` + `MockKnowledgeBaseAdapter` |
| **Document port** | `ticket/infrastructure/ports/document.port.ts` | Shows how a SECOND port was added to the ticket module — same pattern for THIRD port |
| **Controller dual bus** | `ticket/infrastructure/http/ticket.controller.ts` | `@Inject(QUERY_BUS_TOKEN)` + `@Inject(COMMAND_BUS_TOKEN)` — same pattern |
| **Module registration** | `ticket/ticket.module.ts` | `useExisting` pattern for port adapters, `OnModuleInit` for PortRegistry |
| **Query handler** | `ticket/application/queries/handlers/get-ticket-status.handler.ts` | `@QueryHandler` + `PortRegistry.execute()` — EXACT template |
| **Command handler** | `ticket/application/commands/handlers/create-ticket.handler.ts` | `@CommandHandler` + `PortRegistry.execute()` — template for rate-article |
| **PortFallbackException** | `@shared/port/port-exceptions` | Throw on null `result?.data` |

### 📁 File Structure — Changes

```
src/modules/ticket/
├── constants/
│   └── tokens.ts                                        ← UPDATE (add KNOWLEDGE_BASE_PORT_TOKEN)
├── application/
│   ├── commands/
│   │   ├── rate-article.command.ts                       ← NEW (AC#4)
│   │   ├── index.ts                                      ← UPDATE (add export)
│   │   └── handlers/
│   │       ├── rate-article.handler.ts                   ← NEW (AC#4)
│   │       └── rate-article.handler.spec.ts              ← NEW
│   ├── queries/
│   │   ├── get-kb-categories.query.ts                    ← NEW (AC#1)
│   │   ├── search-articles.query.ts                      ← NEW (AC#2)
│   │   ├── get-article.query.ts                          ← NEW (AC#3)
│   │   ├── index.ts                                      ← UPDATE (add exports)
│   │   └── handlers/
│   │       ├── get-kb-categories.handler.ts              ← NEW (AC#1)
│   │       ├── get-kb-categories.handler.spec.ts         ← NEW
│   │       ├── search-articles.handler.ts                ← NEW (AC#2)
│   │       ├── search-articles.handler.spec.ts           ← NEW
│   │       ├── get-article.handler.ts                    ← NEW (AC#3)
│   │       └── get-article.handler.spec.ts               ← NEW
│   ├── dtos/
│   │   ├── ticket.dto.ts                                 ← NO CHANGE
│   │   └── knowledge-base.dto.ts                         ← NEW (all KB schemas)
│   └── index.ts                                          ← NO CHANGE
├── infrastructure/
│   ├── http/
│   │   ├── ticket.controller.ts                          ← NO CHANGE
│   │   ├── ticket-webhook.controller.ts                  ← NO CHANGE
│   │   └── knowledge-base.controller.ts                  ← NEW (AC#1,#2,#3,#4)
│   └── ports/
│       ├── ticket.port.ts                                ← NO CHANGE
│       ├── document.port.ts                              ← NO CHANGE
│       ├── knowledge-base.port.ts                        ← NEW (IKnowledgeBasePort + MockKnowledgeBaseAdapter)
│       └── knowledge-base.port.spec.ts                   ← NEW
└── ticket.module.ts                                      ← UPDATE (add KB port + controller + handlers)

mocks/
└── knowledge-base/                                        ← NEW directory
    ├── get-categories.json                                ← NEW
    ├── search-articles.json                               ← NEW
    ├── get-article.json                                   ← NEW
    └── rate-article.json                                  ← NEW
```

### 🔧 Implementation Details

#### DI Token (`constants/tokens.ts`)

```typescript
// ADD:
export const KNOWLEDGE_BASE_PORT_TOKEN = Symbol('IKnowledgeBasePort');
```

#### Knowledge Base DTOs (`knowledge-base.dto.ts`) — NEW FILE

```typescript
/**
 * Knowledge Base DTOs — Zod Schemas + TypeScript Types
 *
 * AC#1: Categories (FR48)
 * AC#2: Article Search (FR47) — PURE PASS-THROUGH, no BFF search logic
 * AC#3: Article Detail (FR48)
 * AC#4: Article Rating (FR49)
 *
 * IMPORTANT: BFF does NOT implement search logic, Vietnamese processing,
 * or article filtering. All of that is downstream KB Service responsibility.
 */

import { z } from 'zod';

// =============================================================================
// AC#1: FAQ Categories (FR48)
// =============================================================================

export const KbCategorySchema = z.object({
  id: z.string(),
  name: z.string(),           // e.g. "Hóa đơn", "Sự cố", "Thanh toán"
  slug: z.string(),           // e.g. "hoa-don", "su-co", "thanh-toan"
  articleCount: z.number(),
});
export type KbCategory = z.infer<typeof KbCategorySchema>;

export const GetCategoriesResponseSchema = z.object({
  categories: z.array(KbCategorySchema),
});
export type GetCategoriesResponse = z.infer<typeof GetCategoriesResponseSchema>;

// =============================================================================
// AC#2: Article Search (FR47 — pure pass-through)
// =============================================================================

export const SearchArticlesQuerySchema = z.object({
  q: z.string().min(1).max(200),
  category: z.string().optional(),     // slug filter
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type SearchArticlesQuery = z.infer<typeof SearchArticlesQuerySchema>;

export const KbArticleSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  category: z.string(),                // category slug
  relevanceScore: z.number().optional(), // from downstream search engine
});
export type KbArticleSummary = z.infer<typeof KbArticleSummarySchema>;

export const SearchArticlesResponseSchema = z.object({
  articles: z.array(KbArticleSummarySchema),
  total: z.number(),
  query: z.string(),                    // echoed back from downstream
});
export type SearchArticlesResponse = z.infer<typeof SearchArticlesResponseSchema>;

// =============================================================================
// AC#3: Article Detail (FR48)
// =============================================================================

export const KbArticleDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),                  // Markdown or HTML from downstream
  category: z.string(),
  author: z.string(),
  updatedAt: z.string(),
});
export type KbArticleDetail = z.infer<typeof KbArticleDetailSchema>;

// =============================================================================
// AC#4: Article Rating (FR49)
// =============================================================================

export const RateArticleRequestSchema = z.object({
  helpful: z.boolean(),
});
export type RateArticleRequest = z.infer<typeof RateArticleRequestSchema>;

export const RateArticleResponseSchema = z.object({
  articleId: z.string(),
  helpful: z.boolean(),
  ratedAt: z.string(),
});
export type RateArticleResponse = z.infer<typeof RateArticleResponseSchema>;
```

#### Knowledge Base Port (`knowledge-base.port.ts`) — NEW FILE

```typescript
/**
 * Knowledge Base Port Interface & Mock Adapter
 *
 * Defines the contract for downstream Knowledge Base service communication.
 * Port #11 in architecture catalog.
 *
 * Cache tier: static (12-24h) — KB content changes rarely.
 *
 * CRITICAL: BFF is a PURE PASS-THROUGH for all KB operations.
 * NO search logic, NO Vietnamese processing, NO filtering in BFF.
 * All intelligence lives in the downstream KB Service.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  GetCategoriesResponseSchema,
  SearchArticlesResponseSchema,
  KbArticleDetailSchema,
  RateArticleResponseSchema,
} from '../../application/dtos/knowledge-base.dto';

export interface IKnowledgeBasePort extends IPortAdapter {
  // Methods invoked via execute(method, params) from IPortAdapter
}

@Injectable()
export class MockKnowledgeBaseAdapter extends MockAdapterBase implements IKnowledgeBasePort {
  constructor() {
    super(
      'knowledge-base',
      {
        'get-categories': GetCategoriesResponseSchema,
        'search-articles': SearchArticlesResponseSchema,
        'get-article': KbArticleDetailSchema,
        'rate-article': RateArticleResponseSchema,
      },
      new Logger('knowledge-base-mock-adapter'),
    );
  }
}
```

#### Query: Get Categories

```typescript
// get-kb-categories.query.ts
import { IQuery } from '@core/application';
import type { GetCategoriesResponse } from '../../dtos/knowledge-base.dto';

export class GetKbCategoriesQuery implements IQuery {}

export type GetKbCategoriesResult = GetCategoriesResponse;
```

```typescript
// handlers/get-kb-categories.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { GetKbCategoriesQuery, GetKbCategoriesResult } from '../get-kb-categories.query';
import type { GetCategoriesResponse } from '../../../dtos/knowledge-base.dto';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';

@QueryHandler(GetKbCategoriesQuery)
export class GetKbCategoriesHandler implements IQueryHandler<GetKbCategoriesQuery> {
  private readonly logger = new Logger(GetKbCategoriesHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(_query: GetKbCategoriesQuery): Promise<GetKbCategoriesResult> {
    this.logger.log('Fetching KB categories');

    const result: PortResult<GetCategoriesResponse> =
      await this.portRegistry.execute<GetCategoriesResponse>(
        'knowledge-base', 'get-categories', {},
      );

    const categories = result?.data;
    if (!categories) {
      throw new PortFallbackException('knowledge-base');
    }

    return categories;
  }
}
```

#### Query: Search Articles

```typescript
// search-articles.query.ts
import { IQuery } from '@core/application';
import type { SearchArticlesResponse } from '../../dtos/knowledge-base.dto';

export class SearchArticlesQuery implements IQuery {
  constructor(
    public readonly query: string,
    public readonly category?: string,
    public readonly page?: number,
    public readonly pageSize?: number,
  ) {}
}

export type SearchArticlesResult = SearchArticlesResponse;
```

```typescript
// handlers/search-articles.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { SearchArticlesQuery, SearchArticlesResult } from '../search-articles.query';
import type { SearchArticlesResponse } from '../../../dtos/knowledge-base.dto';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';

@QueryHandler(SearchArticlesQuery)
export class SearchArticlesHandler implements IQueryHandler<SearchArticlesQuery> {
  private readonly logger = new Logger(SearchArticlesHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: SearchArticlesQuery): Promise<SearchArticlesResult> {
    const { query: q, category, page, pageSize } = query;
    this.logger.log(`Searching KB: "${q}"`);

    // PURE PASS-THROUGH — no BFF search logic, no Vietnamese processing
    const result: PortResult<SearchArticlesResponse> =
      await this.portRegistry.execute<SearchArticlesResponse>(
        'knowledge-base', 'search-articles',
        { q, category, page, pageSize },
      );

    const articles = result?.data;
    if (!articles) {
      throw new PortFallbackException('knowledge-base');
    }

    return articles;
  }
}
```

#### Query: Get Article

```typescript
// get-article.query.ts
import { IQuery } from '@core/application';
import type { KbArticleDetail } from '../../dtos/knowledge-base.dto';

export class GetArticleQuery implements IQuery {
  constructor(public readonly articleId: string) {}
}

export type GetArticleResult = KbArticleDetail;
```

```typescript
// handlers/get-article.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { GetArticleQuery, GetArticleResult } from '../get-article.query';
import type { KbArticleDetail } from '../../../dtos/knowledge-base.dto';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';

@QueryHandler(GetArticleQuery)
export class GetArticleHandler implements IQueryHandler<GetArticleQuery> {
  private readonly logger = new Logger(GetArticleHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetArticleQuery): Promise<GetArticleResult> {
    const { articleId } = query;
    this.logger.log(`Fetching KB article: ${articleId}`);

    const result: PortResult<KbArticleDetail> =
      await this.portRegistry.execute<KbArticleDetail>(
        'knowledge-base', 'get-article',
        { articleId },
      );

    const article = result?.data;
    if (!article) {
      throw new PortFallbackException('knowledge-base');
    }

    return article;
  }
}
```

#### Command: Rate Article

```typescript
// rate-article.command.ts
import { ICommand } from '@core/application';
import type { RateArticleResponse } from '../../dtos/knowledge-base.dto';

export class RateArticleCommand implements ICommand {
  constructor(
    public readonly articleId: string,
    public readonly customerId: string,
    public readonly helpful: boolean,
  ) {}
}

export type RateArticleResult = RateArticleResponse;
```

```typescript
// handlers/rate-article.handler.ts
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { RateArticleCommand, RateArticleResult } from '../rate-article.command';
import type { RateArticleResponse } from '../../../dtos/knowledge-base.dto';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';

@CommandHandler(RateArticleCommand)
export class RateArticleHandler implements ICommandHandler<RateArticleCommand> {
  private readonly logger = new Logger(RateArticleHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: RateArticleCommand): Promise<RateArticleResult> {
    const { articleId, customerId, helpful } = command;

    this.logger.log(`Rating article ${articleId}: ${helpful ? 'helpful' : 'not helpful'}`);

    const result: PortResult<RateArticleResponse> =
      await this.portRegistry.execute<RateArticleResponse>(
        'knowledge-base', 'rate-article',
        { articleId, customerId, helpful, useCache: false },
      );

    const rating = result?.data;
    if (!rating) {
      throw new PortFallbackException('knowledge-base');
    }

    return rating;
  }
}
```

#### Knowledge Base Controller — NEW FILE

```typescript
/**
 * Knowledge Base Controller
 *
 * REST endpoints for FAQ browsing and article search.
 * Thin pass-through: validates input → dispatches CQRS → returns result.
 *
 * AC#1: GET /knowledge-base/categories — list FAQ topics
 * AC#2: GET /knowledge-base/search — search articles (PURE PASS-THROUGH)
 * AC#3: GET /knowledge-base/articles/:articleId — article detail
 * AC#4: POST /knowledge-base/articles/:articleId/rate — rate helpful/not helpful
 *
 * CRITICAL: BFF does NOT implement any search logic.
 * All Vietnamese processing is downstream KB Service responsibility.
 */

import { Controller, Get, Post, Body, Param, Query, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { ICommandBus, IQueryBus } from '@core/application';
import { GetKbCategoriesQuery } from '../../application/queries/get-kb-categories.query';
import { SearchArticlesQuery } from '../../application/queries/search-articles.query';
import { GetArticleQuery } from '../../application/queries/get-article.query';
import { RateArticleCommand } from '../../application/commands/rate-article.command';
import {
  SearchArticlesQuerySchema,
  RateArticleRequestSchema,
} from '../../application/dtos/knowledge-base.dto';
import { ValidationException } from '@core/common';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';

@ApiTags('Knowledge Base')
@ApiBearerAuth('JWT-auth')
@Controller('knowledge-base')
export class KnowledgeBaseController {

  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  /**
   * GET /knowledge-base/categories
   * List FAQ topic categories (AC#1 — FR48)
   */
  @Get('categories')
  @ApiOperation({ summary: 'Get FAQ topic categories' })
  async getCategories() {
    return this.queryBus.execute(new GetKbCategoriesQuery());
  }

  /**
   * GET /knowledge-base/search?q=...&category=...&page=1&pageSize=10
   * Search articles — PURE PASS-THROUGH (AC#2 — FR47)
   */
  @Get('search')
  @ApiOperation({ summary: 'Search FAQ articles' })
  async searchArticles(@Query() query: Record<string, unknown>) {
    const validated = SearchArticlesQuerySchema.safeParse(query);
    if (!validated.success) {
      throw new ValidationException(validated.error.message);
    }

    return this.queryBus.execute(
      new SearchArticlesQuery(
        validated.data.q,
        validated.data.category,
        validated.data.page,
        validated.data.pageSize,
      ),
    );
  }

  /**
   * GET /knowledge-base/articles/:articleId
   * Get article detail (AC#3 — FR48)
   */
  @Get('articles/:articleId')
  @ApiOperation({ summary: 'Get article detail' })
  async getArticle(@Param('articleId') articleId: string) {
    return this.queryBus.execute(new GetArticleQuery(articleId));
  }

  /**
   * POST /knowledge-base/articles/:articleId/rate
   * Rate article helpful/not helpful (AC#4 — FR49)
   */
  @Post('articles/:articleId/rate')
  @ApiOperation({ summary: 'Rate article helpful or not helpful' })
  async rateArticle(
    @CurrentUser('id') userId: string,
    @Param('articleId') articleId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const validated = RateArticleRequestSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException(validated.error.message);
    }

    return this.commandBus.execute(
      new RateArticleCommand(articleId, userId, validated.data.helpful),
    );
  }
}
```

#### Update TicketModule

```typescript
// ADD these imports:
import { KnowledgeBaseController } from './infrastructure/http/knowledge-base.controller';
import { MockKnowledgeBaseAdapter } from './infrastructure/ports/knowledge-base.port';
import { KNOWLEDGE_BASE_PORT_TOKEN } from './constants/tokens';
import { GetKbCategoriesHandler } from './application/queries/handlers/get-kb-categories.handler';
import { SearchArticlesHandler } from './application/queries/handlers/search-articles.handler';
import { GetArticleHandler } from './application/queries/handlers/get-article.handler';
import { RateArticleHandler } from './application/commands/handlers/rate-article.handler';

// UPDATE @Module decorator:
@Module({
  controllers: [TicketController, TicketWebhookController, KnowledgeBaseController],
  providers: [
    // ... existing providers stay the same ...

    // NEW: Knowledge Base Port Adapter
    MockKnowledgeBaseAdapter,
    { provide: KNOWLEDGE_BASE_PORT_TOKEN, useExisting: MockKnowledgeBaseAdapter },

    // NEW: KB Query Handlers
    GetKbCategoriesHandler,
    SearchArticlesHandler,
    GetArticleHandler,

    // NEW: KB Command Handler
    RateArticleHandler,
  ],
  exports: [TICKET_PORT_TOKEN, DOCUMENT_PORT_TOKEN, KNOWLEDGE_BASE_PORT_TOKEN],
})

// UPDATE constructor — add mockKbAdapter:
constructor(
  private readonly portRegistry: PortRegistry,
  private readonly mockTicketAdapter: MockTicketAdapter,
  private readonly mockDocumentAdapter: MockDocumentAdapter,
  private readonly mockKbAdapter: MockKnowledgeBaseAdapter,
) {}

// ADD to onModuleInit():
this.portRegistry.register(
  'knowledge-base',
  this.mockKbAdapter,
  this.mockKbAdapter,
);
```

#### Mock JSON Files

**`mocks/knowledge-base/get-categories.json`**:
```json
{
  "categories": [
    { "id": "cat-1", "name": "Hóa đơn", "slug": "hoa-don", "articleCount": 8 },
    { "id": "cat-2", "name": "Ghi chỉ số", "slug": "ghi-chi-so", "articleCount": 5 },
    { "id": "cat-3", "name": "Sự cố", "slug": "su-co", "articleCount": 12 },
    { "id": "cat-4", "name": "Thanh toán", "slug": "thanh-toan", "articleCount": 7 },
    { "id": "cat-5", "name": "Lắp đặt mới", "slug": "lap-dat-moi", "articleCount": 4 }
  ]
}
```

**`mocks/knowledge-base/search-articles.json`**:
```json
{
  "articles": [
    {
      "id": "art-1",
      "title": "Hướng dẫn thanh toán hóa đơn nước online",
      "summary": "Các bước thanh toán hóa đơn nước qua ứng dụng My Công ty...",
      "category": "thanh-toan",
      "relevanceScore": 0.95
    },
    {
      "id": "art-2",
      "title": "Cách tra cứu hóa đơn điện tử",
      "summary": "Hướng dẫn tải hóa đơn điện tử có mã CQT...",
      "category": "hoa-don",
      "relevanceScore": 0.82
    }
  ],
  "total": 2,
  "query": "hóa đơn thanh toán"
}
```

**`mocks/knowledge-base/get-article.json`**:
```json
{
  "id": "art-1",
  "title": "Hướng dẫn thanh toán hóa đơn nước online",
  "content": "## Thanh toán hóa đơn nước\n\nBước 1: Mở ứng dụng My Công ty\nBước 2: Chọn 'Hóa đơn'\nBước 3: Chọn hóa đơn cần thanh toán\nBước 4: Nhấn 'Thanh toán' và quét mã QR\n\n*Lưu ý: Hóa đơn sẽ được cập nhật trạng thái trong vòng 5 phút sau thanh toán.*",
  "category": "thanh-toan",
  "author": "Ban CSKH",
  "updatedAt": "2026-05-15T10:00:00Z"
}
```

**`mocks/knowledge-base/rate-article.json`**:
```json
{
  "articleId": "art-1",
  "helpful": true,
  "ratedAt": "2026-06-10T16:00:00Z"
}
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Implement Vietnamese text processing in BFF | Pass raw query string to downstream — KB Service handles diacritics, synonyms, NLP |
| Implement search logic (regex, string matching, Elasticsearch) | Pure pass-through — `PortRegistry.execute('knowledge-base', 'search-articles', { q })` |
| Filter or sort search results in BFF | Return downstream results as-is — downstream handles ranking |
| Put KB endpoints in `ticket.controller.ts` | Create separate `knowledge-base.controller.ts` per architecture |
| Put KB DTOs in `ticket.dto.ts` | Create separate `knowledge-base.dto.ts` — KB has no overlap with ticket DTOs |
| Mix KB port into `ticket.port.ts` or `MockTicketAdapter` | Create separate `knowledge-base.port.ts` with its own `MockKnowledgeBaseAdapter` |
| Cache `rateArticle` responses | `useCache: false` — rating is a write operation |
| Create a separate `knowledge-base` module | KB port lives in `ticket` module per architecture — same as `document` port |
| Validate or transform search query before passing to port | Pass raw `q` parameter unchanged — no trimming, no normalization |
| Create Vietnamese categories hardcoded in BFF | Categories come from downstream via port — BFF doesn't own category data |

### 🔧 Important Implementation Notes

#### Why Separate Controller?

Per architecture directory structure:
```
ticket/infrastructure/http/
├── ticket.controller.ts           ← /tickets/* routes
├── knowledge-base.controller.ts   ← /knowledge-base/* routes
└── ticket-webhook.controller.ts   ← /webhooks/ticket/* routes
```

Each controller owns its own route prefix. Mixing KB routes into `ticket.controller.ts` would violate the REST API naming convention (`@Controller('tickets')` vs `@Controller('knowledge-base')`).

#### Why Separate DTO File?

KB DTOs (`knowledge-base.dto.ts`) have zero overlap with ticket DTOs (`ticket.dto.ts`). Categories, articles, and search have no shared types with incident types, ticket status, or webhook payloads. Separating keeps both files focused and maintainable.

#### Why Separate Port File?

Same reason as `document.port.ts` — different port name, different cache tier, different mock data. The `knowledge-base` port has `cacheTier: static` while `ticket` has `cacheTier: dynamic`. They are distinct ports registered separately in PortRegistry.

#### Route Design

```
GET  /knowledge-base/categories                    → categories
GET  /knowledge-base/search?q=...&category=...     → search
GET  /knowledge-base/articles/:articleId           → article detail
POST /knowledge-base/articles/:articleId/rate      → rate article
```

Routes use `knowledge-base` (kebab-case) per API naming convention. Article operations nest under `articles/` sub-path.

#### Controller Route Ordering

**CRITICAL:** In NestJS, route ordering matters. `@Get('search')` MUST be defined BEFORE `@Get('articles/:articleId')` — otherwise NestJS will match `:articleId` parameter to the literal string "search" and return the wrong handler. This is a common NestJS gotcha.

The correct order in the controller:
```typescript
@Get('categories')        // 1st — static path
@Get('search')            // 2nd — static path (BEFORE :articleId)
@Get('articles/:articleId') // 3rd — dynamic path (AFTER search)
@Post('articles/:articleId/rate') // 4th — POST doesn't conflict with GET
```

### 🧪 Testing Requirements

1. **MockKnowledgeBaseAdapter — get-categories** — Read JSON, validate `GetCategoriesResponseSchema`, verify 5 categories
2. **MockKnowledgeBaseAdapter — search-articles** — Read JSON, validate `SearchArticlesResponseSchema`
3. **MockKnowledgeBaseAdapter — get-article** — Read JSON, validate `KbArticleDetailSchema`
4. **MockKnowledgeBaseAdapter — rate-article** — Read JSON, validate `RateArticleResponseSchema`
5. **GetKbCategoriesHandler — success** — Verify PortRegistry called with `('knowledge-base', 'get-categories', {})`
6. **GetKbCategoriesHandler — null result** — Verify throws `PortFallbackException`
7. **SearchArticlesHandler — success** — Verify PortRegistry called with `{ q, category?, page?, pageSize? }`
8. **SearchArticlesHandler — Vietnamese query** — Verify query passed through unchanged (no transformation)
9. **SearchArticlesHandler — null result** — Verify throws `PortFallbackException`
10. **GetArticleHandler — success** — Verify PortRegistry called with `{ articleId }`
11. **GetArticleHandler — null result** — Verify throws `PortFallbackException`
12. **RateArticleHandler — success** — Verify PortRegistry called with `{ articleId, customerId, helpful, useCache: false }`
13. **RateArticleHandler — null result** — Verify throws `PortFallbackException`
14. **Controller — GET /knowledge-base/categories** — Returns 200 with categories
15. **Controller — GET /knowledge-base/search?q=hóa+đơn** — Returns 200 with articles
16. **Controller — GET /knowledge-base/search (missing q)** — Returns 400 `ValidationException`
17. **Controller — GET /knowledge-base/search?q=test&category=thanh-toan** — Passes category filter
18. **Controller — GET /knowledge-base/search?q=test&page=2&pageSize=5** — Passes pagination
19. **Controller — GET /knowledge-base/articles/art-1** — Returns 200 with article detail
20. **Controller — POST /knowledge-base/articles/art-1/rate** — Returns 200 with rating
21. **Controller — POST rate with missing body** — Returns 400 `ValidationException`
22. **Controller — POST rate with invalid body (helpful: "yes")** — Returns 400 `ValidationException`
23. **Controller — verify query class types** — `toBeInstanceOf(GetKbCategoriesQuery)`, etc.
24. **Controller — verify command class type** — `toBeInstanceOf(RateArticleCommand)`

### Previous Story Learnings (Stories 1.1–5.2 — MUST Apply)

- **Module pattern**: `OnModuleInit` + `useExisting` for port adapters — same as `document.port.ts` pattern
- **Port registration**: `portRegistry.register(name, mockAdapter, mockAdapter)` — third port in ticket module
- **Query pattern**: `@QueryHandler` + `IQueryHandler` — same as Story 5.2 query handlers
- **Command pattern**: `@CommandHandler` + `ICommandHandler` — same as all previous command handlers
- **Handler null guard**: Always check `result?.data` — throw `PortFallbackException` if null
- **Controller validation**: `Schema.safeParse(body/query)` → `throw new ValidationException(validated.error.message)`
- **DI tokens**: `Symbol()` for type-safe injection
- **Mock adapter pattern**: Extend `MockAdapterBase`, pass port name + schema map + Logger to `super()`
- **Mock JSON**: Simple static files in `mocks/{port-name}/` directory
- **Controller dual bus**: Inject both `QUERY_BUS_TOKEN` and `COMMAND_BUS_TOKEN`
- **NestJS route ordering**: Static paths BEFORE dynamic params (`:articleId`)
- **All previous tests passing** — ensure ZERO regressions
- **app.module.ts**: No changes needed — TicketModule already registered

### 📋 Cross-Story Context

**Depends on (complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Story R-1 (Session auth guard + CurrentUser decorator)
- Story 5.1 (Ticket module scaffold, module registration pattern)

**Independent of:**
- Story 5.2 (Ticket Tracking) — 5.2 adds to ticket port, 5.4 adds a NEW port
- Story 5.3 (CSAT Feedback) — 5.3 adds to ticket port, 5.4 adds a NEW port

**This is the LAST story in Epic 5.** After this story is done, all Epic 5 stories are complete.

**After Epic 5 completion:**
- Optionally run `ER` (Epic Retrospective) from the SM menu
- Proceed to Epic 6 (Notifications & Proactive Alerts)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.4: Knowledge Base & FAQ Search]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port 11: knowledge-base — methods: searchArticles, getArticle, getArticlesByCategory, rateArticle, getCategories]
- [Source: _bmad-output/planning-artifacts/architecture.md#Cache Strategy — knowledge-base: static tier (12-24h)]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules — NEVER call Backend API with bare fetch]
- [Source: _bmad-output/project-context.md#Naming Conventions — Adapter, Controller, Port naming patterns]
- [Source: src/modules/ticket/infrastructure/ports/document.port.ts — Pattern for adding a second port to ticket module]
- [Source: src/modules/ticket/infrastructure/ports/ticket.port.ts — Port + MockAdapter pattern]
- [Source: src/modules/ticket/infrastructure/http/ticket.controller.ts — Controller dual bus injection pattern]
- [Source: src/modules/ticket/application/queries/handlers/get-ticket-status.handler.ts — Query handler pattern]
- [Source: src/modules/ticket/ticket.module.ts — Module with multiple ports + OnModuleInit pattern]

## Dev Agent Record

### Agent Model Used

Claude (code review + fixes)

### Debug Log References

### Completion Notes List

- All 8 tasks implemented with tests. 220 tests pass across 16 suites.
- Code review (adversarial) found and fixed: missing barrel export (H1), unnecessary constructor (H3), missing articleId validation (M1), thin test coverage (M2/M3).
- `useCache: false` in params confirmed as project-wide pattern (not a bug).
- `customerId` naming in RateArticleCommand confirmed consistent with other commands (not a bug).

### File List

**NEW files (Story 5.4):**
- `src/modules/ticket/application/dtos/knowledge-base.dto.ts` — KB Zod schemas + types
- `src/modules/ticket/application/commands/rate-article.command.ts` — RateArticle command
- `src/modules/ticket/application/commands/handlers/rate-article.handler.ts` — RateArticle handler
- `src/modules/ticket/application/commands/handlers/rate-article.handler.spec.ts` — RateArticle tests
- `src/modules/ticket/application/queries/get-kb-categories.query.ts` — GetKbCategories query
- `src/modules/ticket/application/queries/handlers/get-kb-categories.handler.ts` — GetKbCategories handler
- `src/modules/ticket/application/queries/handlers/get-kb-categories.handler.spec.ts` — GetKbCategories tests
- `src/modules/ticket/application/queries/search-articles.query.ts` — SearchArticles query
- `src/modules/ticket/application/queries/handlers/search-articles.handler.ts` — SearchArticles handler
- `src/modules/ticket/application/queries/handlers/search-articles.handler.spec.ts` — SearchArticles tests
- `src/modules/ticket/application/queries/get-article.query.ts` — GetArticle query
- `src/modules/ticket/application/queries/handlers/get-article.handler.ts` — GetArticle handler
- `src/modules/ticket/application/queries/handlers/get-article.handler.spec.ts` — GetArticle tests
- `src/modules/ticket/infrastructure/ports/knowledge-base.port.ts` — IKnowledgeBasePort + MockAdapter
- `src/modules/ticket/infrastructure/ports/knowledge-base.port.spec.ts` — Port mock tests
- `src/modules/ticket/infrastructure/http/knowledge-base.controller.ts` — KB REST controller
- `src/modules/ticket/infrastructure/http/knowledge-base.controller.spec.ts` — Controller tests
- `mocks/knowledge-base/get-categories.json` — Vietnamese category mock
- `mocks/knowledge-base/search-articles.json` — Search results mock
- `mocks/knowledge-base/get-article.json` — Article detail mock
- `mocks/knowledge-base/rate-article.json` — Rating response mock

**UPDATED files (Story 5.4):**
- `src/modules/ticket/constants/tokens.ts` — Added KNOWLEDGE_BASE_PORT_TOKEN
- `src/modules/ticket/application/commands/index.ts` — Added rate-article export
- `src/modules/ticket/application/queries/index.ts` — Added KB query exports
- `src/modules/ticket/application/index.ts` — Added knowledge-base.dto export
- `src/modules/ticket/ticket.module.ts` — Added KB port, handlers, controller

**Code Review Fixes:**
- `src/modules/ticket/application/index.ts` — Added missing `knowledge-base.dto` barrel export (H1)
- `src/modules/ticket/application/queries/get-kb-categories.query.ts` — Removed unnecessary empty constructor (H3)
- `src/modules/ticket/infrastructure/http/knowledge-base.controller.ts` — Added articleId Zod validation (M1)
- `src/modules/ticket/application/queries/handlers/get-article.handler.spec.ts` — Added edge case tests (M2)
- `src/modules/ticket/infrastructure/http/knowledge-base.controller.spec.ts` — Added validation edge case tests (M3)
