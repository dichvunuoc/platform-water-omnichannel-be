import { SignContractHandler } from './sign-contract.handler';
import { SignContractCommand } from '../sign-contract.command';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('SignContractHandler', () => {
  let handler: SignContractHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new SignContractHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { dossierId: 'DOS-1', status: 'signed', signedAt: '2026-07-07T10:00:00Z' };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new SignContractCommand('USR-1', 'DOS-1', 'sig-ref-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('econtract', 'sign-contract', {
      customerId: 'USR-1',
      dossierId: 'DOS-1',
      signatureRef: 'sig-ref-1',
      useCache: false,
    });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new SignContractCommand('USR-1', 'DOS-1', 'sig-ref-1'))).rejects.toThrow(
      PortFallbackException,
    );
  });
});
