import { GetSessionEventsHandler } from './get-session-events.handler';
import { GetSessionEventsQuery } from '../get-session-events.query';
import type { ISessionStore } from '../../../domain/repositories/session-store.interface';
import type { SessionEvent, SessionMetadata } from '../../dtos/session-event.dto';

describe('GetSessionEventsHandler', () => {
  let handler: GetSessionEventsHandler;
  let sessionStore: jest.Mocked<ISessionStore>;

  const mockMetadata: SessionMetadata = {
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    userId: 'USR-001',
    channel: 'zalo',
    createdAt: '2026-06-12T10:00:00Z',
    updatedAt: '2026-06-12T10:30:00Z',
    eventCount: 5,
  };

  const mockEvents: SessionEvent[] = [
    {
      id: '550e8400-e29b-41d4-a716-446655440010',
      type: 'notification_sent',
      channel: 'zalo',
      timestamp: '2026-06-12T10:00:00Z',
      content: { notificationType: 'payment_completed' },
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440011',
      type: 'ticket_status_changed',
      channel: 'web',
      timestamp: '2026-06-12T10:30:00Z',
      content: { ticketId: 'TICK-001' },
    },
  ];

  beforeEach(() => {
    sessionStore = {
      appendEvent: jest.fn(),
      getSession: jest.fn().mockResolvedValue(mockMetadata),
      getEvents: jest.fn().mockResolvedValue([]),
      sessionExists: jest.fn(),
    };

    handler = new GetSessionEventsHandler(sessionStore as any);
  });

  // ── Events found with time range ─────────────────────────────────────────────

  describe('events found', () => {
    it('should return paginated events within time range', async () => {
      sessionStore.getEvents.mockResolvedValue(mockEvents);

      const from = Date.now() - 7200000;
      const to = Date.now();
      const result = await handler.execute(
        new GetSessionEventsQuery('USR-001', { from, to, page: 1, pageSize: 20 }),
      );

      expect(result.events).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.sessionId).toBe(mockMetadata.sessionId);
      expect(sessionStore.getEvents).toHaveBeenCalledWith('USR-001', from, to);
    });

    it('should query without params when not specified', async () => {
      sessionStore.getEvents.mockResolvedValue(mockEvents);

      const result = await handler.execute(
        new GetSessionEventsQuery('USR-001'),
      );

      expect(sessionStore.getEvents).toHaveBeenCalledWith('USR-001', undefined, undefined);
      expect(result.events).toHaveLength(2);
    });

    it('should filter by channel', async () => {
      sessionStore.getEvents.mockResolvedValue(mockEvents);

      const result = await handler.execute(
        new GetSessionEventsQuery('USR-001', { channel: 'zalo', page: 1, pageSize: 20 }),
      );

      expect(result.events).toHaveLength(1);
      expect(result.events[0].channel).toBe('zalo');
      expect(result.totalCount).toBe(1);
    });

    it('should paginate correctly', async () => {
      const manyEvents: SessionEvent[] = Array.from({ length: 25 }, (_, i) => ({
        id: `evt-${i}`,
        type: 'notification_sent' as const,
        channel: 'zalo' as const,
        timestamp: new Date().toISOString(),
        content: { idx: i },
      }));
      sessionStore.getEvents.mockResolvedValue(manyEvents);

      const result = await handler.execute(
        new GetSessionEventsQuery('USR-001', { page: 2, pageSize: 10 }),
      );

      expect(result.events).toHaveLength(10);
      expect(result.totalCount).toBe(25);
      expect(result.page).toBe(2);
      expect(result.events[0].id).toBe('evt-10');
    });
  });

  // ── No events ────────────────────────────────────────────────────────────────

  describe('no events', () => {
    it('should return empty events array when no events found', async () => {
      sessionStore.getEvents.mockResolvedValue([]);
      sessionStore.getSession.mockResolvedValue(null);

      const result = await handler.execute(
        new GetSessionEventsQuery('USR-NONEXISTENT'),
      );

      expect(result.events).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.sessionId).toBeNull();
    });
  });
});
