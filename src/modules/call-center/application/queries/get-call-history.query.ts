import { IQuery } from '@core/application';
import type { CallHistory } from '../dtos/call-center.dto';

export class GetCallHistoryQuery extends IQuery<CallHistory> {
  constructor(public readonly customerId: string) {
    super();
  }
}
export type GetCallHistoryResult = CallHistory;
