import { GetSessionHandler } from './get-session.handler';
import { GetSessionQuery } from '../get-session.query';
import type { ISessionStore } from '../../../domain/repositories/session-store.interface';
import type { SessionMetadata } from '../../dtos/session-event.dto';

describe('GetSessionHandler', () => {
  let handler: GetSessionHandler;
  let sessionStore: jest.Mocked<ISessionStore>;

  const mockMetadata: SessionMetadata = {
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    userId: 'USR-001',
    channel: 'zalo',
    createdAt: '2026-06-12T10:00:00Z',
    updatedAt: '2026-06-12T10:30:00Z',
    eventCount: 5,
  };

  beforeEach(() => {
    sessionStore = {
      appendEvent: jest.fn(),
      getSession: jest.fn().mockResolvedValue(null),
      getEvents: jest.fn(),
      sessionExists: jest.fn(),
    };

    handler = new GetSessionHandler(sessionStore as any);
  });

  // ── Session found ────────────────────────────────────────────────────────────

  describe('session found', () => {
    it('should return session metadata', async () => {
      sessionStore.getSession.mockResolvedValue(mockMetadata);

      const result = await handler.execute(new GetSessionQuery('USR-001'));

      expect(result).toEqual(mockMetadata);
      expect(sessionStore.getSession).toHaveBeenCalledWith('USR-001');
    });
  });

  // ── Session not found ────────────────────────────────────────────────────────

  describe('session not found', () => {
    it('should return null when session does not exist', async () => {
      sessionStore.getSession.mockResolvedValue(null);

      const result = await handler.execute(new GetSessionQuery('USR-NONEXISTENT'));

      expect(result).toBeNull();
    });
  });
});
