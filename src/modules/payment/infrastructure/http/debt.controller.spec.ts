import { DebtController } from './debt.controller';
import { GetOutstandingDebtQuery } from '../../application/queries/get-outstanding-debt.query';
import { GetDebtHistoryQuery } from '../../application/queries/get-debt-history.query';
import type { OutstandingDebtResponse } from '../../application/dtos/debt.dto';
import type { DebtHistoryResponse } from '../../application/dtos/debt.dto';

function mockQueryBus() {
  return { execute: jest.fn() };
}

describe('DebtController', () => {
  let controller: DebtController;
  let queryBus: ReturnType<typeof mockQueryBus>;

  const TEST_USER_ID = 'USR-SESSION-001';

  const mockDebtResponse = {
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

  const mockHistoryResponse = {
    entries: [
      {
        invoiceRef: 'INV-2025-047',
        amount: 298000,
        dueDate: '2025-12-01',
        paidDate: null,
        status: 'outstanding',
        agingAtPayment: null,
      },
    ],
    totalCount: 1,
  };

  beforeEach(() => {
    queryBus = mockQueryBus();
    controller = new DebtController(queryBus as any);
  });

  // ── GET /payments/debt (AC#1) ──────────────────────────────────────────────

  describe('GET /payments/debt', () => {
    it('should return outstanding debt with aging buckets', async () => {
      queryBus.execute.mockResolvedValue(mockDebtResponse);

      const result = await controller.getOutstandingDebt(TEST_USER_ID) as OutstandingDebtResponse;

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetOutstandingDebtQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(result.totalAmount).toBe(852456);
      expect(result.agingBreakdown.current).toBe(123273);
    });
  });

  // ── GET /payments/debt/history (AC#2) ───────────────────────────────────────

  describe('GET /payments/debt/history', () => {
    it('should return debt history', async () => {
      queryBus.execute.mockResolvedValue(mockHistoryResponse);

      const result = await controller.getDebtHistory(TEST_USER_ID) as DebtHistoryResponse;

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetDebtHistoryQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(result.entries).toHaveLength(1);
      expect(result.totalCount).toBe(1);
    });
  });

  // ── Query class type verification ──────────────────────────────────────────

  describe('Query class types', () => {
    it('should dispatch GetOutstandingDebtQuery from GET /payments/debt', async () => {
      queryBus.execute.mockResolvedValue(mockDebtResponse);

      await controller.getOutstandingDebt(TEST_USER_ID);
      expect(queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetOutstandingDebtQuery);
    });

    it('should dispatch GetDebtHistoryQuery from GET /payments/debt/history', async () => {
      queryBus.execute.mockResolvedValue(mockHistoryResponse);

      await controller.getDebtHistory(TEST_USER_ID);
      expect(queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetDebtHistoryQuery);
    });
  });

  // ── Auth guard verification ───────────────────────────────────────────────

  describe('Auth protection', () => {
    it('should use ApiBearerAuth decorator for Swagger documentation', () => {
      const metadata = Reflect.getMetadata('swagger/apiSecurity', DebtController);
      expect(metadata).toBeDefined();
      expect(metadata).toEqual(expect.arrayContaining([expect.objectContaining({ 'JWT-auth': expect.any(Array) })]));
    });
  });
});
