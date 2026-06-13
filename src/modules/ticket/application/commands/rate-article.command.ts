/**
 * Rate Article Command (AC#4 — FR49)
 *
 * Records helpful/not helpful rating for a KB article.
 */

import { ICommand } from '@core/application';
import type { RateArticleResponse } from '../dtos/knowledge-base.dto';

export class RateArticleCommand implements ICommand {
  constructor(
    public readonly articleId: string,
    public readonly customerId: string,
    public readonly helpful: boolean,
  ) {}
}

export type RateArticleResult = RateArticleResponse;
