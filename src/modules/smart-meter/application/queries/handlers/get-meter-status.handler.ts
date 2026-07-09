import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetMeterStatusQuery, GetMeterStatusResult } from '../get-meter-status.query';
import type { SmartMeterStatus } from '../../dtos/smart-meter.dto';

@QueryHandler(GetMeterStatusQuery)
export class GetMeterStatusHandler implements IQueryHandler<GetMeterStatusQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetMeterStatusQuery): Promise<GetMeterStatusResult> {
    const r = await this.portRegistry.execute<SmartMeterStatus>('smart-meter', 'get-meter-status', {
      meterId: query.meterId,
    });
    if (!r?.data) throw new PortFallbackException('smart-meter');
    return r.data;
  }
}
