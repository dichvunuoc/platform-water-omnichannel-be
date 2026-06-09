import { GetTariffBreakdownHandler } from './get-tariff-breakdown.handler';
import { GetTariffBreakdownQuery } from '../get-tariff-breakdown.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { PortResult } from '@shared/port/port.interface';
import type { TariffBreakdown } from '../../dtos/tariff.dto';

describe('GetTariffBreakdownHandler', () => {
  let handler: GetTariffBreakdownHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockBreakdown: TariffBreakdown = {
    invoiceId: 'INV-2025-06-001',
    contractId: 'CTR-2024-0001',
    tiers: [
      { tier: 1, fromVolume: 0, toVolume: 10, volume: 10, pricePerM3: 5973, subtotal: 59730 },
      { tier: 2, fromVolume: 10, toVolume: 20, volume: 10, pricePerM3: 7052, subtotal: 70520 },
    ],
    totalBeforeFees: 130250,
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetTariffBreakdownHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct params', async () => {
    portRegistry.execute.mockResolvedValue({
      data: mockBreakdown,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const result = await handler.execute(
      new GetTariffBreakdownQuery('USR-001', 'CTR-2024-0001', 'INV-2025-06-001'),
    );

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'tariff',
      'get-tariff-breakdown',
      { customerId: 'USR-001', contractId: 'CTR-2024-0001', invoiceId: 'INV-2025-06-001' },
    );
    expect(result).toEqual(mockBreakdown);
  });

  it('should return breakdown with tier subtotals', async () => {
    portRegistry.execute.mockResolvedValue({
      data: mockBreakdown,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const result = await handler.execute(
      new GetTariffBreakdownQuery('USR-001', 'CTR-2024-0001', 'INV-2025-06-001'),
    );

    expect(result.tiers[0].subtotal).toBe(59730);
    expect(result.totalBeforeFees).toBe(130250);
  });
});
