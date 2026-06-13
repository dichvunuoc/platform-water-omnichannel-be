import { IQuery } from '@core/application';
import type { SessionEventsResponse, SessionEventsQuery } from '../dtos/session-query.dto';

export class GetSessionEventsQuery extends IQuery<SessionEventsResponse> {
  constructor(
    public readonly userId: string,
    public readonly params?: SessionEventsQuery,
  ) {
    super();
  }
}

export type GetSessionEventsResult = SessionEventsResponse;
