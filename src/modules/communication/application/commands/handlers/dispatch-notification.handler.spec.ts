import { DispatchNotificationHandler } from './dispatch-notification.handler';
import { DispatchNotificationCommand } from '../dispatch-notification.command';
import { RecordSessionEventCommand } from '@modules/session/application/commands/record-session-event.command';

interface MockRateLimiterService {
  check: jest.Mock;
  getFallbackChain: jest.Mock;
}

describe('DispatchNotificationHandler', () => {
  let handler: DispatchNotificationHandler;
  let portRegistry: { execute: jest.Mock };
  let rateLimiterService: MockRateLimiterService;
  let commandBus: { execute: jest.Mock };

  const mockDispatchResult = {
    dispatched: true,
    channel: 'zns' as const,
    rateLimited: false,
  };

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    rateLimiterService = {
      check: jest.fn(),
      getFallbackChain: jest.fn().mockReturnValue(['zns', 'push', 'in_app']),
    };
    commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    handler = new DispatchNotificationHandler(portRegistry as any, rateLimiterService as any, commandBus as any);
  });

  const TEST_CUSTOMER_ID = 'USR-001';

  // ── Success dispatch (AC#2) ──────────────────────────────────────────────

  describe('execute — success dispatch', () => {
    it('should dispatch via ZNS when rate limit allows', async () => {
      (rateLimiterService.check).mockResolvedValue({ allowed: true, currentCount: 1, limit: 2 });
      portRegistry.execute.mockResolvedValue({ data: mockDispatchResult });

      const result = await handler.execute(
        new DispatchNotificationCommand({
          customerId: TEST_CUSTOMER_ID,
          type: 'payment_completed',
          isCritical: true,
        }),
      );

      expect(result.dispatched).toBe(true);
      expect(result.channel).toBe('zns');
      expect(result.rateLimited).toBe(false);
      expect(portRegistry.execute).toHaveBeenCalledWith(
        'notification', 'dispatch-notification',
        expect.objectContaining({
          customerId: TEST_CUSTOMER_ID,
          type: 'payment_completed',
          channel: 'zns',
          useCache: false,
        }),
      );
    });

    it('should dispatch RecordSessionEventCommand on successful dispatch', async () => {
      (rateLimiterService.check).mockResolvedValue({ allowed: true, currentCount: 1, limit: 2 });
      portRegistry.execute.mockResolvedValue({ data: mockDispatchResult });

      await handler.execute(
        new DispatchNotificationCommand({
          customerId: TEST_CUSTOMER_ID,
          type: 'payment_completed',
          isCritical: true,
        }),
      );

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const callArg = commandBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(RecordSessionEventCommand);
      expect(callArg.payload.userId).toBe(TEST_CUSTOMER_ID);
      expect(callArg.payload.eventType).toBe('notification_sent');
      expect(callArg.payload.channel).toBe('zalo'); // zns → zalo mapping
    });
  });

  // ── Critical + ZNS rate limited → fallback to push (AC#1) ────────────────

  describe('execute — critical + fallback', () => {
    it('should fallback from ZNS to push when ZNS rate limited', async () => {
      (rateLimiterService.check as jest.Mock)
        .mockResolvedValueOnce({ allowed: false, currentCount: 3, limit: 2 }) // ZNS blocked
        .mockResolvedValueOnce({ allowed: true, currentCount: 1, limit: 50 }); // Push allowed
      portRegistry.execute.mockResolvedValue({
        data: { dispatched: true, channel: 'push', rateLimited: false },
      });

      const result = await handler.execute(
        new DispatchNotificationCommand({
          customerId: TEST_CUSTOMER_ID,
          type: 'payment_completed',
          isCritical: true,
        }),
      );

      expect(result.dispatched).toBe(true);
      expect(result.channel).toBe('push');
      expect(result.rateLimited).toBe(false);
      expect(result.fallbackChain).toEqual(['zns']);
    });

    it('should fallback through entire chain if needed', async () => {
      (rateLimiterService.check as jest.Mock)
        .mockResolvedValueOnce({ allowed: false, currentCount: 3, limit: 2 }) // ZNS blocked
        .mockResolvedValueOnce({ allowed: false, currentCount: 51, limit: 50 }) // Push blocked
        .mockResolvedValueOnce({ allowed: true, currentCount: 0, limit: Infinity }); // In-App always allowed
      portRegistry.execute.mockResolvedValue({
        data: { dispatched: true, channel: 'in_app', rateLimited: false },
      });

      const result = await handler.execute(
        new DispatchNotificationCommand({
          customerId: TEST_CUSTOMER_ID,
          type: 'payment_failed',
          isCritical: true,
        }),
      );

      expect(result.dispatched).toBe(true);
      expect(result.channel).toBe('in_app');
      expect(result.fallbackChain).toEqual(['zns', 'push']);
    });
  });

  // ── Critical + all channels exhausted (should not happen) ────────────────

  describe('execute — critical all exhausted', () => {
    it('should return dispatched false when all channels fail', async () => {
      (rateLimiterService.check as jest.Mock)
        .mockResolvedValue({ allowed: false, currentCount: 999, limit: 0 });
      // Even in_app returns false (shouldn't happen but defensive)

      const result = await handler.execute(
        new DispatchNotificationCommand({
          customerId: TEST_CUSTOMER_ID,
          type: 'payment_completed',
          isCritical: true,
        }),
      );

      expect(result.dispatched).toBe(false);
      expect(result.rateLimited).toBe(true);
    });
  });

  // ── Non-critical + rate limited → DROP (AC#1) ────────────────────────────

  describe('execute — non-critical drop', () => {
    it('should drop non-critical notification when rate limited', async () => {
      (rateLimiterService.check).mockResolvedValue({
        allowed: false, currentCount: 3, limit: 2,
      });

      const result = await handler.execute(
        new DispatchNotificationCommand({
          customerId: TEST_CUSTOMER_ID,
          type: 'ticket_status_changed',
          isCritical: false,
        }),
      );

      expect(result.dispatched).toBe(false);
      expect(result.rateLimited).toBe(true);
      expect(portRegistry.execute).not.toHaveBeenCalled();
    });

    it('should allow non-critical when rate limit not hit', async () => {
      (rateLimiterService.check).mockResolvedValue({
        allowed: true, currentCount: 1, limit: 2,
      });
      portRegistry.execute.mockResolvedValue({ data: mockDispatchResult });

      const result = await handler.execute(
        new DispatchNotificationCommand({
          customerId: TEST_CUSTOMER_ID,
          type: 'ticket_status_changed',
          isCritical: false,
        }),
      );

      expect(result.dispatched).toBe(true);
    });
  });

  // ── Port returns null → skip channel (AC#2) ──────────────────────────────

  describe('execute — port returns null', () => {
    it('should skip channel when port returns null data', async () => {
      (rateLimiterService.check as jest.Mock)
        .mockResolvedValueOnce({ allowed: true, currentCount: 1, limit: 2 }) // ZNS allowed
        .mockResolvedValueOnce({ allowed: true, currentCount: 1, limit: 50 }); // Push allowed
      portRegistry.execute
        .mockResolvedValueOnce({ data: null }) // ZNS port returns null
        .mockResolvedValueOnce({ data: { dispatched: true, channel: 'push', rateLimited: false } }); // Push works

      const result = await handler.execute(
        new DispatchNotificationCommand({
          customerId: TEST_CUSTOMER_ID,
          type: 'payment_completed',
          isCritical: true,
        }),
      );

      expect(result.dispatched).toBe(true);
      expect(result.channel).toBe('push');
      expect(result.fallbackChain).toEqual(['zns']);
    });
  });
});
