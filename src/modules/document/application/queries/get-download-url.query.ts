import { IQuery } from '@core/application';
import type { GetDownloadUrlResponse } from '../dtos/document.dto';

export class GetDownloadUrlQuery extends IQuery<GetDownloadUrlResponse> {
  constructor(
    public readonly customerId: string,
    public readonly fileKey: string,
  ) {
    super();
  }
}

export type GetDownloadUrlResult = GetDownloadUrlResponse;
