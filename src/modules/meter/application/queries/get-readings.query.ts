/**
 * Get Readings Query (AC#1)
 *
 * Dispatched via IQueryBus, handled by GetReadingsHandler.
 */

import { IQuery } from '@core/application';
import type { ReadingsListResponse } from '../dtos/meter-reading.dto';

export class GetReadingsQuery extends IQuery<ReadingsListResponse> {
  constructor(
    public readonly customerId: string,
  ) {
    super();
  }
}
