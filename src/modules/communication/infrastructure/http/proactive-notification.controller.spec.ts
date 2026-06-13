import { ProactiveNotificationController } from './proactive-notification.controller';
import { GetActiveAlertsQuery } from '../../application/queries/get-active-alerts.query';
import { GetAlertHistoryQuery } from '../../application/queries/get-alert-history.query';
import { AcknowledgeAlertCommand } from '../../application/commands/acknowledge-alert.command';
import { ValidationException } from '@core/common';

function mockBus() {
  return { execute: jest.fn() };
}

describe('ProactiveNotificationController', () => {
  let controller: ProactiveNotificationController;
  let queryBus: ReturnType<typeof mockBus>;
  let commandBus: ReturnType<typeof mockBus>;

  const TEST_USER_ID = 'USR-SESSION-001';

  const mockAlertsResponse = {
    alerts: [
      {
        id: 'ALERT-2026-001',
        type: 'outage',
        description: 'Cúp nước bảo trì đường ống Nguyễn Văn Cừ',
        affectedArea: 'Quận 1, Phường Bến Nghé',
        expectedStartTime: '2026-06-12T08:00:00+07:00',
        expectedEndTime: '2026-06-12T18:00:00+07:00',
        status: 'active',
        severity: 'high',
      },
    ],
    totalCount: 1,
  };

  const mockHistoryResponse = {
    alerts: [
      {
        id: 'ALERT-2026-000',
        type: 'quality',
        description: 'Chất lượng nước khu vực Thủ Đức',
        affectedArea: 'Thủ Đức',
        startTime: '2026-05-20T10:00:00+07:00',
        endTime: '2026-05-20T16:30:00+07:00',
        status: 'resolved',
        resolvedAt: '2026-05-20T16:30:00+07:00',
      },
    ],
    totalCount: 1,
    page: 1,
    pageSize: 20,
  };

  const mockAckResponse = {
    alertId: 'ALERT-2026-001',
    customerId: TEST_USER_ID,
    acknowledgedAt: '2026-06-10T14:30:00+07:00',
  };

  beforeEach(() => {
    queryBus = mockBus();
    commandBus = mockBus();
    controller = new ProactiveNotificationController(queryBus as any, commandBus as any);
  });

  // ── GET /proactive-notifications/active (AC#1) ──────────────────────────────

  describe('GET /proactive-notifications/active', () => {
    it('should return active alerts', async () => {
      queryBus.execute.mockResolvedValue(mockAlertsResponse);

      const result = await controller.getActiveAlerts(TEST_USER_ID);

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetActiveAlertsQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(result.alerts).toHaveLength(1);
      expect(result.totalCount).toBe(1);
    });
  });

  // ── GET /proactive-notifications/history (AC#2) ─────────────────────────────

  describe('GET /proactive-notifications/history', () => {
    it('should return alert history with default pagination', async () => {
      queryBus.execute.mockResolvedValue(mockHistoryResponse);

      const result = await controller.getAlertHistory(TEST_USER_ID, {});

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetAlertHistoryQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(result.totalCount).toBe(1);
    });

    it('should pass date filters to query', async () => {
      queryBus.execute.mockResolvedValue(mockHistoryResponse);

      await controller.getAlertHistory(TEST_USER_ID, {
        startDate: '2026-01-01',
        endDate: '2026-06-10',
      });

      const callArg = queryBus.execute.mock.calls[0][0];
      expect(callArg.filters.startDate).toBe('2026-01-01');
      expect(callArg.filters.endDate).toBe('2026-06-10');
    });

    it('should reject invalid startDate format', async () => {
      await expect(
        controller.getAlertHistory(TEST_USER_ID, { startDate: 'not-a-date' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should reject invalid endDate format', async () => {
      await expect(
        controller.getAlertHistory(TEST_USER_ID, { endDate: '2026/06/10' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should coerce page/pageSize from string to number', async () => {
      queryBus.execute.mockResolvedValue(mockHistoryResponse);

      await controller.getAlertHistory(TEST_USER_ID, { page: '2', pageSize: '10' });

      const callArg = queryBus.execute.mock.calls[0][0];
      expect(callArg.filters.page).toBe(2);
      expect(callArg.filters.pageSize).toBe(10);
    });
  });

  // ── POST /proactive-notifications/:alertId/acknowledge (AC#3) ──────────────

  describe('POST /proactive-notifications/:alertId/acknowledge', () => {
    it('should dispatch AcknowledgeAlertCommand', async () => {
      commandBus.execute.mockResolvedValue(mockAckResponse);

      const result = await controller.acknowledgeAlert(TEST_USER_ID, {
        alertId: 'ALERT-2026-001',
      });

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const callArg = commandBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(AcknowledgeAlertCommand);
      expect(callArg.alertId).toBe('ALERT-2026-001');
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(result.acknowledgedAt).toBeDefined();
    });

    it('should reject empty alertId', async () => {
      await expect(
        controller.acknowledgeAlert(TEST_USER_ID, { alertId: '' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should reject alertId with special characters', async () => {
      await expect(
        controller.acknowledgeAlert(TEST_USER_ID, { alertId: 'ALERT@INVALID!' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should accept alertId with dashes and underscores', async () => {
      commandBus.execute.mockResolvedValue(mockAckResponse);

      await controller.acknowledgeAlert(TEST_USER_ID, { alertId: 'ALERT_2026-001' });

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
    });
  });

  // ── Query/Command class type verification ───────────────────────────────────

  describe('Class type verification', () => {
    it('should dispatch GetActiveAlertsQuery from GET /active', async () => {
      queryBus.execute.mockResolvedValue(mockAlertsResponse);

      await controller.getActiveAlerts(TEST_USER_ID);
      expect(queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetActiveAlertsQuery);
    });

    it('should dispatch GetAlertHistoryQuery from GET /history', async () => {
      queryBus.execute.mockResolvedValue(mockHistoryResponse);

      await controller.getAlertHistory(TEST_USER_ID, {});
      expect(queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetAlertHistoryQuery);
    });

    it('should dispatch AcknowledgeAlertCommand from POST /acknowledge', async () => {
      commandBus.execute.mockResolvedValue(mockAckResponse);

      await controller.acknowledgeAlert(TEST_USER_ID, { alertId: 'ALERT-001' });
      expect(commandBus.execute.mock.calls[0][0]).toBeInstanceOf(AcknowledgeAlertCommand);
    });
  });

  // ── Auth guard verification ───────────────────────────────────────────────

  describe('Auth protection', () => {
    it('should use ApiBearerAuth decorator for Swagger documentation', () => {
      const metadata = Reflect.getMetadata('swagger/apiSecurity', ProactiveNotificationController);
      expect(metadata).toBeDefined();
      expect(metadata).toEqual(expect.arrayContaining([expect.objectContaining({ 'JWT-auth': expect.any(Array) })]));
    });
  });
});
