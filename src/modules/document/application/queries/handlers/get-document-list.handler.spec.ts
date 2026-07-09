import { GetDocumentListHandler } from './get-document-list.handler';
import { GetDocumentListQuery } from '../get-document-list.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetDocumentListHandler', () => {
  let handler: GetDocumentListHandler;
  let portRegistry: any;

  const mockList = {
    customerId: 'USR-1',
    documents: [
      { fileKey: 'doc/1.pdf', name: 'hop-dong.pdf', size: 1024, uploadedAt: '2026-01-01T00:00:00Z' },
    ],
  };

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetDocumentListHandler(portRegistry);
  });

  it('calls document/get-list with customerId and returns data', async () => {
    portRegistry.execute.mockResolvedValue({ data: mockList });
    const result = await handler.execute(new GetDocumentListQuery('USR-1'));
    expect(portRegistry.execute).toHaveBeenCalledWith('document', 'get-list', {
      customerId: 'USR-1',
    });
    expect(result).toEqual(mockList);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetDocumentListQuery('USR-1'))).rejects.toThrow(
      PortFallbackException,
    );
  });
});
