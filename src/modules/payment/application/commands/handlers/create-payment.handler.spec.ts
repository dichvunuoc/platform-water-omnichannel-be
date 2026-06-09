import { CreatePaymentHandler } from './create-payment.handler';
import { CreatePaymentCommand } from '../create-payment.command';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { PortResult } from '@shared/port/port.interface';
import type { InvoiceDetail } from '@modules/billing/application/dtos/invoice.dto';
import type { CreatePaymentResponse } from '../../dtos/payment.dto';
import { ForbiddenException, NotFoundException } from '@core/common';

describe('CreatePaymentHandler', () => {
  let handler: CreatePaymentHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockUnpaidInvoice: InvoiceDetail = {
    invoiceId: 'INV-2026-001',
    contractId: 'CTR-2024-0001',
    period: '2026-05',
    lineItems: [
      { description: 'Bậc 1', volume: 10, unitPrice: 5973, amount: 59730 },
    ],
    subtotal: 59730,
    fees: [{ feeName: 'VAT', amount: 2987 }],
    totalAmount: 123273,
    paymentStatus: 'unpaid',
    cqtCode: 'CQT-001',
    lookupCode: 'LC-001',
    issueDate: '2026-06-01',
    dueDate: '2026-06-15',
  };

  const mockPaidInvoice: InvoiceDetail = {
    ...mockUnpaidInvoice,
    paymentStatus: 'paid',
  };

  const mockOverdueInvoice: InvoiceDetail = {
    ...mockUnpaidInvoice,
    paymentStatus: 'overdue',
  };

  const mockPaymentResponse: CreatePaymentResponse = {
    paymentId: 'PAY-2026-001',
    invoiceId: 'INV-2026-001',
    amount: 123273,
    method: 'qr_code',
    qrCodeUrl: 'https://pay.ioc.local/qr/PAY-2026-001',
    paymentLink: null,
    status: 'pending',
    expiresAt: '2026-06-09T10:00:00Z',
    createdAt: '2026-06-09T09:00:00Z',
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new CreatePaymentHandler(portRegistry);
  });

  // ── Successful flow ─────────────────────────────────────────────────────────

  describe('successful payment creation', () => {
    it('should verify invoice then create payment', async () => {
      portRegistry.execute
        .mockResolvedValueOnce({
          data: mockUnpaidInvoice,
          adapterUsed: 'mock' as const,
          fromCache: false,
          duration: 10,
        } as PortResult<InvoiceDetail>)
        .mockResolvedValueOnce({
          data: mockPaymentResponse,
          adapterUsed: 'mock' as const,
          fromCache: false,
          duration: 15,
        } as PortResult<CreatePaymentResponse>);

      const result = await handler.execute(
        new CreatePaymentCommand('USR-001', 'INV-2026-001', 'qr_code'),
      );

      // Verify invoice lookup was called first
      expect(portRegistry.execute).toHaveBeenNthCalledWith(
        1,
        'invoice',
        'get-by-id',
        { invoiceId: 'INV-2026-001', customerId: 'USR-001', useCache: false },
      );

      // Verify payment creation was called second
      expect(portRegistry.execute).toHaveBeenNthCalledWith(
        2,
        'payment',
        'create-payment',
        { invoiceId: 'INV-2026-001', customerId: 'USR-001', method: 'qr_code', amount: 123273 },
      );

      expect(result.paymentId).toBe('PAY-2026-001');
      expect(result.qrCodeUrl).toBeDefined();
    });

    it('should pass invoice amount to payment creation', async () => {
      portRegistry.execute
        .mockResolvedValueOnce({ data: mockUnpaidInvoice, adapterUsed: 'mock' as const, fromCache: false, duration: 10 })
        .mockResolvedValueOnce({ data: mockPaymentResponse, adapterUsed: 'mock' as const, fromCache: false, duration: 15 });

      await handler.execute(new CreatePaymentCommand('USR-001', 'INV-2026-001', 'qr_code'));

      const paymentCall = portRegistry.execute.mock.calls[1];
      expect(paymentCall[2]).toEqual(
        expect.objectContaining({ amount: 123273 }),
      );
    });
  });

  // ── Invoice status guards ───────────────────────────────────────────────────

  describe('invoice status guard', () => {
    it('should throw ForbiddenException when invoice is already paid', async () => {
      portRegistry.execute.mockResolvedValueOnce({
        data: mockPaidInvoice,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await expect(
        handler.execute(new CreatePaymentCommand('USR-001', 'INV-2026-001', 'qr_code')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when invoice is overdue', async () => {
      portRegistry.execute.mockResolvedValueOnce({
        data: mockOverdueInvoice,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await expect(
        handler.execute(new CreatePaymentCommand('USR-001', 'INV-2026-001', 'qr_code')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should include current status in ForbiddenException message', async () => {
      portRegistry.execute.mockResolvedValueOnce({
        data: mockPaidInvoice,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await expect(
        handler.execute(new CreatePaymentCommand('USR-001', 'INV-2026-001', 'qr_code')),
      ).rejects.toThrow('Current status: paid');
    });

    it('should NOT call payment port when invoice is already paid', async () => {
      portRegistry.execute.mockResolvedValueOnce({
        data: mockPaidInvoice,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      try {
        await handler.execute(new CreatePaymentCommand('USR-001', 'INV-2026-001', 'qr_code'));
      } catch {
        // Expected
      }

      expect(portRegistry.execute).toHaveBeenCalledTimes(1); // Only invoice lookup, no payment call
    });

    it('should throw ForbiddenException when invoice is cancelled', async () => {
      const mockCancelledInvoice: InvoiceDetail = {
        ...mockUnpaidInvoice,
        paymentStatus: 'cancelled',
      };
      portRegistry.execute.mockResolvedValue({
        data: mockCancelledInvoice,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await expect(
        handler.execute(new CreatePaymentCommand('USR-001', 'INV-2026-001', 'qr_code')),
      ).rejects.toThrow('Current status: cancelled');
    });

    it('should throw NotFoundException when invoice is not found (null data)', async () => {
      portRegistry.execute.mockResolvedValue({
        data: null,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await expect(
        handler.execute(new CreatePaymentCommand('USR-001', 'INV-NOTFOUND', 'qr_code')),
      ).rejects.toThrow('INV-NOTFOUND not found');
    });
  });

  // ── useCache: false verification ────────────────────────────────────────────

  describe('cache bypass', () => {
    it('should pass useCache: false to invoice lookup', async () => {
      portRegistry.execute
        .mockResolvedValueOnce({ data: mockUnpaidInvoice, adapterUsed: 'mock' as const, fromCache: false, duration: 10 })
        .mockResolvedValueOnce({ data: mockPaymentResponse, adapterUsed: 'mock' as const, fromCache: false, duration: 15 });

      await handler.execute(new CreatePaymentCommand('USR-001', 'INV-2026-001', 'qr_code'));

      const invoiceCall = portRegistry.execute.mock.calls[0];
      expect(invoiceCall[2]).toEqual(
        expect.objectContaining({ useCache: false }),
      );
    });
  });
});
