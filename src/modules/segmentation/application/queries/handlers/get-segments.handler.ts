import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetSegmentsQuery, GetSegmentsResult } from '../get-segments.query';
import type { GetSegmentsResponse } from '../../dtos/segmentation.dto';

@QueryHandler(GetSegmentsQuery)
export class GetSegmentsHandler implements IQueryHandler<GetSegmentsQuery> {
  private readonly logger = new Logger(GetSegmentsHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetSegmentsQuery): Promise<GetSegmentsResult> {
    const result: PortResult<GetSegmentsResponse> =
      await this.portRegistry.execute<GetSegmentsResponse>(
        'segmentation',
        'get-segments',
        { customerId: query.customerId },
      );
    const data = result?.data;
    if (!data) throw new PortFallbackException('segmentation');
    return data;
  }
}
