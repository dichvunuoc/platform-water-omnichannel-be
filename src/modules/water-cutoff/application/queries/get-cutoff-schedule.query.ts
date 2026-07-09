import { IQuery } from '@core/application';
import type { CutoffSchedule } from '../dtos/water-cutoff.dto';

export class GetCutoffScheduleQuery extends IQuery<CutoffSchedule> {
  constructor(public readonly areaId: string) {
    super();
  }
}
export type GetCutoffScheduleResult = CutoffSchedule;
