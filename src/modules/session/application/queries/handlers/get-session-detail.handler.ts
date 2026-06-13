import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetSessionDetailQuery, GetSessionDetailResult } from '../get-session-detail.query';
import { SESSION_STORE_TOKEN } from '../../../constants/tokens';
import type { ISessionStore } from '../../../domain/repositories/session-store.interface';

/** Time window for "recent events" in the session detail view (2 hours in ms) */
const RECENT_EVENTS_WINDOW_MS = 2 * 60 * 60 * 1000;

@QueryHandler(GetSessionDetailQuery)
export class GetSessionDetailHandler
  implements IQueryHandler<GetSessionDetailQuery, GetSessionDetailResult>
{
  constructor(
    @Inject(SESSION_STORE_TOKEN) private readonly sessionStore: ISessionStore,
  ) {}

  async execute(query: GetSessionDetailQuery): Promise<GetSessionDetailResult> {
    const { userId } = query;

    const metadata = await this.sessionStore.getSession(userId);
    if (!metadata) {
      return { session: null, recentEvents: [] };
    }

    // Get events from the recent window
    const windowStart = Date.now() - RECENT_EVENTS_WINDOW_MS;
    const recentEvents = await this.sessionStore.getEvents(userId, windowStart);

    return { session: metadata, recentEvents };
  }
}
