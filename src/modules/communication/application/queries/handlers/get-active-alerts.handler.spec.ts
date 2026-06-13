import { GetActiveAlertsHandler } from './get-active-alerts.handler';
import { GetActiveAlertsQuery } from '../get-active-alerts.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { GetActiveAlertsResponse } from '../../dtos/proactive-notification.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetActiveAlertsHandler', () => {
  let handler: GetActiveAlertsHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockAlertsResponse: GetActiveAlertsResponse = {
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
      {
        id: 'ALERT-2026-002',
        type: 'maintenance',
        description: 'Bảo trì định kỳ trạm bơm Tân Thuận',
        affectedArea: 'Quận 7, Phường Tân Thuận Đông',
        expectedStartTime: '2026-06-15T06:00:00+07:00',
        expectedEndTime: '2026-06-15T12:00:00+07:00',
        status: 'scheduled',
      },
    ],
    totalCount: 2,
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetActiveAlertsHandler(portRegistry);
  });

  describe('successful alert retrieval', () => {
    it('should call portRegistry with proactive-notification port and customerId', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockAlertsResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await handler.execute(new GetActiveAlertsQuery('USR-001'));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'proactive-notification',
        'get-active-alerts',
        { customerId: 'USR-001' },
      );
    });

    it('should return active alerts with alert details', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockAlertsResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(new GetActiveAlertsQuery('USR-001'));

      expect(result.alerts).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.alerts[0].type).toBe('outage');
      expect(result.alerts[0].severity).toBe('high');
      expect(result.alerts[1].status).toBe('scheduled');
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
        handler.execute(new GetActiveAlertsQuery('USR-001')),
      ).rejects.toThrow(PortFallbackException);
    });

    it('should throw PortFallbackException when result is undefined', async () => {
      portRegistry.execute.mockResolvedValue(undefined as any);

      await expect(
        handler.execute(new GetActiveAlertsQuery('USR-001')),
      ).rejects.toThrow(PortFallbackException);
    });
  });
});
