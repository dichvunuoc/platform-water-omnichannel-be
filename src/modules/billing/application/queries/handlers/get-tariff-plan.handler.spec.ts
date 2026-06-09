import { GetTariffPlanHandler } from './get-tariff-plan.handler';
import { GetTariffPlanQuery } from '../get-tariff-plan.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { PortResult } from '@shared/port/port.interface';
import type { TariffPlan } from '../../dtos/tariff.dto';

describe('GetTariffPlanHandler', () => {
  let handler: GetTariffPlanHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockTariffPlan: TariffPlan = {
    planId: 'TARIFF-RES-2025-001',
    planName: 'Bậc thang sinh hoạt',
    customerType: 'residential',
    applicableContractId: 'CTR-2024-0001',
    tiers: [
      { tier: 1, fromVolume: 0, toVolume: 10, pricePerM3: 5973 },
      { tier: 2, fromVolume: 10, toVolume: 20, pricePerM3: 7052 },
    ],
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetTariffPlanHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct params', async () => {
    portRegistry.execute.mockResolvedValue({
      data: mockTariffPlan,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const result = await handler.execute(new GetTariffPlanQuery('USR-001', 'CTR-2024-0001'));

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'tariff',
      'get-tariff-plan',
      { customerId: 'USR-001', contractId: 'CTR-2024-0001' },
    );
    expect(result).toEqual(mockTariffPlan);
    expect(result.tiers).toHaveLength(2);
  });

  it('should return plan with correct customer type', async () => {
    portRegistry.execute.mockResolvedValue({
      data: mockTariffPlan,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const result = await handler.execute(new GetTariffPlanQuery('USR-001', 'CTR-2024-0001'));

    expect(result.customerType).toBe('residential');
    expect(result.planName).toBe('Bậc thang sinh hoạt');
  });
});
