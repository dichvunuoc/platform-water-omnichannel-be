/**
 * Get Meter By Customer Handler (AC#1)
 *
 * Returns MeterListResponse (array) via PortRegistry.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetMeterByCustomerQuery } from '../get-meter-by-customer.query';
import type { MeterListResponse } from '../../dtos/meter.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetMeterByCustomerQuery)
export class GetMeterByCustomerHandler implements IQueryHandler<GetMeterByCustomerQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetMeterByCustomerQuery): Promise<MeterListResponse> {
    const result: PortResult<MeterListResponse> = await this.portRegistry.execute<MeterListResponse>(
      'meter',
      'get-meter-by-customer',
      { customerId: query.customerId },
    );
    return result.data;
  }
}
