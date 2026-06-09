import { GetContractDetailHandler } from './get-contract-detail.handler';
import { GetContractDetailQuery } from '../get-contract-detail.query';
import { PortRegistry } from '@shared/port';

describe('GetContractDetailHandler', () => {
  let handler: GetContractDetailHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() } as unknown as jest.Mocked<PortRegistry>;
    handler = new GetContractDetailHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct params including contractId', async () => {
    const mockDetail = {
      contractId: 'CTR-001', address: '123 Test St', meterId: 'DNG-001', waterQuota: 50,
      subscriptionType: 'residential' as const, status: 'active' as const,
      startDate: '2024-01-15', endDate: null,
      pricingTerms: { basePrice: 6500, currency: 'VND', billingCycle: 'monthly' },
      specialConditions: null,
    };

    portRegistry.execute.mockResolvedValue({
      data: mockDetail,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 8,
    });

    const result = await handler.execute(new GetContractDetailQuery('USR-001', 'CTR-001'));

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'contract',
      'get-contract-detail',
      { customerId: 'USR-001', contractId: 'CTR-001' },
    );
    expect(result).toEqual(mockDetail);
    expect(result.pricingTerms.basePrice).toBe(6500);
  });
});
