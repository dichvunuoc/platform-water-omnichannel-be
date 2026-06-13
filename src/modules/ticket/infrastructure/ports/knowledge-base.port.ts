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

/**
 * Knowledge Base Port Interface
 *
 * Methods dispatched via PortRegistry.execute('knowledge-base', method, params):
 *   get-categories    — AC#1 (FR48)
 *   search-articles   — AC#2 (FR47) — pure pass-through
 *   get-article       — AC#3 (FR48)
 *   rate-article      — AC#4 (FR49)
 */
export interface IKnowledgeBasePort extends IPortAdapter {
  // Methods are invoked via execute(method, params) from IPortAdapter
}

/**
 * Mock Knowledge Base Adapter
 *
 * Returns mock KB responses from JSON files for development.
 * Extends MockAdapterBase for consistent mock behavior.
 */
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
