import { UpdateNotificationPreferencesHandler } from './update-notification-preferences.handler';
import { UpdateNotificationPreferencesCommand } from '../update-notification-preferences.command';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { UpdateNotificationPreferencesResponse } from '../../dtos/notification-preferences.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('UpdateNotificationPreferencesHandler', () => {
  let handler: UpdateNotificationPreferencesHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockUpdateResponse: UpdateNotificationPreferencesResponse = {
    customerId: 'USR-00001',
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
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new UpdateNotificationPreferencesHandler(portRegistry);
  });

  describe('successful preferences update', () => {
    it('should call portRegistry with notification port, customerId, and channels', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockUpdateResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const payload = {
        channels: [
          { channel: 'zns' as const, enabled: false },
          { channel: 'sms' as const, enabled: true },
        ],
      };

      await handler.execute(new UpdateNotificationPreferencesCommand('USR-00001', payload));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'notification',
        'update-notification-preferences',
        {
          customerId: 'USR-00001',
          channels: payload.channels,
          useCache: false,
        },
      );
    });

    it('should include useCache: false in params — update is a write operation', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockUpdateResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const payload = {
        channels: [{ channel: 'push' as const, enabled: true }],
      };

      await handler.execute(new UpdateNotificationPreferencesCommand('USR-00001', payload));

      const call = portRegistry.execute.mock.calls[0];
      expect(call[2]).toEqual(
        expect.objectContaining({ useCache: false }),
      );
    });

    it('should return updated preferences', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockUpdateResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const payload = {
        channels: [{ channel: 'sms' as const, enabled: true }],
      };

      const result = await handler.execute(
        new UpdateNotificationPreferencesCommand('USR-00001', payload),
      );

      expect(result.customerId).toBe('USR-00001');
      expect(result.channels).toHaveLength(5);
      expect(result.updatedAt).toBe('2026-06-11T10:35:00Z');
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

      const payload = {
        channels: [{ channel: 'push' as const, enabled: true }],
      };

      await expect(
        handler.execute(new UpdateNotificationPreferencesCommand('USR-00001', payload)),
      ).rejects.toThrow(PortFallbackException);
    });

    it('should throw PortFallbackException when result is undefined', async () => {
      portRegistry.execute.mockResolvedValue(undefined as any);

      const payload = {
        channels: [{ channel: 'push' as const, enabled: true }],
      };

      await expect(
        handler.execute(new UpdateNotificationPreferencesCommand('USR-00001', payload)),
      ).rejects.toThrow(PortFallbackException);
    });
  });
});
