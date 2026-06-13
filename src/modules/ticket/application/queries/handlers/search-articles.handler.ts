/**
 * Search Articles Handler (AC#2 — FR47)
 *
 * PURE PASS-THROUGH — no BFF search logic, no Vietnamese processing.
 * All intelligence lives in the downstream KB Service.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { SearchArticlesQuery, SearchArticlesResult } from '../search-articles.query';
import type { SearchArticlesResponse } from '../../dtos/knowledge-base.dto';
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
