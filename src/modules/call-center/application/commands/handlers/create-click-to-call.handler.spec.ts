import { CreateClickToCallHandler } from './create-click-to-call.handler';
import { CreateClickToCallCommand } from '../create-click-to-call.command';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('CreateClickToCallHandler', () => {
  let handler: CreateClickToCallHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new CreateClickToCallHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { callId: 'CALL-1', status: 'initiated', phoneNumber: '0912345678' };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new CreateClickToCallCommand('USR-1', '0912345678'));

    expect(portRegistry.execute).toHaveBeenCalledWith('call-center', 'create-click-to-call', {
      customerId: 'USR-1',
      phoneNumber: '0912345678',
      useCache: false,
    });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new CreateClickToCallCommand('USR-1', '0912345678'))).rejects.toThrow(
      PortFallbackException,
    );
  });
});
