/**
 * Rate Article Handler (AC#4 — FR49)
 *
 * Records article rating via PortRegistry. Write operation — useCache: false.
 */

import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { RateArticleCommand, RateArticleResult } from '../rate-article.command';
import type { RateArticleResponse } from '../../dtos/knowledge-base.dto';
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
