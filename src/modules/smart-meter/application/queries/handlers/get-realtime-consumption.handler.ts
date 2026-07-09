import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetRealtimeConsumptionQuery, GetRealtimeConsumptionResult } from '../get-realtime-consumption.query';
import type { RealtimeConsumption } from '../../dtos/smart-meter.dto';

@QueryHandler(GetRealtimeConsumptionQuery)
export class GetRealtimeConsumptionHandler implements IQueryHandler<GetRealtimeConsumptionQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetRealtimeConsumptionQuery): Promise<GetRealtimeConsumptionResult> {
    const r = await this.portRegistry.execute<RealtimeConsumption>(
      'smart-meter',
      'get-realtime-consumption',
      { customerId: query.customerId },
    );
    if (!r?.data) throw new PortFallbackException('smart-meter');
    return r.data;
  }
}
