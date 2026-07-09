import { IQuery } from '@core/application';
import type { AnomalyDetail } from '../dtos/meter-anomaly.dto';

export class GetAnomalyDetailQuery extends IQuery<AnomalyDetail> {
  constructor(public readonly alertId: string) {
    super();
  }
}
export type GetAnomalyDetailResult = AnomalyDetail;
