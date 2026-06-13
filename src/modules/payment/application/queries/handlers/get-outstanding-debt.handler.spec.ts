import { GetOutstandingDebtHandler } from './get-outstanding-debt.handler';
import { GetOutstandingDebtQuery } from '../get-outstanding-debt.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { OutstandingDebtResponse } from '../../dtos/debt.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetOutstandingDebtHandler', () => {
  let handler: GetOutstandingDebtHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockDebtResponse: OutstandingDebtResponse = {
    totalAmount: 852456,
    agingBreakdown: {
      current: 123273,
      '31-60': 245546,
      '61-90': 185637,
      '>90': 298000,
    },
    debts: [
      {
        invoiceRef: 'INV-2026-004',
        amount: 123273,
        dueDate: '2026-05-15',
        daysOverdue: 25,
        agingBucket: 'current',
      },
    ],
    totalCount: 1,
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetOutstandingDebtHandler(portRegistry);
  });

  describe('successful debt retrieval', () => {
    it('should call portRegistry with debt port and customerId', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockDebtResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await handler.execute(new GetOutstandingDebtQuery('USR-001'));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'debt',
        'get-outstanding-debt',
        { customerId: 'USR-001' },
      );
    });

    it('should return outstanding debt with aging breakdown', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockDebtResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(new GetOutstandingDebtQuery('USR-001'));

      expect(result.totalAmount).toBe(852456);
      expect(result.agingBreakdown.current).toBe(123273);
      expect(result.agingBreakdown['>90']).toBe(298000);
      expect(result.debts).toHaveLength(1);
      expect(result.totalCount).toBe(1);
    });
  });

  // ── Null guard ───────────────────────────────────────────────────────────────

  describe('null guard', () => {
    it('should throw PortFallbackException when result.data is null', async () => {
      portRegistry.execute.mockResolvedValue({
        data: null,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await expect(
        handler.execute(new GetOutstandingDebtQuery('USR-001')),
      ).rejects.toThrow(PortFallbackException);
    });

    it('should throw PortFallbackException when result is undefined', async () => {
      portRegistry.execute.mockResolvedValue(undefined as any);

      await expect(
        handler.execute(new GetOutstandingDebtQuery('USR-001')),
      ).rejects.toThrow(PortFallbackException);
    });
  });
});
