import { CreateBatchPaymentHandler } from './create-batch-payment.handler';
import { CreateBatchPaymentCommand } from '../create-batch-payment.command';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { PortResult } from '@shared/port/port.interface';
import type { InvoiceDetail } from '@modules/billing/application/dtos/invoice.dto';
import type { CreateBatchPaymentResponse } from '../../dtos/payment.dto';
import { ForbiddenException, NotFoundException } from '@core/common';

describe('CreateBatchPaymentHandler', () => {
  let handler: CreateBatchPaymentHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const makeInvoice = (overrides: Partial<InvoiceDetail> = {}): InvoiceDetail => ({
    invoiceId: 'INV-2026-001',
    contractId: 'CTR-2024-0001',
    period: '2026-05',
    lineItems: [{ description: 'Bậc 1', volume: 10, unitPrice: 5973, amount: 59730 }],
    subtotal: 59730,
    fees: [{ feeName: 'VAT', amount: 2987 }],
    totalAmount: 62717,
    paymentStatus: 'unpaid',
    cqtCode: 'CQT-001',
    lookupCode: 'LC-001',
    issueDate: '2026-06-01',
    dueDate: '2026-06-15',
    ...overrides,
  });

  const mockBatchResponse: CreateBatchPaymentResponse = {
    paymentId: 'PAY-2026-BATCH-001',
    invoiceIds: ['INV-2026-001', 'INV-2026-002'],
    totalAmount: 125434,
    method: 'qr_code',
    qrCodeUrl: 'https://pay.ioc.local/qr/PAY-2026-BATCH-001',
    paymentLink: null,
    status: 'pending',
    expiresAt: '2026-06-09T11:00:00Z',
    createdAt: '2026-06-09T10:00:00Z',
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new CreateBatchPaymentHandler(portRegistry);
  });

  // ── AC#2: Successful batch payment ─────────────────────────────────────────

  describe('successful batch payment', () => {
    it('should verify invoices then create batch payment', async () => {
      const inv1 = makeInvoice({ invoiceId: 'INV-2026-001', totalAmount: 62717 });
      const inv2 = makeInvoice({ invoiceId: 'INV-2026-002', totalAmount: 62717 });

      portRegistry.execute
        .mockResolvedValueOnce({ data: inv1, adapterUsed: 'mock' as const, fromCache: false, duration: 10 })
        .mockResolvedValueOnce({ data: inv2, adapterUsed: 'mock' as const, fromCache: false, duration: 10 })
        .mockResolvedValueOnce({ data: mockBatchResponse, adapterUsed: 'mock' as const, fromCache: false, duration: 15 });

      const result = await handler.execute(
        new CreateBatchPaymentCommand('USR-001', ['INV-2026-001', 'INV-2026-002'], 'qr_code'),
      );

      // Verify invoice lookups were called first
      expect(portRegistry.execute).toHaveBeenNthCalledWith(
        1, 'invoice', 'get-by-id',
        { invoiceId: 'INV-2026-001', customerId: 'USR-001', useCache: false },
      );
      expect(portRegistry.execute).toHaveBeenNthCalledWith(
        2, 'invoice', 'get-by-id',
        { invoiceId: 'INV-2026-002', customerId: 'USR-001', useCache: false },
      );

      // Verify batch payment was called last
      expect(portRegistry.execute).toHaveBeenNthCalledWith(
        3, 'payment', 'create-batch-payment',
        { invoiceIds: ['INV-2026-001', 'INV-2026-002'], customerId: 'USR-001', method: 'qr_code', totalAmount: 125434 },
      );

      expect(result.paymentId).toBe('PAY-2026-BATCH-001');
      expect(result.invoiceIds).toHaveLength(2);
    });

    it('should accumulate total amount from verified invoices', async () => {
      const inv1 = makeInvoice({ totalAmount: 100000 });
      const inv2 = makeInvoice({ totalAmount: 200000 });
      const inv3 = makeInvoice({ totalAmount: 300000 });

      portRegistry.execute
        .mockResolvedValueOnce({ data: inv1, adapterUsed: 'mock' as const, fromCache: false, duration: 10 })
        .mockResolvedValueOnce({ data: inv2, adapterUsed: 'mock' as const, fromCache: false, duration: 10 })
        .mockResolvedValueOnce({ data: inv3, adapterUsed: 'mock' as const, fromCache: false, duration: 10 })
        .mockResolvedValueOnce({ data: { ...mockBatchResponse, totalAmount: 600000 }, adapterUsed: 'mock' as const, fromCache: false, duration: 15 });

      await handler.execute(
        new CreateBatchPaymentCommand('USR-001', ['INV-1', 'INV-2', 'INV-3'], 'qr_code'),
      );

      const batchCall = portRegistry.execute.mock.calls[3];
      expect(batchCall[2]).toEqual(
        expect.objectContaining({ totalAmount: 600000 }),
      );
    });

    it('should work with single invoice batch', async () => {
      const inv = makeInvoice({ totalAmount: 62717 });

      portRegistry.execute
        .mockResolvedValueOnce({ data: inv, adapterUsed: 'mock' as const, fromCache: false, duration: 10 })
        .mockResolvedValueOnce({ data: { ...mockBatchResponse, invoiceIds: ['INV-2026-001'], totalAmount: 62717 }, adapterUsed: 'mock' as const, fromCache: false, duration: 15 });

      const result = await handler.execute(
        new CreateBatchPaymentCommand('USR-001', ['INV-2026-001'], 'qr_code'),
      );

      expect(result.paymentId).toBeDefined();
      expect(portRegistry.execute).toHaveBeenCalledTimes(2); // 1 invoice verify + 1 batch create
    });
  });

  // ── Invoice status guards ───────────────────────────────────────────────────

  describe('invoice status guard', () => {
    it('should throw ForbiddenException when invoice is already paid', async () => {
      const paidInvoice = makeInvoice({ paymentStatus: 'paid' });

      portRegistry.execute.mockResolvedValueOnce({
        data: paidInvoice, adapterUsed: 'mock' as const, fromCache: false, duration: 10,
      });

      await expect(
        handler.execute(new CreateBatchPaymentCommand('USR-001', ['INV-2026-001'], 'qr_code')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when invoice is overdue', async () => {
      const overdueInvoice = makeInvoice({ paymentStatus: 'overdue' });

      portRegistry.execute.mockResolvedValueOnce({
        data: overdueInvoice, adapterUsed: 'mock' as const, fromCache: false, duration: 10,
      });

      await expect(
        handler.execute(new CreateBatchPaymentCommand('USR-001', ['INV-2026-001'], 'qr_code')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should include current status in ForbiddenException message', async () => {
      const paidInvoice = makeInvoice({ invoiceId: 'INV-PAID', paymentStatus: 'paid' });

      portRegistry.execute.mockResolvedValueOnce({
        data: paidInvoice, adapterUsed: 'mock' as const, fromCache: false, duration: 10,
      });

      await expect(
        handler.execute(new CreateBatchPaymentCommand('USR-001', ['INV-PAID'], 'qr_code')),
      ).rejects.toThrow('Current status: paid');
    });

    it('should reject entire batch if second invoice is paid', async () => {
      const unpaid = makeInvoice({ invoiceId: 'INV-001', totalAmount: 100 });
      const paid = makeInvoice({ invoiceId: 'INV-002', paymentStatus: 'paid', totalAmount: 200 });

      portRegistry.execute
        .mockResolvedValueOnce({ data: unpaid, adapterUsed: 'mock' as const, fromCache: false, duration: 10 })
        .mockResolvedValueOnce({ data: paid, adapterUsed: 'mock' as const, fromCache: false, duration: 10 });

      await expect(
        handler.execute(new CreateBatchPaymentCommand('USR-001', ['INV-001', 'INV-002'], 'qr_code')),
      ).rejects.toThrow(ForbiddenException);

      // Should NOT call payment port
      expect(portRegistry.execute).toHaveBeenCalledTimes(2); // Only invoice lookups
    });

    it('should NOT call payment port when invoice verification fails', async () => {
      const paidInvoice = makeInvoice({ paymentStatus: 'paid' });

      portRegistry.execute.mockResolvedValueOnce({
        data: paidInvoice, adapterUsed: 'mock' as const, fromCache: false, duration: 10,
      });

      try {
        await handler.execute(new CreateBatchPaymentCommand('USR-001', ['INV-2026-001'], 'qr_code'));
      } catch {
        // Expected
      }

      // Only invoice lookup, no batch payment call
      expect(portRegistry.execute).toHaveBeenCalledTimes(1);
      expect(portRegistry.execute).not.toHaveBeenCalledWith(
        'payment', 'create-batch-payment', expect.anything(),
      );
    });

    it('should throw NotFoundException when invoice is not found (null data)', async () => {
      portRegistry.execute.mockResolvedValueOnce({
        data: null, adapterUsed: 'mock' as const, fromCache: false, duration: 10,
      });

      await expect(
        handler.execute(new CreateBatchPaymentCommand('USR-001', ['INV-NOTFOUND'], 'qr_code')),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with invoice ID in message', async () => {
      portRegistry.execute.mockResolvedValueOnce({
        data: null, adapterUsed: 'mock' as const, fromCache: false, duration: 10,
      });

      await expect(
        handler.execute(new CreateBatchPaymentCommand('USR-001', ['INV-MISSING'], 'qr_code')),
      ).rejects.toThrow('INV-MISSING not found');
    });

    it('should reject entire batch when second invoice is not found', async () => {
      const unpaid = makeInvoice({ invoiceId: 'INV-001', totalAmount: 100 });

      portRegistry.execute
        .mockResolvedValueOnce({ data: unpaid, adapterUsed: 'mock' as const, fromCache: false, duration: 10 })
        .mockResolvedValueOnce({ data: null, adapterUsed: 'mock' as const, fromCache: false, duration: 10 });

      await expect(
        handler.execute(new CreateBatchPaymentCommand('USR-001', ['INV-001', 'INV-MISSING'], 'qr_code')),
      ).rejects.toThrow(NotFoundException);

      // Should NOT call payment port
      expect(portRegistry.execute).toHaveBeenCalledTimes(2); // Only invoice lookups
    });
  });

  // ── useCache: false verification ────────────────────────────────────────────

  describe('cache bypass', () => {
    it('should pass useCache: false for each invoice lookup', async () => {
      const inv = makeInvoice();

      portRegistry.execute
        .mockResolvedValueOnce({ data: inv, adapterUsed: 'mock' as const, fromCache: false, duration: 10 })
        .mockResolvedValueOnce({ data: mockBatchResponse, adapterUsed: 'mock' as const, fromCache: false, duration: 15 });

      await handler.execute(new CreateBatchPaymentCommand('USR-001', ['INV-2026-001'], 'qr_code'));

      const invoiceCall = portRegistry.execute.mock.calls[0];
      expect(invoiceCall[2]).toEqual(
        expect.objectContaining({ useCache: false }),
      );
    });
  });
});
