import { IQuery } from '@core/application';
import type { GetSegmentHistoryResponse } from '../dtos/segmentation.dto';

export class GetSegmentHistoryQuery extends IQuery<GetSegmentHistoryResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}
export type GetSegmentHistoryResult = GetSegmentHistoryResponse;
