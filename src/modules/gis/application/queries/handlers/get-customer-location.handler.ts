import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetCustomerLocationQuery, GetCustomerLocationResult } from '../get-customer-location.query';
import type { GetCustomerLocationResponse } from '../../dtos/gis.dto';

@QueryHandler(GetCustomerLocationQuery)
export class GetCustomerLocationHandler implements IQueryHandler<GetCustomerLocationQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetCustomerLocationQuery): Promise<GetCustomerLocationResult> {
    const result: PortResult<GetCustomerLocationResponse> =
      await this.portRegistry.execute<GetCustomerLocationResponse>(
        'gis',
        'get-customer-location',
        { customerId: query.customerId },
      );
    if (!result?.data) throw new PortFallbackException('gis');
    return result.data;
  }
}
