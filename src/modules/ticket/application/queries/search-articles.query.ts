/**
 * Search Articles Query (AC#2 — FR47)
 *
 * Searches KB articles — PURE PASS-THROUGH, no BFF search logic.
 * Vietnamese processing handled entirely by downstream KB Service.
 */

import { IQuery } from '@core/application';
import type { SearchArticlesResponse } from '../dtos/knowledge-base.dto';

export class SearchArticlesQuery extends IQuery<SearchArticlesResponse> {
  constructor(
    public readonly query: string,
    public readonly category?: string,
    public readonly page?: number,
    public readonly pageSize?: number,
  ) {
    super();
  }
}

export type SearchArticlesResult = SearchArticlesResponse;
