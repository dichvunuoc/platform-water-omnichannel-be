import { GetAlertHistoryHandler } from './get-alert-history.handler';
import { GetAlertHistoryQuery } from '../get-alert-history.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { AlertHistoryResponse } from '../../dtos/proactive-notification.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetAlertHistoryHandler', () => {
  let handler: GetAlertHistoryHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockHistoryResponse: AlertHistoryResponse = {
    alerts: [
      {
        id: 'ALERT-2026-000',
        type: 'quality',
        description: 'Chất lượng nước khu vực Thủ Đức',
        affectedArea: 'Thủ Đức, Phường Linh Trung',
        startTime: '2026-05-20T10:00:00+07:00',
        endTime: '2026-05-20T16:30:00+07:00',
        status: 'resolved',
        resolvedAt: '2026-05-20T16:30:00+07:00',
      },
      {
        id: 'ALERT-2025-047',
        type: 'outage',
        description: 'Sự cố vỡ ống nước đường Lê Văn Sỹ',
        affectedArea: 'Quận 3, Phường Võ Thị Sáu',
        startTime: '2025-12-01T09:00:00+07:00',
        endTime: '2025-12-01T15:00:00+07:00',
        status: 'resolved',
        resolvedAt: '2025-12-01T15:00:00+07:00',
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

    handler = new GetAlertHistoryHandler(portRegistry);
  });

  describe('successful history retrieval', () => {
    it('should call portRegistry with proactive-notification port and customerId', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockHistoryResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await handler.execute(new GetAlertHistoryQuery('USR-001'));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'proactive-notification',
        'get-alert-history',
        { customerId: 'USR-001' },
      );
    });

    it('should pass filters to portRegistry', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockHistoryResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await handler.execute(
        new GetAlertHistoryQuery('USR-001', { startDate: '2026-01-01', endDate: '2026-06-10', page: 2, pageSize: 10 }),
      );

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'proactive-notification',
        'get-alert-history',
        { customerId: 'USR-001', startDate: '2026-01-01', endDate: '2026-06-10', page: 2, pageSize: 10 },
      );
    });

    it('should return chronological alert history', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockHistoryResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(new GetAlertHistoryQuery('USR-001'));

      expect(result.alerts).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.page).toBe(1);
      expect(result.alerts[0].status).toBe('resolved');
      expect(result.alerts[0].resolvedAt).toBeDefined();
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
        handler.execute(new GetAlertHistoryQuery('USR-001')),
      ).rejects.toThrow(PortFallbackException);
    });

    it('should throw PortFallbackException when result is undefined', async () => {
      portRegistry.execute.mockResolvedValue(undefined as any);

      await expect(
        handler.execute(new GetAlertHistoryQuery('USR-001')),
      ).rejects.toThrow(PortFallbackException);
    });
  });
});
