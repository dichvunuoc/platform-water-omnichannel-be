/**
 * Get Article Handler (AC#3 — FR48)
 *
 * Fetches KB article detail via PortRegistry.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { GetArticleQuery, GetArticleResult } from '../get-article.query';
import type { KbArticleDetail } from '../../dtos/knowledge-base.dto';
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
