/**
 * Get KB Categories Handler (AC#1 — FR48)
 *
 * Fetches FAQ topic categories via PortRegistry.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { GetKbCategoriesQuery, GetKbCategoriesResult } from '../get-kb-categories.query';
import type { GetCategoriesResponse } from '../../dtos/knowledge-base.dto';
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
