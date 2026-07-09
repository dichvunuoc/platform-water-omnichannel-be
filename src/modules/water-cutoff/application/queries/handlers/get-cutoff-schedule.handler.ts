import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetCutoffScheduleQuery, GetCutoffScheduleResult } from '../get-cutoff-schedule.query';
import type { CutoffSchedule } from '../../dtos/water-cutoff.dto';

@QueryHandler(GetCutoffScheduleQuery)
export class GetCutoffScheduleHandler implements IQueryHandler<GetCutoffScheduleQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetCutoffScheduleQuery): Promise<GetCutoffScheduleResult> {
    const r = await this.portRegistry.execute<CutoffSchedule>('water-cutoff', 'get-cutoff-schedule', {
      areaId: query.areaId,
    });
    if (!r?.data) throw new PortFallbackException('water-cutoff');
    return r.data;
  }
}
