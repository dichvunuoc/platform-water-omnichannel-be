import { GetDebtHistoryHandler } from './get-debt-history.handler';
import { GetDebtHistoryQuery } from '../get-debt-history.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { DebtHistoryResponse } from '../../dtos/debt.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetDebtHistoryHandler', () => {
  let handler: GetDebtHistoryHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockHistoryResponse: DebtHistoryResponse = {
    entries: [
      {
        invoiceRef: 'INV-2025-047',
        amount: 298000,
        dueDate: '2025-12-01',
        paidDate: null,
        status: 'outstanding',
        agingAtPayment: null,
      },
      {
        invoiceRef: 'INV-2025-015',
        amount: 89000,
        dueDate: '2025-07-01',
        paidDate: '2025-07-28',
        status: 'paid',
        agingAtPayment: 'current',
      },
    ],
    totalCount: 2,
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetDebtHistoryHandler(portRegistry);
  });

  describe('successful history retrieval', () => {
    it('should call portRegistry with debt port and customerId', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockHistoryResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await handler.execute(new GetDebtHistoryQuery('USR-001'));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'debt',
        'get-debt-history',
        { customerId: 'USR-001' },
      );
    });

    it('should return chronological debt history', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockHistoryResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(new GetDebtHistoryQuery('USR-001'));

      expect(result.entries).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.entries[0].status).toBe('outstanding');
      expect(result.entries[1].status).toBe('paid');
      expect(result.entries[1].paidDate).toBe('2025-07-28');
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
        handler.execute(new GetDebtHistoryQuery('USR-001')),
      ).rejects.toThrow(PortFallbackException);
    });

    it('should throw PortFallbackException when result is undefined', async () => {
      portRegistry.execute.mockResolvedValue(undefined as any);

      await expect(
        handler.execute(new GetDebtHistoryQuery('USR-001')),
      ).rejects.toThrow(PortFallbackException);
    });
  });
});
