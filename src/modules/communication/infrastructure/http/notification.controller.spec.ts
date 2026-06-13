import { NotificationController } from './notification.controller';
import { GetNotificationPreferencesQuery } from '../../application/queries/get-notification-preferences.query';
import { GetNotificationHistoryQuery } from '../../application/queries/get-notification-history.query';
import { UpdateNotificationPreferencesCommand } from '../../application/commands/update-notification-preferences.command';
import { ValidationException } from '@core/common';

function mockBus() {
  return { execute: jest.fn() };
}

describe('NotificationController', () => {
  let controller: NotificationController;
  let queryBus: ReturnType<typeof mockBus>;
  let commandBus: ReturnType<typeof mockBus>;

  const TEST_USER_ID = 'USR-SESSION-001';

  const mockPreferencesResponse = {
    customerId: TEST_USER_ID,
    channels: [
      { channel: 'push', enabled: true, isCritical: true },
      { channel: 'in_app', enabled: true, isCritical: true },
      { channel: 'zns', enabled: true, isCritical: false },
      { channel: 'sms', enabled: false, isCritical: false },
      { channel: 'email', enabled: true, isCritical: false },
    ],
    updatedAt: '2026-06-11T10:30:00Z',
  };

  const mockHistoryResponse = {
    notifications: [
      {
        id: 'NTF-001',
        type: 'payment_completed',
        channel: 'zns',
        contentSummary: 'Thanh toán hóa đơn INV-2026-0042 thành công',
        timestamp: '2026-06-11T09:15:00Z',
        deliveryStatus: 'delivered',
      },
    ],
    totalCount: 1,
    page: 1,
    pageSize: 20,
  };

  const mockUpdateResponse = {
    customerId: TEST_USER_ID,
    channels: [
      { channel: 'push', enabled: true, isCritical: true },
      { channel: 'in_app', enabled: true, isCritical: true },
      { channel: 'zns', enabled: false, isCritical: false },
      { channel: 'sms', enabled: true, isCritical: false },
      { channel: 'email', enabled: true, isCritical: false },
    ],
    updatedAt: '2026-06-11T10:35:00Z',
  };

  beforeEach(() => {
    queryBus = mockBus();
    commandBus = mockBus();
    controller = new NotificationController(queryBus as any, commandBus as any);
  });

  // ── GET /notifications/preferences (AC#1) ──────────────────────────────────

  describe('GET /notifications/preferences', () => {
    it('should return notification preferences', async () => {
      queryBus.execute.mockResolvedValue(mockPreferencesResponse);

      const result = await controller.getPreferences(TEST_USER_ID);

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetNotificationPreferencesQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(result.channels).toHaveLength(5);
    });
  });

  // ── PATCH /notifications/preferences (AC#2) ────────────────────────────────

  describe('PATCH /notifications/preferences', () => {
    it('should dispatch UpdateNotificationPreferencesCommand with valid body', async () => {
      commandBus.execute.mockResolvedValue(mockUpdateResponse);

      const body = {
        channels: [
          { channel: 'zns', enabled: false },
          { channel: 'sms', enabled: true },
        ],
      };

      const result = await controller.updatePreferences(TEST_USER_ID, body);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const callArg = commandBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(UpdateNotificationPreferencesCommand);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.payload.channels).toHaveLength(2);
      expect(result.updatedAt).toBeDefined();
    });

    it('should reject empty channels array', async () => {
      await expect(
        controller.updatePreferences(TEST_USER_ID, { channels: [] }),
      ).rejects.toThrow(ValidationException);
    });

    it('should reject invalid channel value', async () => {
      await expect(
        controller.updatePreferences(TEST_USER_ID, {
          channels: [{ channel: 'telegram', enabled: true }],
        }),
      ).rejects.toThrow(ValidationException);
    });

    it('should reject missing channels field', async () => {
      await expect(
        controller.updatePreferences(TEST_USER_ID, {}),
      ).rejects.toThrow(ValidationException);
    });
  });

  // ── GET /notifications/history (AC#3) ──────────────────────────────────────

  describe('GET /notifications/history', () => {
    it('should return notification history with default pagination', async () => {
      queryBus.execute.mockResolvedValue(mockHistoryResponse);

      const result = await controller.getHistory(TEST_USER_ID, {});

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetNotificationHistoryQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(result.notifications).toHaveLength(1);
    });

    it('should pass date filters to query', async () => {
      queryBus.execute.mockResolvedValue(mockHistoryResponse);

      await controller.getHistory(TEST_USER_ID, {
        startDate: '2026-01-01',
        endDate: '2026-06-11',
      });

      const callArg = queryBus.execute.mock.calls[0][0];
      expect(callArg.filters.startDate).toBe('2026-01-01');
      expect(callArg.filters.endDate).toBe('2026-06-11');
    });

    it('should pass channel and type filters to query', async () => {
      queryBus.execute.mockResolvedValue(mockHistoryResponse);

      await controller.getHistory(TEST_USER_ID, {
        channel: 'zns',
        type: 'payment_completed',
      });

      const callArg = queryBus.execute.mock.calls[0][0];
      expect(callArg.filters.channel).toBe('zns');
      expect(callArg.filters.type).toBe('payment_completed');
    });

    it('should reject invalid startDate format', async () => {
      await expect(
        controller.getHistory(TEST_USER_ID, { startDate: 'not-a-date' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should reject invalid endDate format', async () => {
      await expect(
        controller.getHistory(TEST_USER_ID, { endDate: '2026/06/10' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should coerce page/pageSize from string to number', async () => {
      queryBus.execute.mockResolvedValue(mockHistoryResponse);

      await controller.getHistory(TEST_USER_ID, { page: '2', pageSize: '10' });

      const callArg = queryBus.execute.mock.calls[0][0];
      expect(callArg.filters.page).toBe(2);
      expect(callArg.filters.pageSize).toBe(10);
    });

    it('should reject pageSize > 50', async () => {
      await expect(
        controller.getHistory(TEST_USER_ID, { pageSize: '100' }),
      ).rejects.toThrow(ValidationException);
    });
  });

  // ── Class type verification ───────────────────────────────────────────────

  describe('Class type verification', () => {
    it('should dispatch GetNotificationPreferencesQuery from GET /preferences', async () => {
      queryBus.execute.mockResolvedValue(mockPreferencesResponse);

      await controller.getPreferences(TEST_USER_ID);
      expect(queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetNotificationPreferencesQuery);
    });

    it('should dispatch GetNotificationHistoryQuery from GET /history', async () => {
      queryBus.execute.mockResolvedValue(mockHistoryResponse);

      await controller.getHistory(TEST_USER_ID, {});
      expect(queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetNotificationHistoryQuery);
    });

    it('should dispatch UpdateNotificationPreferencesCommand from PATCH /preferences', async () => {
      commandBus.execute.mockResolvedValue(mockUpdateResponse);

      await controller.updatePreferences(TEST_USER_ID, {
        channels: [{ channel: 'push', enabled: true }],
      });
      expect(commandBus.execute.mock.calls[0][0]).toBeInstanceOf(UpdateNotificationPreferencesCommand);
    });
  });

  // ── Auth guard verification ───────────────────────────────────────────────

  describe('Auth protection', () => {
    it('should use ApiBearerAuth decorator for Swagger documentation', () => {
      const metadata = Reflect.getMetadata('swagger/apiSecurity', NotificationController);
      expect(metadata).toBeDefined();
      expect(metadata).toEqual(expect.arrayContaining([expect.objectContaining({ 'JWT-auth': expect.any(Array) })]));
    });
  });
});
