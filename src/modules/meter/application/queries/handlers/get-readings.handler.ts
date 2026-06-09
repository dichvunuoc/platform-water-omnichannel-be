/**
 * Get Readings Handler (AC#1)
 *
 * Returns 12-month consumption history via PortRegistry.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetReadingsQuery } from '../get-readings.query';
import type { ReadingsListResponse } from '../../dtos/meter-reading.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetReadingsQuery)
export class GetReadingsHandler implements IQueryHandler<GetReadingsQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetReadingsQuery): Promise<ReadingsListResponse> {
    const result: PortResult<ReadingsListResponse> = await this.portRegistry.execute<ReadingsListResponse>(
      'meter-reading',
      'get-readings',
      { customerId: query.customerId },
    );
    return result.data;
  }
}
