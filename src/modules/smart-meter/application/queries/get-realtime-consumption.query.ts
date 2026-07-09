import { IQuery } from '@core/application';
import type { RealtimeConsumption } from '../dtos/smart-meter.dto';

export class GetRealtimeConsumptionQuery extends IQuery<RealtimeConsumption> {
  constructor(public readonly customerId: string) {
    super();
  }
}
export type GetRealtimeConsumptionResult = RealtimeConsumption;
