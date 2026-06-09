import { GetInvoiceListHandler } from './get-invoice-list.handler';
import { GetInvoiceListQuery } from '../get-invoice-list.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { PortResult } from '@shared/port/port.interface';
import type { InvoiceListResponse } from '../../dtos/invoice.dto';

describe('GetInvoiceListHandler', () => {
  let handler: GetInvoiceListHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockList: InvoiceListResponse = {
    invoices: [
      {
        invoiceId: 'INV-001',
        contractId: 'CTR-001',
        period: '2026-05',
        totalAmount: 285000,
        paymentStatus: 'unpaid',
        issueDate: '2026-06-01',
        dueDate: '2026-06-15',
      },
    ],
    totalCount: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetInvoiceListHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct params', async () => {
    const filters = { page: 1, limit: 10 };
    portRegistry.execute.mockResolvedValue({
      data: mockList,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const result = await handler.execute(new GetInvoiceListQuery('USR-001', filters));

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'invoice',
      'get-list',
      { customerId: 'USR-001', page: 1, limit: 10 },
    );
    expect(result).toEqual(mockList);
    expect(result.invoices).toHaveLength(1);
  });

  it('should pass filters to portRegistry', async () => {
    const filters = { month: '2026-05', status: 'unpaid' as const, page: 2, limit: 5 };
    portRegistry.execute.mockResolvedValue({
      data: mockList,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    await handler.execute(new GetInvoiceListQuery('USR-001', filters));

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'invoice',
      'get-list',
      { customerId: 'USR-001', month: '2026-05', status: 'unpaid', page: 2, limit: 5 },
    );
  });
});
