import { IQuery } from '@core/application';
import type { QualityAlertsResponse } from '../dtos/water-quality.dto';

export class GetQualityAlertsQuery extends IQuery<QualityAlertsResponse> {
  constructor(public readonly area?: string) {
    super();
  }
}
export type GetQualityAlertsResult = QualityAlertsResponse;
