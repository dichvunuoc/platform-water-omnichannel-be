import { InvoiceController } from './invoice.controller';
import { ValidationException } from '@core/common';
import { GetInvoiceListQuery } from '../../application/queries/get-invoice-list.query';
import { GetInvoiceDetailQuery } from '../../application/queries/get-invoice-detail.query';
import { GetInvoicePdfQuery } from '../../application/queries/get-invoice-pdf.query';

function mockBuses() {
  return { queryBus: { execute: jest.fn() } };
}

describe('InvoiceController', () => {
  let controller: InvoiceController;
  let buses: ReturnType<typeof mockBuses>;

  const TEST_USER_ID = 'USR-SESSION-001';

  const mockList = {
    invoices: [
      { invoiceId: 'INV-001', contractId: 'CTR-001', period: '2026-05', totalAmount: 285000, paymentStatus: 'unpaid', issueDate: '2026-06-01' },
    ],
    totalCount: 1, page: 1, limit: 10, totalPages: 1,
  };

  const mockDetail = {
    invoiceId: 'INV-2026-001',
    contractId: 'CTR-001',
    period: '2026-05',
    lineItems: [{ description: 'Bậc 1', volume: 10, unitPrice: 5973, amount: 59730 }],
    subtotal: 59730,
    fees: [{ feeName: 'VAT', amount: 2987 }],
    totalAmount: 62717,
    paymentStatus: 'unpaid',
    cqtCode: 'CQT-001',
    lookupCode: 'LC-001',
    issueDate: '2026-06-01',
  };

  const mockPdf = {
    invoiceId: 'INV-2026-001',
    pdfUrl: 'https://storage.ioc.local/invoices/INV-2026-001.pdf',
    cqtCode: 'CQT-001',
    lookupCode: 'LC-001',
    digitalSignature: 'sig',
  };

  beforeEach(() => {
    buses = mockBuses();
    controller = new InvoiceController(buses.queryBus as any);
  });

  // ── GET /billing/invoices (AC#1) ────────────────────────────────────────────

  describe('GET /billing/invoices', () => {
    it('should return paginated invoice list', async () => {
      buses.queryBus.execute.mockResolvedValue(mockList);

      const result = await controller.getInvoiceList(TEST_USER_ID, { page: '1', limit: '10' });

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetInvoiceListQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(result.invoices).toHaveLength(1);
      expect(result.totalCount).toBe(1);
    });

    it('should pass filters to query', async () => {
      buses.queryBus.execute.mockResolvedValue(mockList);

      await controller.getInvoiceList(TEST_USER_ID, { month: '2026-05', status: 'unpaid', page: '2', limit: '5' });

      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg.filters.month).toBe('2026-05');
      expect(callArg.filters.status).toBe('unpaid');
      expect(callArg.filters.page).toBe(2);
      expect(callArg.filters.limit).toBe(5);
    });
  });

  // ── GET /billing/invoices/:invoiceId (AC#2) ────────────────────────────────

  describe('GET /billing/invoices/:invoiceId', () => {
    it('should return invoice detail with line items', async () => {
      buses.queryBus.execute.mockResolvedValue(mockDetail);

      const result = await controller.getInvoiceDetail(TEST_USER_ID, 'INV-2026-001');

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetInvoiceDetailQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.invoiceId).toBe('INV-2026-001');
      expect(result.cqtCode).toBe('CQT-001');
    });
  });

  // ── GET /billing/invoices/:invoiceId/pdf (AC#3) ────────────────────────────

  describe('GET /billing/invoices/:invoiceId/pdf', () => {
    it('should return PDF URL with digital signature', async () => {
      buses.queryBus.execute.mockResolvedValue(mockPdf);

      const result = await controller.getInvoicePdf(TEST_USER_ID, 'INV-2026-001');

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetInvoicePdfQuery);
      expect(callArg.invoiceId).toBe('INV-2026-001');
      expect(result.pdfUrl).toBeDefined();
      expect(result.digitalSignature).toBeDefined();
    });
  });

  // ── InvoiceId validation ────────────────────────────────────────────────────

  describe('InvoiceId validation', () => {
    it('should throw ValidationException for empty invoiceId', async () => {
      await expect(controller.getInvoiceDetail(TEST_USER_ID, '')).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for special characters', async () => {
      await expect(controller.getInvoiceDetail(TEST_USER_ID, 'INV@LID!')).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for invoiceId exceeding 100 chars', async () => {
      const longId = 'A'.repeat(101);
      await expect(controller.getInvoiceDetail(TEST_USER_ID, longId)).rejects.toThrow(ValidationException);
    });

    it('should accept invoiceId with dashes', async () => {
      buses.queryBus.execute.mockResolvedValue(mockDetail);
      await controller.getInvoiceDetail(TEST_USER_ID, 'INV-2026-001');
      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should accept invoiceId with underscores', async () => {
      buses.queryBus.execute.mockResolvedValue(mockDetail);
      await controller.getInvoiceDetail(TEST_USER_ID, 'INV_2026_001');
      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
    });
  });

  // ── Query params validation ─────────────────────────────────────────────────

  describe('Query params validation', () => {
    it('should throw ValidationException for invalid month format', async () => {
      await expect(
        controller.getInvoiceList(TEST_USER_ID, { month: '2026/05' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for invalid status', async () => {
      await expect(
        controller.getInvoiceList(TEST_USER_ID, { status: 'pending' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for limit exceeding 100', async () => {
      await expect(
        controller.getInvoiceList(TEST_USER_ID, { limit: '101' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should accept valid query params', async () => {
      buses.queryBus.execute.mockResolvedValue(mockList);
      await controller.getInvoiceList(TEST_USER_ID, { month: '2026-05', status: 'unpaid', page: '1', limit: '10' });
      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should apply defaults when no params provided', async () => {
      buses.queryBus.execute.mockResolvedValue(mockList);
      await controller.getInvoiceList(TEST_USER_ID, {});
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg.filters.page).toBe(1);
      expect(callArg.filters.limit).toBe(10);
    });
  });

  // ── Query class type verification ───────────────────────────────────────────

  describe('Query class types', () => {
    it('should dispatch GetInvoiceListQuery from GET /billing/invoices', async () => {
      buses.queryBus.execute.mockResolvedValue(mockList);
      await controller.getInvoiceList(TEST_USER_ID, {});
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetInvoiceListQuery);
    });

    it('should dispatch GetInvoiceDetailQuery from GET /billing/invoices/:invoiceId', async () => {
      buses.queryBus.execute.mockResolvedValue(mockDetail);
      await controller.getInvoiceDetail(TEST_USER_ID, 'INV-001');
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetInvoiceDetailQuery);
    });

    it('should dispatch GetInvoicePdfQuery from GET /billing/invoices/:invoiceId/pdf', async () => {
      buses.queryBus.execute.mockResolvedValue(mockPdf);
      await controller.getInvoicePdf(TEST_USER_ID, 'INV-001');
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetInvoicePdfQuery);
    });
  });
});
