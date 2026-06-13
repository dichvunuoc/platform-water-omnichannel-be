import { RecordSessionEventHandler } from './record-session-event.handler';
import { RecordSessionEventCommand } from '../record-session-event.command';
import type { ISessionStore } from '../../../domain/repositories/session-store.interface';

describe('RecordSessionEventHandler', () => {
  let handler: RecordSessionEventHandler;
  let sessionStore: jest.Mocked<ISessionStore>;

  beforeEach(() => {
    sessionStore = {
      appendEvent: jest.fn().mockResolvedValue(undefined),
      getSession: jest.fn(),
      getEvents: jest.fn(),
      sessionExists: jest.fn(),
    };

    handler = new RecordSessionEventHandler(sessionStore as any);
  });

  const validPayload = {
    userId: 'USR-001',
    eventType: 'notification_sent' as const,
    channel: 'zalo' as const,
    content: { notificationType: 'payment_completed' },
  };

  // ── Success ──────────────────────────────────────────────────────────────────

  describe('successful event recording', () => {
    it('should build event with UUID and timestamp and call appendEvent', async () => {
      await handler.execute(new RecordSessionEventCommand(validPayload));

      expect(sessionStore.appendEvent).toHaveBeenCalledTimes(1);
      const [userId, event] = sessionStore.appendEvent.mock.calls[0];

      expect(userId).toBe('USR-001');
      expect(event.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(event.type).toBe('notification_sent');
      expect(event.channel).toBe('zalo');
      expect(event.timestamp).toBeTruthy();
      expect(event.content).toEqual({ notificationType: 'payment_completed' });
    });

    it('should log success on recording', async () => {
      const logSpy = jest.spyOn(handler['logger'], 'log');

      await handler.execute(new RecordSessionEventCommand(validPayload));

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Session event recorded: notification_sent for USR-001'),
      );
    });
  });

  // ── Store failure ────────────────────────────────────────────────────────────

  describe('store failure handling', () => {
    it('should NOT throw when sessionStore.appendEvent fails', async () => {
      sessionStore.appendEvent.mockRejectedValue(new Error('Redis connection lost'));

      await expect(
        handler.execute(new RecordSessionEventCommand(validPayload)),
      ).resolves.toBeUndefined();
    });

    it('should log error when sessionStore.appendEvent fails', async () => {
      const errorSpy = jest.spyOn(handler['logger'], 'error');
      sessionStore.appendEvent.mockRejectedValue(new Error('Redis connection lost'));

      await handler.execute(new RecordSessionEventCommand(validPayload));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to record session event: notification_sent for USR-001'),
        expect.any(Error),
      );
    });
  });

  // ── Payload validation ───────────────────────────────────────────────────────

  describe('payload validation', () => {
    it('should reject invalid event type without calling appendEvent', async () => {
      const warnSpy = jest.spyOn(handler['logger'], 'warn');

      const invalidPayload = {
        userId: 'USR-001',
        eventType: 'invalid_event_type' as any,
        channel: 'zalo' as const,
        content: {},
      };

      await handler.execute(new RecordSessionEventCommand(invalidPayload));

      expect(sessionStore.appendEvent).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid session event payload'),
      );
    });

    it('should reject invalid channel without calling appendEvent', async () => {
      const warnSpy = jest.spyOn(handler['logger'], 'warn');

      const invalidPayload = {
        userId: 'USR-001',
        eventType: 'notification_sent' as const,
        channel: 'telegram' as any,
        content: {},
      };

      await handler.execute(new RecordSessionEventCommand(invalidPayload));

      expect(sessionStore.appendEvent).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid session event payload'),
      );
    });

    it('should reject empty userId without calling appendEvent', async () => {
      const warnSpy = jest.spyOn(handler['logger'], 'warn');

      const invalidPayload = {
        userId: '',
        eventType: 'notification_sent' as const,
        channel: 'zalo' as const,
        content: {},
      };

      await handler.execute(new RecordSessionEventCommand(invalidPayload));

      expect(sessionStore.appendEvent).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid session event payload'),
      );
    });
  });
});
