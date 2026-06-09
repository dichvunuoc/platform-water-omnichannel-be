import { GetInvoiceDetailHandler } from './get-invoice-detail.handler';
import { GetInvoiceDetailQuery } from '../get-invoice-detail.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { PortResult } from '@shared/port/port.interface';
import type { InvoiceDetail } from '../../dtos/invoice.dto';

describe('GetInvoiceDetailHandler', () => {
  let handler: GetInvoiceDetailHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockDetail: InvoiceDetail = {
    invoiceId: 'INV-2026-001',
    contractId: 'CTR-2024-0001',
    period: '2026-05',
    lineItems: [
      { description: 'Bậc 1', volume: 10, unitPrice: 5973, amount: 59730 },
    ],
    subtotal: 59730,
    fees: [{ feeName: 'VAT', amount: 2987 }],
    totalAmount: 62717,
    paymentStatus: 'unpaid',
    cqtCode: 'CQT-001',
    lookupCode: 'LC-001',
    issueDate: '2026-06-01',
    dueDate: '2026-06-15',
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetInvoiceDetailHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct params', async () => {
    portRegistry.execute.mockResolvedValue({
      data: mockDetail,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const result = await handler.execute(new GetInvoiceDetailQuery('USR-001', 'INV-2026-001'));

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'invoice',
      'get-by-id',
      { customerId: 'USR-001', invoiceId: 'INV-2026-001' },
    );
    expect(result).toEqual(mockDetail);
    expect(result.cqtCode).toBe('CQT-001');
  });
});
