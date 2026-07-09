import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetCallHistoryQuery, GetCallHistoryResult } from '../get-call-history.query';
import type { CallHistory } from '../../dtos/call-center.dto';

@QueryHandler(GetCallHistoryQuery)
export class GetCallHistoryHandler implements IQueryHandler<GetCallHistoryQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetCallHistoryQuery): Promise<GetCallHistoryResult> {
    const r = await this.portRegistry.execute<CallHistory>('call-center', 'get-call-history', {
      customerId: query.customerId,
    });
    if (!r?.data) throw new PortFallbackException('call-center');
    return r.data;
  }
}
