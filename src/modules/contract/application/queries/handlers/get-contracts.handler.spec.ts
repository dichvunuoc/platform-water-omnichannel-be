import { GetContractsHandler } from './get-contracts.handler';
import { GetContractsQuery } from '../get-contracts.query';
import { PortRegistry } from '@shared/port';

describe('GetContractsHandler', () => {
  let handler: GetContractsHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() } as unknown as jest.Mocked<PortRegistry>;
    handler = new GetContractsHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct params', async () => {
    const mockResponse = {
      contracts: [{ contractId: 'CTR-001', address: 'Test', meterId: null, waterQuota: null, subscriptionType: 'residential' as const, status: 'active' as const, startDate: '2024-01-01', endDate: null }],
      totalCount: 1,
    };

    portRegistry.execute.mockResolvedValue({
      data: mockResponse,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const result = await handler.execute(new GetContractsQuery('USR-001'));

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'contract',
      'get-contracts',
      { customerId: 'USR-001', filters: undefined },
    );
    expect(result).toEqual(mockResponse);
  });

  it('should pass filters to portRegistry.execute', async () => {
    portRegistry.execute.mockResolvedValue({
      data: { contracts: [], totalCount: 0 },
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 5,
    });

    await handler.execute(new GetContractsQuery('USR-001', { status: 'active' }));

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'contract',
      'get-contracts',
      { customerId: 'USR-001', filters: { status: 'active' } },
    );
  });
});
