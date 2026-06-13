import { EnsureSessionHandler } from './ensure-session.handler';
import { EnsureSessionCommand } from '../ensure-session.command';
import type { ISessionStore } from '../../../domain/repositories/session-store.interface';
import type { SessionMetadata } from '../../dtos/session-event.dto';

describe('EnsureSessionHandler', () => {
  let handler: EnsureSessionHandler;
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
      appendEvent: jest.fn().mockResolvedValue(undefined),
      getSession: jest.fn().mockResolvedValue(mockMetadata),
      getEvents: jest.fn(),
      sessionExists: jest.fn().mockResolvedValue(true),
    };

    handler = new EnsureSessionHandler(sessionStore as any);
  });

  // ── New session created (AC#3) ───────────────────────────────────────────────

  describe('new session creation', () => {
    it('should create session_started event when session does not exist', async () => {
      sessionStore.sessionExists.mockResolvedValue(false);

      await handler.execute(new EnsureSessionCommand('USR-001', 'web'));

      expect(sessionStore.appendEvent).toHaveBeenCalledTimes(1);
      const [userId, event] = sessionStore.appendEvent.mock.calls[0];
      expect(userId).toBe('USR-001');
      expect(event.type).toBe('session_started');
      expect(event.channel).toBe('web');
      expect(event.content).toEqual({ channel: 'web' });
    });

    it('should log new session creation', async () => {
      sessionStore.sessionExists.mockResolvedValue(false);
      const logSpy = jest.spyOn(handler['logger'], 'log');

      await handler.execute(new EnsureSessionCommand('USR-001', 'web'));

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('New session created for USR-001 on web'),
      );
    });
  });

  // ── Existing session, same channel ───────────────────────────────────────────

  describe('existing session same channel', () => {
    it('should NOT record any event when channel is the same', async () => {
      // metadata.channel = 'zalo', command channel = 'zalo'
      await handler.execute(new EnsureSessionCommand('USR-001', 'zalo'));

      expect(sessionStore.appendEvent).not.toHaveBeenCalled();
    });
  });

  // ── Channel switch (AC#2) ────────────────────────────────────────────────────

  describe('channel switch', () => {
    it('should record session_continued event when channel differs', async () => {
      // metadata.channel = 'zalo', command channel = 'web'
      await handler.execute(new EnsureSessionCommand('USR-001', 'web'));

      expect(sessionStore.appendEvent).toHaveBeenCalledTimes(1);
      const [userId, event] = sessionStore.appendEvent.mock.calls[0];
      expect(userId).toBe('USR-001');
      expect(event.type).toBe('session_continued');
      expect(event.channel).toBe('web');
      expect(event.content).toEqual({
        fromChannel: 'zalo',
        toChannel: 'web',
      });
    });

    it('should log channel switch', async () => {
      const logSpy = jest.spyOn(handler['logger'], 'log');

      await handler.execute(new EnsureSessionCommand('USR-001', 'web'));

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Session continued for USR-001: zalo → web'),
      );
    });

    it('should NOT record event if metadata is null despite exists returning true', async () => {
      sessionStore.getSession.mockResolvedValue(null);

      await handler.execute(new EnsureSessionCommand('USR-001', 'web'));

      expect(sessionStore.appendEvent).not.toHaveBeenCalled();
    });
  });

  // ── Error resilience ─────────────────────────────────────────────────────────

  describe('error resilience', () => {
    it('should NOT throw when appendEvent fails on new session', async () => {
      sessionStore.sessionExists.mockResolvedValue(false);
      sessionStore.appendEvent.mockRejectedValue(new Error('Redis down'));

      await expect(
        handler.execute(new EnsureSessionCommand('USR-001', 'web')),
      ).resolves.toBeUndefined();
    });

    it('should log error when appendEvent fails', async () => {
      sessionStore.sessionExists.mockResolvedValue(false);
      sessionStore.appendEvent.mockRejectedValue(new Error('Redis down'));
      const errorSpy = jest.spyOn(handler['logger'], 'error');

      await handler.execute(new EnsureSessionCommand('USR-001', 'web'));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to ensure session for USR-001'),
      );
    });
  });
});
