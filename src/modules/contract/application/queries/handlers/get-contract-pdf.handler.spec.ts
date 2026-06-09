import { GetContractPDFHandler } from './get-contract-pdf.handler';
import { GetContractPDFQuery } from '../get-contract-pdf.query';
import { PortRegistry } from '@shared/port';

describe('GetContractPDFHandler', () => {
  let handler: GetContractPDFHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() } as unknown as jest.Mocked<PortRegistry>;
    handler = new GetContractPDFHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct params', async () => {
    const mockPDF = {
      contractId: 'CTR-001',
      downloadUrl: 'https://storage.test/contracts/CTR-001.pdf',
      fileName: 'Contract.pdf',
      expiresAt: '2024-06-08T12:00:00.000Z',
    };

    portRegistry.execute.mockResolvedValue({
      data: mockPDF,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 4,
    });

    const result = await handler.execute(new GetContractPDFQuery('USR-001', 'CTR-001'));

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'contract',
      'get-contract-pdf',
      { customerId: 'USR-001', contractId: 'CTR-001' },
    );
    expect(result.downloadUrl).toContain('https://');
    expect(result.fileName).toContain('.pdf');
  });
});
