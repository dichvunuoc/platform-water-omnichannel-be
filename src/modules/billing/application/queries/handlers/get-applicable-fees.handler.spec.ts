import { GetApplicableFeesHandler } from './get-applicable-fees.handler';
import { GetApplicableFeesQuery } from '../get-applicable-fees.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { PortResult } from '@shared/port/port.interface';
import type { ApplicableFeesResponse } from '../../dtos/tariff.dto';

describe('GetApplicableFeesHandler', () => {
  let handler: GetApplicableFeesHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockFees: ApplicableFeesResponse = {
    contractId: 'CTR-2024-0001',
    fees: [
      { feeType: 'environmental', feeName: 'Phí bảo vệ môi trường', rate: 10, isPercentage: true },
      { feeType: 'drainage', feeName: 'Phí thoát nước', rate: 5, isPercentage: true },
    ],
    vatPercentage: 5,
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetApplicableFeesHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct params', async () => {
    portRegistry.execute.mockResolvedValue({
      data: mockFees,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const result = await handler.execute(
      new GetApplicableFeesQuery('USR-001', 'CTR-2024-0001'),
    );

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'tariff',
      'get-applicable-fees',
      { customerId: 'USR-001', contractId: 'CTR-2024-0001' },
    );
    expect(result).toEqual(mockFees);
    expect(result.fees).toHaveLength(2);
  });

  it('should return fees with VAT percentage', async () => {
    portRegistry.execute.mockResolvedValue({
      data: mockFees,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const result = await handler.execute(
      new GetApplicableFeesQuery('USR-001', 'CTR-2024-0001'),
    );

    expect(result.vatPercentage).toBe(5);
    expect(result.fees[0].feeType).toBe('environmental');
  });
});
