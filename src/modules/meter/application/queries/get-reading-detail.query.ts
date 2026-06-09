/**
 * Get Reading Detail Query (AC#3)
 *
 * Dispatched via IQueryBus, handled by GetReadingDetailHandler.
 */

import { IQuery } from '@core/application';
import type { ReadingDetail } from '../dtos/meter-reading.dto';

export class GetReadingDetailQuery extends IQuery<ReadingDetail> {
  constructor(
    public readonly customerId: string,
    public readonly period: string,
  ) {
    super();
  }
}
