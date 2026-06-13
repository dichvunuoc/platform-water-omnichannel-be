import { GetSessionDetailHandler } from './get-session-detail.handler';
import { GetSessionDetailQuery } from '../get-session-detail.query';
import type { ISessionStore } from '../../../domain/repositories/session-store.interface';
import type { SessionEvent, SessionMetadata } from '../../dtos/session-event.dto';

describe('GetSessionDetailHandler', () => {
  let handler: GetSessionDetailHandler;
  let sessionStore: jest.Mocked<ISessionStore>;

  const mockMetadata: SessionMetadata = {
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    userId: 'USR-001',
    channel: 'zalo',
    createdAt: '2026-06-12T10:00:00Z',
    updatedAt: '2026-06-12T10:30:00Z',
    eventCount: 5,
  };

  const mockRecentEvents: SessionEvent[] = [
    {
      id: '550e8400-e29b-41d4-a716-446655440010',
      type: 'notification_sent',
      channel: 'zalo',
      timestamp: new Date().toISOString(),
      content: { notificationType: 'payment_completed' },
    },
  ];

  beforeEach(() => {
    sessionStore = {
      appendEvent: jest.fn(),
      getSession: jest.fn().mockResolvedValue(null),
      getEvents: jest.fn().mockResolvedValue([]),
      sessionExists: jest.fn(),
    };

    handler = new GetSessionDetailHandler(sessionStore as any);
  });

  // ── Session found ────────────────────────────────────────────────────────────

  describe('session found', () => {
    it('should return metadata and recent events (last 2h)', async () => {
      sessionStore.getSession.mockResolvedValue(mockMetadata);
      sessionStore.getEvents.mockResolvedValue(mockRecentEvents);

      const result = await handler.execute(new GetSessionDetailQuery('USR-001'));

      expect(result.session).toEqual(mockMetadata);
      expect(result.recentEvents).toEqual(mockRecentEvents);
      // Should pass a timestamp ~2h ago
      expect(sessionStore.getEvents).toHaveBeenCalledWith(
        'USR-001',
        expect.any(Number),
      );
    });
  });

  // ── Session not found ────────────────────────────────────────────────────────

  describe('session not found', () => {
    it('should return null session and empty events when no session exists', async () => {
      sessionStore.getSession.mockResolvedValue(null);

      const result = await handler.execute(new GetSessionDetailQuery('USR-NONEXISTENT'));

      expect(result).toEqual({ session: null, recentEvents: [] });
      // Should NOT fetch events if no session
      expect(sessionStore.getEvents).not.toHaveBeenCalled();
    });
  });
});
