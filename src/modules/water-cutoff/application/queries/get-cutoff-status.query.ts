import { IQuery } from '@core/application';
import type { CutoffStatus } from '../dtos/water-cutoff.dto';

export class GetCutoffStatusQuery extends IQuery<CutoffStatus> {
  constructor(public readonly customerId: string) {
    super();
  }
}
export type GetCutoffStatusResult = CutoffStatus;
