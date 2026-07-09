import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetInspectionResultQuery, GetInspectionResultResult } from '../get-inspection-result.query';
import type { InspectionResult } from '../../dtos/leakage-alert.dto';

@QueryHandler(GetInspectionResultQuery)
export class GetInspectionResultHandler implements IQueryHandler<GetInspectionResultQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetInspectionResultQuery): Promise<GetInspectionResultResult> {
    const result = await this.portRegistry.execute<InspectionResult>(
      'leakage-alert',
      'get-inspection-result',
      { alertId: query.alertId },
    );
    if (!result?.data) throw new PortFallbackException('leakage-alert');
    return result.data;
  }
}
