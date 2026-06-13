import { GetNotificationPreferencesHandler } from './get-notification-preferences.handler';
import { GetNotificationPreferencesQuery } from '../get-notification-preferences.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { NotificationPreferencesResponse } from '../../dtos/notification-preferences.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetNotificationPreferencesHandler', () => {
  let handler: GetNotificationPreferencesHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockPreferencesResponse: NotificationPreferencesResponse = {
    customerId: 'USR-00001',
    channels: [
      { channel: 'push', enabled: true, isCritical: true },
      { channel: 'in_app', enabled: true, isCritical: true },
      { channel: 'zns', enabled: true, isCritical: false },
      { channel: 'sms', enabled: false, isCritical: false },
      { channel: 'email', enabled: true, isCritical: false },
    ],
    updatedAt: '2026-06-11T10:30:00Z',
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetNotificationPreferencesHandler(portRegistry);
  });

  describe('successful preferences retrieval', () => {
    it('should call portRegistry with notification port and customerId', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockPreferencesResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await handler.execute(new GetNotificationPreferencesQuery('USR-00001'));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'notification',
        'get-notification-preferences',
        { customerId: 'USR-00001' },
      );
    });

    it('should return notification preferences with channel details', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockPreferencesResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(new GetNotificationPreferencesQuery('USR-00001'));

      expect(result.customerId).toBe('USR-00001');
      expect(result.channels).toHaveLength(5);
      expect(result.channels[0].channel).toBe('push');
      expect(result.channels[0].enabled).toBe(true);
      expect(result.channels[0].isCritical).toBe(true);
      expect(result.updatedAt).toBeDefined();
    });

    it('should distinguish critical vs optional channels', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockPreferencesResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(new GetNotificationPreferencesQuery('USR-00001'));

      const criticalChannels = result.channels.filter(ch => ch.isCritical);
      const optionalChannels = result.channels.filter(ch => !ch.isCritical);

      expect(criticalChannels).toHaveLength(2);
      expect(criticalChannels.map(c => c.channel)).toEqual(expect.arrayContaining(['push', 'in_app']));
      expect(optionalChannels).toHaveLength(3);
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
        handler.execute(new GetNotificationPreferencesQuery('USR-00001')),
      ).rejects.toThrow(PortFallbackException);
    });

    it('should throw PortFallbackException when result is undefined', async () => {
      portRegistry.execute.mockResolvedValue(undefined as any);

      await expect(
        handler.execute(new GetNotificationPreferencesQuery('USR-00001')),
      ).rejects.toThrow(PortFallbackException);
    });
  });
});
