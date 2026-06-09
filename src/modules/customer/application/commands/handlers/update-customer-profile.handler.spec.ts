import { UpdateCustomerProfileHandler } from './update-customer-profile.handler';
import { UpdateCustomerProfileCommand } from '../update-customer-profile.command';
import { PortRegistry } from '@shared/port';
import { CACHE_SERVICE_TOKEN } from '@core/constants/tokens';
import { generateShortHash } from '@shared/utils/hash.util';

describe('UpdateCustomerProfileHandler', () => {
  let handler: UpdateCustomerProfileHandler;
  let portRegistry: jest.Mocked<PortRegistry>;
  let cacheService: { delete: jest.Mock; get: jest.Mock; set: jest.Mock; exists: jest.Mock; clear: jest.Mock; mget: jest.Mock; mset: jest.Mock; mdelete: jest.Mock; incr: jest.Mock; decr: jest.Mock; ttl: jest.Mock };

  const mockProfile = {
    customerId: 'USR-001',
    fullName: 'Updated User',
    classification: 'sinh_hoat' as const,
    address: { street: '1', ward: '2', district: '3', city: '4', fullAddress: '1, 2, 3, 4' },
    contactInfo: { phone: '0912345678', email: 'updated@test.com', contactAddress: null },
    status: 'active' as const,
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    cacheService = {
      delete: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
      clear: jest.fn().mockResolvedValue(undefined),
      mget: jest.fn().mockResolvedValue([]),
      mset: jest.fn().mockResolvedValue(undefined),
      mdelete: jest.fn().mockResolvedValue(undefined),
      incr: jest.fn().mockResolvedValue(1),
      decr: jest.fn().mockResolvedValue(0),
      ttl: jest.fn().mockResolvedValue(-1),
    };

    handler = new UpdateCustomerProfileHandler(
      portRegistry,
      cacheService as any,
    );
  });

  it('should call update-profile, invalidate cache, and re-fetch profile', async () => {
    // Step 1: update-profile call
    portRegistry.execute.mockResolvedValueOnce({
      data: { customerId: 'USR-001', updatedFields: ['phone', 'email'], updatedAt: '2024-06-08T10:30:00.000Z' },
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 15,
    });

    // Step 3: re-fetch fresh profile
    portRegistry.execute.mockResolvedValueOnce({
      data: mockProfile,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 8,
    });

    const command = new UpdateCustomerProfileCommand('USR-001', {
      phone: '0912345678',
      email: 'updated@test.com',
    });

    const result = await handler.execute(command);

    // Verify portRegistry.execute was called twice
    expect(portRegistry.execute).toHaveBeenCalledTimes(2);

    // Verify 1st call: update-profile
    expect(portRegistry.execute).toHaveBeenNthCalledWith(1,
      'customer-profile',
      'update-profile',
      { customerId: 'USR-001', data: { phone: '0912345678', email: 'updated@test.com' } },
    );

    // Verify 2nd call: re-fetch get-profile
    expect(portRegistry.execute).toHaveBeenNthCalledWith(2,
      'customer-profile',
      'get-profile',
      { customerId: 'USR-001' },
    );

    // Verify cache invalidation
    const expectedCacheKey = `cache:v2:port:customer-profile:${generateShortHash(
      JSON.stringify({ method: 'get-profile', params: { customerId: 'USR-001' } }),
    )}`;
    expect(cacheService.delete).toHaveBeenCalledWith(expectedCacheKey);

    // Verify returned data is the fresh profile
    expect(result).toEqual(mockProfile);
    expect(result.contactInfo.phone).toBe('0912345678');
  });

  it('should compute cache key matching PortRegistry format', async () => {
    portRegistry.execute.mockResolvedValue({
      data: mockProfile,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 5,
    });

    await handler.execute(new UpdateCustomerProfileCommand('USR-001', { phone: '0912345678' }));

    // Verify cache key format matches PortRegistry.buildCacheKey pattern
    const deleteCall = cacheService.delete.mock.calls[0][0];
    expect(deleteCall).toMatch(/^cache:v2:port:customer-profile:[a-f0-9]{16}$/);
  });

  it('should still return fresh profile even if cache invalidation fails', async () => {
    cacheService.delete.mockRejectedValueOnce(new Error('Redis connection error'));

    portRegistry.execute.mockResolvedValue({
      data: mockProfile,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 5,
    });

    const result = await handler.execute(
      new UpdateCustomerProfileCommand('USR-001', { phone: '0912345678' }),
    );

    // Handler should not throw — it logs the warning and continues
    expect(result).toEqual(mockProfile);
    expect(portRegistry.execute).toHaveBeenCalledTimes(2);
  });
});
