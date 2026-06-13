/**
 * Get Article Query (AC#3 — FR48)
 *
 * Fetches a single KB article detail by ID.
 */

import { IQuery } from '@core/application';
import type { KbArticleDetail } from '../dtos/knowledge-base.dto';

export class GetArticleQuery extends IQuery<KbArticleDetail> {
  constructor(public readonly articleId: string) {
    super();
  }
}

export type GetArticleResult = KbArticleDetail;
