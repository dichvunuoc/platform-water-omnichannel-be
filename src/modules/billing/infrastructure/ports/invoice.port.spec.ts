import { MockInvoiceAdapter } from './invoice.port';
import {
  InvoiceListResponseSchema,
  InvoiceDetailSchema,
  InvoicePdfSchema,
  InvoiceIdParamSchema,
  InvoiceListQuerySchema,
  PaymentStatusSchema,
} from '../../application/dtos/invoice.dto';

describe('MockInvoiceAdapter', () => {
  let adapter: MockInvoiceAdapter;

  beforeEach(() => {
    adapter = new MockInvoiceAdapter();
  });

  // ── AC#1: get-list (paginated) ──────────────────────────────────────────────

  describe('execute - get-list', () => {
    it('should read and validate get-list.json mock data', async () => {
      const result = await adapter.execute('get-list', { customerId: 'USR-001' });

      expect(result).toBeDefined();
      const parsed = InvoiceListResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.invoices).toBeInstanceOf(Array);
        expect(parsed.data.invoices.length).toBeGreaterThan(0);
        expect(parsed.data.totalCount).toBeGreaterThan(0);
        expect(parsed.data.page).toBeGreaterThanOrEqual(1);
        expect(parsed.data.limit).toBeGreaterThanOrEqual(1);
        expect(parsed.data.totalPages).toBeGreaterThanOrEqual(1);
      }
    });

    it('should return invoices with required fields', async () => {
      const result = await adapter.execute('get-list', { customerId: 'USR-001' });
      const parsed = InvoiceListResponseSchema.safeParse(result);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        const invoice = parsed.data.invoices[0];
        expect(invoice.invoiceId).toBeDefined();
        expect(invoice.contractId).toBeDefined();
        expect(invoice.period).toMatch(/^\d{4}-\d{2}$/);
        expect(invoice.totalAmount).toBeGreaterThanOrEqual(0);
        expect(['paid', 'unpaid', 'overdue', 'cancelled']).toContain(invoice.paymentStatus);
        expect(invoice.issueDate).toBeDefined();
      }
    });

    it('should have consistent pagination', async () => {
      const result = await adapter.execute('get-list', { customerId: 'USR-001' });
      const parsed = InvoiceListResponseSchema.safeParse(result);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.totalPages).toBe(Math.ceil(parsed.data.totalCount / parsed.data.limit));
        expect(parsed.data.invoices.length).toBeLessThanOrEqual(parsed.data.limit);
      }
    });
  });

  // ── AC#2: get-by-id (invoice detail) ────────────────────────────────────────

  describe('execute - get-by-id', () => {
    it('should read and validate get-by-id.json mock data', async () => {
      const result = await adapter.execute('get-by-id', { customerId: 'USR-001', invoiceId: 'INV-2026-001' });

      expect(result).toBeDefined();
      const parsed = InvoiceDetailSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.invoiceId).toBe('INV-2026-001');
        expect(parsed.data.contractId).toBeDefined();
        expect(parsed.data.period).toBeDefined();
        expect(parsed.data.lineItems).toBeInstanceOf(Array);
        expect(parsed.data.lineItems.length).toBeGreaterThan(0);
        expect(parsed.data.totalAmount).toBeGreaterThanOrEqual(0);
        expect(parsed.data.cqtCode).toBeDefined();
        expect(parsed.data.lookupCode).toBeDefined();
      }
    });

    it('should have line items with valid amounts', async () => {
      const result = await adapter.execute('get-by-id', { customerId: 'USR-001', invoiceId: 'INV-2026-001' });
      const parsed = InvoiceDetailSchema.safeParse(result);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        for (const item of parsed.data.lineItems) {
          expect(item.description).toBeDefined();
          expect(item.volume).toBeGreaterThanOrEqual(0);
          expect(item.unitPrice).toBeGreaterThanOrEqual(0);
          expect(item.amount).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should have fees array', async () => {
      const result = await adapter.execute('get-by-id', { customerId: 'USR-001', invoiceId: 'INV-2026-001' });
      const parsed = InvoiceDetailSchema.safeParse(result);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.fees).toBeInstanceOf(Array);
        for (const fee of parsed.data.fees) {
          expect(fee.feeName).toBeDefined();
          expect(fee.amount).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  // ── AC#3: get-pdf ───────────────────────────────────────────────────────────

  describe('execute - get-pdf', () => {
    it('should read and validate get-pdf.json mock data', async () => {
      const result = await adapter.execute('get-pdf', { customerId: 'USR-001', invoiceId: 'INV-2026-001' });

      expect(result).toBeDefined();
      const parsed = InvoicePdfSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.invoiceId).toBe('INV-2026-001');
        expect(parsed.data.pdfUrl).toBeDefined();
        expect(parsed.data.cqtCode).toBeDefined();
        expect(parsed.data.lookupCode).toBeDefined();
        expect(parsed.data.digitalSignature).toBeDefined();
      }
    });

    it('should have valid URL for pdfUrl', async () => {
      const result = await adapter.execute('get-pdf', { customerId: 'USR-001', invoiceId: 'INV-2026-001' });
      const parsed = InvoicePdfSchema.safeParse(result);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.pdfUrl).toMatch(/^https?:\/\//);
      }
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  describe('execute - missing method', () => {
    it('should throw for missing mock file', async () => {
      await expect(adapter.execute('nonexistent', {})).rejects.toThrow();
    });
  });

  // ── Input validation schemas ────────────────────────────────────────────────

  describe('InvoiceIdParamSchema', () => {
    it('should accept valid invoice IDs', () => {
      expect(InvoiceIdParamSchema.safeParse('INV-2026-001').success).toBe(true);
    });

    it('should reject IDs with special characters', () => {
      expect(InvoiceIdParamSchema.safeParse('INV@LID!').success).toBe(false);
    });

    it('should reject empty string', () => {
      expect(InvoiceIdParamSchema.safeParse('').success).toBe(false);
    });
  });

  describe('InvoiceListQuerySchema', () => {
    it('should accept valid query params', () => {
      const result = InvoiceListQuerySchema.safeParse({ page: '1', limit: '10', status: 'unpaid', month: '2026-05' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
        expect(result.data.status).toBe('unpaid');
      }
    });

    it('should apply defaults for missing page/limit', () => {
      const result = InvoiceListQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
      }
    });

    it('should reject invalid month format', () => {
      expect(InvoiceListQuerySchema.safeParse({ month: '2026/05' }).success).toBe(false);
    });

    it('should reject invalid status', () => {
      expect(InvoiceListQuerySchema.safeParse({ status: 'unknown' }).success).toBe(false);
    });

    it('should reject limit exceeding 100', () => {
      expect(InvoiceListQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    });
  });

  // ── Zod schema rejection tests ──────────────────────────────────────────────

  describe('Zod schema validation', () => {
    it('PaymentStatusSchema should reject invalid status', () => {
      expect(PaymentStatusSchema.safeParse('pending').success).toBe(false);
    });

    it('InvoiceDetailSchema should reject negative totalAmount', () => {
      const result = InvoiceDetailSchema.safeParse({
        invoiceId: 'INV-001',
        contractId: 'CTR-001',
        period: '2026-05',
        lineItems: [],
        subtotal: 100,
        fees: [],
        totalAmount: -1, // invalid
        paymentStatus: 'unpaid',
        cqtCode: null,
        lookupCode: null,
        issueDate: '2026-06-01',
      });
      expect(result.success).toBe(false);
    });

    it('InvoicePdfSchema should reject invalid pdfUrl', () => {
      const result = InvoicePdfSchema.safeParse({
        invoiceId: 'INV-001',
        pdfUrl: 'not-a-url', // invalid — must be url
        cqtCode: 'CQT-001',
        lookupCode: 'LC-001',
        digitalSignature: 'sig',
      });
      expect(result.success).toBe(false);
    });
  });
});
