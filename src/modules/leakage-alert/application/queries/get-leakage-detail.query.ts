import { IQuery } from '@core/application';
import type { LeakageDetail } from '../dtos/leakage-alert.dto';

export class GetLeakageDetailQuery extends IQuery<LeakageDetail> {
  constructor(public readonly alertId: string) {
    super();
  }
}
export type GetLeakageDetailResult = LeakageDetail;
