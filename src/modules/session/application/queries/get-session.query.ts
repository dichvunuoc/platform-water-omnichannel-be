import { IQuery } from '@core/application';
import type { SessionMetadata } from '../dtos/session-event.dto';

export class GetSessionQuery extends IQuery<SessionMetadata | null> {
  constructor(public readonly userId: string) {
    super();
  }
}

export type GetSessionResult = SessionMetadata | null;
