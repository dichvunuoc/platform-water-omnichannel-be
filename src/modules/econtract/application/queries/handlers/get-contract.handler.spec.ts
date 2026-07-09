import { GetContractHandler } from './get-contract.handler';
import { GetContractQuery } from '../get-contract.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetContractHandler', () => {
  let handler: GetContractHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetContractHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { dossierId: 'DOS-1', customerId: 'USR-1', status: 'pending_signature', downloadUrl: 'https://x/y.pdf', signedAt: null };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetContractQuery('USR-1', 'DOS-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('econtract', 'get-contract', { customerId: 'USR-1', dossierId: 'DOS-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetContractQuery('USR-1', 'DOS-1'))).rejects.toThrow(PortFallbackException);
  });
});
