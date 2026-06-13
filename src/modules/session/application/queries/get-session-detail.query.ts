import { IQuery } from '@core/application';
import type { SessionDetailResponse } from '../dtos/session-query.dto';

export class GetSessionDetailQuery extends IQuery<SessionDetailResponse> {
  constructor(public readonly userId: string) {
    super();
  }
}

export type GetSessionDetailResult = SessionDetailResponse;
