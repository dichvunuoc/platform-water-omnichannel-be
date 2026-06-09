import { GetMeterByCustomerHandler } from './get-meter-by-customer.handler';
import { GetMeterByCustomerQuery } from '../get-meter-by-customer.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { PortResult } from '@shared/port/port.interface';

describe('GetMeterByCustomerHandler', () => {
  let handler: GetMeterByCustomerHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockMeterListResponse = {
    meters: [
      {
        meterId: 'MT-001',
        serialNumber: 'SN-2024-00123',
        type: 'mechanical' as const,
        diameter: 'DN15',
        accuracyClass: 'Class B',
        manufactureYear: 2023,
        installationDate: '2023-06-15',
        status: 'active' as const,
      },
      {
        meterId: 'MT-002',
        serialNumber: 'SN-2024-00456',
        type: 'ultrasonic' as const,
        diameter: 'DN20',
        accuracyClass: 'Class C',
        manufactureYear: 2024,
        installationDate: '2024-01-10',
        status: 'active' as const,
      },
    ],
    totalCount: 2,
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn().mockResolvedValue({
        data: mockMeterListResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      } satisfies PortResult<typeof mockMeterListResponse>),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetMeterByCustomerHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct port name and params', async () => {
    const query = new GetMeterByCustomerQuery('USR-12345');
    const result = await handler.execute(query);

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'meter',
      'get-meter-by-customer',
      { customerId: 'USR-12345' },
    );
    expect(result).toEqual(mockMeterListResponse);
  });

  it('should return meters array with totalCount (1:N)', async () => {
    const query = new GetMeterByCustomerQuery('USR-12345');
    const result = await handler.execute(query);

    expect(result.meters).toBeInstanceOf(Array);
    expect(result.meters.length).toBe(2);
    expect(result.totalCount).toBe(2);
  });

  it('should return empty array when customer has no meters', async () => {
    portRegistry.execute.mockResolvedValue({
      data: { meters: [], totalCount: 0 },
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 5,
    });

    const result = await handler.execute(new GetMeterByCustomerQuery('USR-00000'));
    expect(result.meters).toEqual([]);
    expect(result.totalCount).toBe(0);
  });
});
