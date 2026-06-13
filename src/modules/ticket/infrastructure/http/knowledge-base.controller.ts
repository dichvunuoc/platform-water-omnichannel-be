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
import { z } from 'zod';
import { ValidationException } from '@core/common';

const ArticleIdParamSchema = z.string().min(1).max(100);
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
    const validated = ArticleIdParamSchema.safeParse(articleId);
    if (!validated.success) {
      throw new ValidationException('articleId must be a non-empty string (max 100 chars)');
    }

    return this.queryBus.execute(new GetArticleQuery(validated.data));
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
    const validatedId = ArticleIdParamSchema.safeParse(articleId);
    if (!validatedId.success) {
      throw new ValidationException('articleId must be a non-empty string (max 100 chars)');
    }

    const validated = RateArticleRequestSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException(validated.error.message);
    }

    return this.commandBus.execute(
      new RateArticleCommand(articleId, userId, validated.data.helpful),
    );
  }
}
