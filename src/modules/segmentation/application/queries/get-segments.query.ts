import { IQuery } from '@core/application';
import type { GetSegmentsResponse } from '../dtos/segmentation.dto';

export class GetSegmentsQuery extends IQuery<GetSegmentsResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}

export type GetSegmentsResult = GetSegmentsResponse;
