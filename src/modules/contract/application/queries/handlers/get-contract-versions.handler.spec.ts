import { GetContractVersionsHandler } from './get-contract-versions.handler';
import { GetContractVersionsQuery } from '../get-contract-versions.query';
import { PortRegistry } from '@shared/port';

describe('GetContractVersionsHandler', () => {
  let handler: GetContractVersionsHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() } as unknown as jest.Mocked<PortRegistry>;
    handler = new GetContractVersionsHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct params', async () => {
    const mockVersions = {
      versions: [
        { versionId: 'VER-001', versionNumber: 1, changeDescription: 'Initial', effectiveDate: '2024-01-15', changedBy: 'System' },
      ],
      totalCount: 1,
    };

    portRegistry.execute.mockResolvedValue({
      data: mockVersions,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 6,
    });

    const result = await handler.execute(new GetContractVersionsQuery('USR-001', 'CTR-001'));

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'contract',
      'get-contract-versions',
      { customerId: 'USR-001', contractId: 'CTR-001' },
    );
    expect(result.versions).toHaveLength(1);
  });
});
