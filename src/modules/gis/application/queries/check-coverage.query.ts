import { IQuery } from '@core/application';
import type { CoverageResult } from '../dtos/gis.dto';

export class CheckCoverageQuery extends IQuery<CoverageResult> {
  constructor(public readonly address: string) {
    super();
  }
}
export type CheckCoverageResult = CoverageResult;
