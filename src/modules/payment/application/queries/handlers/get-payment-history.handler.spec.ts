import { GetPaymentHistoryHandler } from './get-payment-history.handler';
import { GetPaymentHistoryQuery } from '../get-payment-history.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { PaymentHistoryResponse } from '../../dtos/payment.dto';

describe('GetPaymentHistoryHandler', () => {
  let handler: GetPaymentHistoryHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockHistoryResponse: PaymentHistoryResponse = {
    payments: [
      {
        paymentId: 'PAY-2026-001',
        invoiceIds: ['INV-2026-001'],
        amount: 123273,
        method: 'qr_code',
        status: 'completed',
        createdAt: '2026-06-01T10:00:00Z',
      },
      {
        paymentId: 'PAY-2026-002',
        invoiceIds: ['INV-2026-002'],
        amount: 59730,
        method: 'bank_transfer',
        status: 'pending',
        createdAt: '2026-06-05T14:30:00Z',
      },
    ],
    totalCount: 15,
    page: 1,
    limit: 10,
    totalPages: 2,
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetPaymentHistoryHandler(portRegistry);
  });

  // ── AC#1: Payment history retrieval ─────────────────────────────────────────

  describe('successful history retrieval', () => {
    it('should call portRegistry with correct params', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockHistoryResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await handler.execute(new GetPaymentHistoryQuery('USR-001', { page: 1, limit: 10 }));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'payment',
        'get-payment-history',
        { customerId: 'USR-001', filters: { page: 1, limit: 10 } },
      );
    });

    it('should pass status filter when provided', async () => {
      portRegistry.execute.mockResolvedValue({
        data: { ...mockHistoryResponse, payments: [mockHistoryResponse.payments[0]] },
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await handler.execute(new GetPaymentHistoryQuery('USR-001', { page: 1, limit: 10, status: 'completed' }));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'payment',
        'get-payment-history',
        { customerId: 'USR-001', filters: { page: 1, limit: 10, status: 'completed' } },
      );
    });

    it('should return payment history response', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockHistoryResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(new GetPaymentHistoryQuery('USR-001', { page: 1, limit: 10 }));

      expect(result).toEqual(mockHistoryResponse);
      expect(result.payments).toHaveLength(2);
      expect(result.totalCount).toBe(15);
      expect(result.page).toBe(1);
    });
  });
});
