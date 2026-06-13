import { GetNotificationHistoryHandler } from './get-notification-history.handler';
import { GetNotificationHistoryQuery } from '../get-notification-history.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { NotificationHistoryResponse } from '../../dtos/notification-preferences.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetNotificationHistoryHandler', () => {
  let handler: GetNotificationHistoryHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockHistoryResponse: NotificationHistoryResponse = {
    notifications: [
      {
        id: 'NTF-001',
        type: 'payment_completed',
        channel: 'zns',
        contentSummary: 'Thanh toán hóa đơn INV-2026-0042 thành công',
        timestamp: '2026-06-11T09:15:00Z',
        deliveryStatus: 'delivered',
      },
      {
        id: 'NTF-002',
        type: 'alert_outage',
        channel: 'push',
        contentSummary: 'Thông báo cắt nước khu vực KCN Cẩm Phả từ 14:00-17:00',
        timestamp: '2026-06-11T08:00:00Z',
        deliveryStatus: 'sent',
      },
    ],
    totalCount: 2,
    page: 1,
    pageSize: 20,
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetNotificationHistoryHandler(portRegistry);
  });

  describe('successful history retrieval', () => {
    it('should call portRegistry with notification port and customerId + filters', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockHistoryResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const filters = { page: 1, pageSize: 20 };
      await handler.execute(new GetNotificationHistoryQuery('USR-00001', filters));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'notification',
        'get-notification-history',
        { customerId: 'USR-00001', page: 1, pageSize: 20 },
      );
    });

    it('should return paginated notification history', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockHistoryResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(
        new GetNotificationHistoryQuery('USR-00001', { page: 1, pageSize: 20 }),
      );

      expect(result.notifications).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should pass date range filters to portRegistry', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockHistoryResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const filters = {
        page: 1,
        pageSize: 20,
        startDate: '2026-01-01',
        endDate: '2026-06-11',
      };

      await handler.execute(new GetNotificationHistoryQuery('USR-00001', filters));

      const callArgs = portRegistry.execute.mock.calls[0][2] as Record<string, unknown>;
      expect(callArgs.startDate).toBe('2026-01-01');
      expect(callArgs.endDate).toBe('2026-06-11');
    });

    it('should pass channel and type filters to portRegistry', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockHistoryResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const filters = {
        page: 1,
        pageSize: 20,
        channel: 'zns' as const,
        type: 'payment_completed' as const,
      };

      await handler.execute(new GetNotificationHistoryQuery('USR-00001', filters));

      const callArgs = portRegistry.execute.mock.calls[0][2] as Record<string, unknown>;
      expect(callArgs.channel).toBe('zns');
      expect(callArgs.type).toBe('payment_completed');
    });

    it('should include notification details in response', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockHistoryResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(
        new GetNotificationHistoryQuery('USR-00001', { page: 1, pageSize: 20 }),
      );

      const firstNotification = result.notifications[0];
      expect(firstNotification.id).toBe('NTF-001');
      expect(firstNotification.type).toBe('payment_completed');
      expect(firstNotification.channel).toBe('zns');
      expect(firstNotification.contentSummary).toBeDefined();
      expect(firstNotification.timestamp).toBeDefined();
      expect(firstNotification.deliveryStatus).toBe('delivered');
    });
  });

  describe('null guard', () => {
    it('should throw PortFallbackException when result.data is null', async () => {
      portRegistry.execute.mockResolvedValue({
        data: null,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await expect(
        handler.execute(new GetNotificationHistoryQuery('USR-00001', { page: 1, pageSize: 20 })),
      ).rejects.toThrow(PortFallbackException);
    });

    it('should throw PortFallbackException when result is undefined', async () => {
      portRegistry.execute.mockResolvedValue(undefined as any);

      await expect(
        handler.execute(new GetNotificationHistoryQuery('USR-00001', { page: 1, pageSize: 20 })),
      ).rejects.toThrow(PortFallbackException);
    });
  });
});
