import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetSegmentHistoryQuery, GetSegmentHistoryResult } from '../get-segment-history.query';
import type { GetSegmentHistoryResponse } from '../../dtos/segmentation.dto';

@QueryHandler(GetSegmentHistoryQuery)
export class GetSegmentHistoryHandler implements IQueryHandler<GetSegmentHistoryQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetSegmentHistoryQuery): Promise<GetSegmentHistoryResult> {
    const result = await this.portRegistry.execute<GetSegmentHistoryResponse>(
      'segmentation',
      'get-segment-history',
      { customerId: query.customerId },
    );
    if (!result?.data) throw new PortFallbackException('segmentation');
    return result.data;
  }
}
