import { GetCustomerProfileHandler } from './get-customer-profile.handler';
import { GetCustomerProfileQuery } from '../get-customer-profile.query';
import { PortRegistry } from '@shared/port';

describe('GetCustomerProfileHandler', () => {
  let handler: GetCustomerProfileHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetCustomerProfileHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct params', async () => {
    const mockProfile = {
      customerId: 'USR-001',
      fullName: 'Test User',
      classification: 'sinh_hoat',
      address: { street: '1', ward: '2', district: '3', city: '4', fullAddress: '1, 2, 3, 4' },
      contactInfo: { phone: '0901234567', email: null, contactAddress: null },
      status: 'active',
    };

    portRegistry.execute.mockResolvedValue({
      data: mockProfile,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const query = new GetCustomerProfileQuery('USR-001');
    const result = await handler.execute(query);

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'customer-profile',
      'get-profile',
      { customerId: 'USR-001' },
    );
    expect(result).toEqual(mockProfile);
  });

  it('should return data from PortResult', async () => {
    const mockProfile = {
      customerId: 'USR-002',
      fullName: 'Another User',
      classification: 'san_xuat',
      address: { street: '10', ward: '20', district: '30', city: '40', fullAddress: '10, 20, 30, 40' },
      contactInfo: { phone: null, email: 'test@test.com', contactAddress: null },
      status: 'active',
    };

    portRegistry.execute.mockResolvedValue({
      data: mockProfile,
      adapterUsed: 'mock' as const,
      fromCache: true,
      duration: 5,
    });

    const result = await handler.execute(new GetCustomerProfileQuery('USR-002'));
    expect(result.customerId).toBe('USR-002');
    expect(result.classification).toBe('san_xuat');
  });
});
