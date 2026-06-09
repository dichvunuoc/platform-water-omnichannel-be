/**
 * Get Meter History Handler (AC#3)
 *
 * Returns chronological list of meter events via PortRegistry.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetMeterHistoryQuery } from '../get-meter-history.query';
import type { MeterHistoryResponse } from '../../dtos/meter.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetMeterHistoryQuery)
export class GetMeterHistoryHandler implements IQueryHandler<GetMeterHistoryQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetMeterHistoryQuery): Promise<MeterHistoryResponse> {
    const result: PortResult<MeterHistoryResponse> = await this.portRegistry.execute<MeterHistoryResponse>(
      'meter',
      'get-meter-history',
      { customerId: query.customerId, meterId: query.meterId },
    );
    return result.data;
  }
}
