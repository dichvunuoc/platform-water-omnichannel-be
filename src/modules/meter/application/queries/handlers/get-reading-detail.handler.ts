/**
 * Get Reading Detail Handler (AC#3)
 *
 * Returns period reading detail with evidence photos via PortRegistry.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetReadingDetailQuery } from '../get-reading-detail.query';
import type { ReadingDetail } from '../../dtos/meter-reading.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetReadingDetailQuery)
export class GetReadingDetailHandler implements IQueryHandler<GetReadingDetailQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetReadingDetailQuery): Promise<ReadingDetail> {
    const result: PortResult<ReadingDetail> = await this.portRegistry.execute<ReadingDetail>(
      'meter-reading',
      'get-reading-detail',
      { customerId: query.customerId, period: query.period },
    );
    return result.data;
  }
}
