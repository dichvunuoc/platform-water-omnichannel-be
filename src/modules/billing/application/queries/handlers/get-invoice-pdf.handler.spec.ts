import { GetInvoicePdfHandler } from './get-invoice-pdf.handler';
import { GetInvoicePdfQuery } from '../get-invoice-pdf.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { PortResult } from '@shared/port/port.interface';
import type { InvoicePdf } from '../../dtos/invoice.dto';

describe('GetInvoicePdfHandler', () => {
  let handler: GetInvoicePdfHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockPdf: InvoicePdf = {
    invoiceId: 'INV-2026-001',
    pdfUrl: 'https://storage.ioc.local/invoices/INV-2026-001.pdf',
    cqtCode: 'CQT-001',
    lookupCode: 'LC-001',
    digitalSignature: 'MIIBIjANBgkq==',
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetInvoicePdfHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct params', async () => {
    portRegistry.execute.mockResolvedValue({
      data: mockPdf,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const result = await handler.execute(new GetInvoicePdfQuery('USR-001', 'INV-2026-001'));

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'invoice',
      'get-pdf',
      { customerId: 'USR-001', invoiceId: 'INV-2026-001' },
    );
    expect(result).toEqual(mockPdf);
    expect(result.pdfUrl).toMatch(/^https?:\/\//);
    expect(result.digitalSignature).toBeDefined();
  });
});
