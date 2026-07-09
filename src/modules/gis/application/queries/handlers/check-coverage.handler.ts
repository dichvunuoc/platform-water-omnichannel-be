import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { CheckCoverageQuery, CheckCoverageResult } from '../check-coverage.query';
import type { CoverageResult } from '../../dtos/gis.dto';

@QueryHandler(CheckCoverageQuery)
export class CheckCoverageHandler implements IQueryHandler<CheckCoverageQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: CheckCoverageQuery): Promise<CheckCoverageResult> {
    const result: PortResult<CoverageResult> = await this.portRegistry.execute<CoverageResult>(
      'gis',
      'check-coverage',
      { address: query.address },
    );
    if (!result?.data) throw new PortFallbackException('gis');
    return result.data;
  }
}
