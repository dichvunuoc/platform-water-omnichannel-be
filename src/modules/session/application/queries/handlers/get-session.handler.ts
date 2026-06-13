import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetSessionQuery, GetSessionResult } from '../get-session.query';
import { SESSION_STORE_TOKEN } from '../../../constants/tokens';
import type { ISessionStore } from '../../../domain/repositories/session-store.interface';

@QueryHandler(GetSessionQuery)
export class GetSessionHandler implements IQueryHandler<GetSessionQuery, GetSessionResult> {
  constructor(
    @Inject(SESSION_STORE_TOKEN) private readonly sessionStore: ISessionStore,
  ) {}

  async execute(query: GetSessionQuery): Promise<GetSessionResult> {
    return this.sessionStore.getSession(query.userId);
  }
}
