import { GetRelatedAccountsHandler } from './get-related-accounts.handler';
import { GetRelatedAccountsQuery } from '../get-related-accounts.query';
import { PortRegistry } from '@shared/port';

describe('GetRelatedAccountsHandler', () => {
  let handler: GetRelatedAccountsHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetRelatedAccountsHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct params', async () => {
    const mockRelatedAccounts = {
      accounts: [
        {
          customerId: 'USR-KCN-001',
          name: 'KCN Test (Trạm chính)',
          relationshipType: 'parent_kcn',
          address: 'KCN Test, Quận 7',
          contactInfo: { phone: '028-12345678' },
        },
        {
          customerId: 'USR-FAC-001',
          name: 'Factory A',
          relationshipType: 'member_factory',
          address: 'Lô A1, KCN Test',
          contactInfo: { phone: '028-87654321' },
        },
      ],
    };

    portRegistry.execute.mockResolvedValue({
      data: mockRelatedAccounts,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 12,
    });

    const query = new GetRelatedAccountsQuery('USR-001');
    const result = await handler.execute(query);

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'customer-profile',
      'get-related-accounts',
      { customerId: 'USR-001' },
    );
    expect(result).toEqual(mockRelatedAccounts);
    expect(result.accounts).toHaveLength(2);
    expect(result.accounts[0].relationshipType).toBe('parent_kcn');
  });
});
