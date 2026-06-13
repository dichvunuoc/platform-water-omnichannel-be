import { AcknowledgeAlertHandler } from './acknowledge-alert.handler';
import { AcknowledgeAlertCommand } from '../acknowledge-alert.command';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { AcknowledgeAlertResponse } from '../../dtos/proactive-notification.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('AcknowledgeAlertHandler', () => {
  let handler: AcknowledgeAlertHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockAckResponse: AcknowledgeAlertResponse = {
    alertId: 'ALERT-2026-001',
    customerId: 'USR-001',
    acknowledgedAt: '2026-06-10T14:30:00+07:00',
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new AcknowledgeAlertHandler(portRegistry);
  });

  describe('successful acknowledgement', () => {
    it('should call portRegistry with alertId and customerId', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockAckResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await handler.execute(new AcknowledgeAlertCommand('ALERT-2026-001', 'USR-001'));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'proactive-notification',
        'acknowledge-alert',
        { alertId: 'ALERT-2026-001', customerId: 'USR-001', useCache: false },
      );
    });

    it('should include useCache: false in params — acknowledgement is a write operation', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockAckResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await handler.execute(new AcknowledgeAlertCommand('ALERT-2026-001', 'USR-001'));

      const call = portRegistry.execute.mock.calls[0];
      expect(call[2]).toEqual(
        expect.objectContaining({ useCache: false }),
      );
    });

    it('should return acknowledgement response', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockAckResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(new AcknowledgeAlertCommand('ALERT-2026-001', 'USR-001'));

      expect(result.alertId).toBe('ALERT-2026-001');
      expect(result.customerId).toBe('USR-001');
      expect(result.acknowledgedAt).toBeDefined();
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
        handler.execute(new AcknowledgeAlertCommand('ALERT-2026-001', 'USR-001')),
      ).rejects.toThrow(PortFallbackException);
    });

    it('should throw PortFallbackException when result is undefined', async () => {
      portRegistry.execute.mockResolvedValue(undefined as any);

      await expect(
        handler.execute(new AcknowledgeAlertCommand('ALERT-2026-001', 'USR-001')),
      ).rejects.toThrow(PortFallbackException);
    });
  });
});
