import { IQuery } from '@core/application';
import type { InspectionResult } from '../dtos/leakage-alert.dto';

export class GetInspectionResultQuery extends IQuery<InspectionResult> {
  constructor(public readonly alertId: string) {
    super();
  }
}
export type GetInspectionResultResult = InspectionResult;
