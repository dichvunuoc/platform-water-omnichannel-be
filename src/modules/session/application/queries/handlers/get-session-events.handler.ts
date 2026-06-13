import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetSessionEventsQuery, GetSessionEventsResult } from '../get-session-events.query';
import { SESSION_STORE_TOKEN } from '../../../constants/tokens';
import type { ISessionStore } from '../../../domain/repositories/session-store.interface';
import type { SessionEvent } from '../../dtos/session-event.dto';

@QueryHandler(GetSessionEventsQuery)
export class GetSessionEventsHandler
  implements IQueryHandler<GetSessionEventsQuery, GetSessionEventsResult>
{
  constructor(
    @Inject(SESSION_STORE_TOKEN) private readonly sessionStore: ISessionStore,
  ) {}

  async execute(query: GetSessionEventsQuery): Promise<GetSessionEventsResult> {
    const { userId, params } = query;
    const from = params?.from;
    const to = params?.to;
    const channel = params?.channel;
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;

    // Fetch session metadata for sessionId
    const metadata = await this.sessionStore.getSession(userId);

    // Fetch all time-range events from Redis (O(log N) via ZRANGEBYSCORE)
    let events: SessionEvent[] = await this.sessionStore.getEvents(userId, from, to);

    // Secondary channel filter (in-memory on time-range reduced set)
    if (channel) {
      events = events.filter((e) => e.channel === channel);
    }

    const totalCount = events.length;
    const offset = (page - 1) * pageSize;
    const paginatedEvents = events.slice(offset, offset + pageSize);

    return {
      sessionId: metadata?.sessionId ?? null,
      events: paginatedEvents,
      totalCount,
      page,
      pageSize,
    };
  }
}
