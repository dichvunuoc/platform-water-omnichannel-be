import { GetCutoffStatusHandler } from './get-cutoff-status.handler';
import { GetCutoffStatusQuery } from '../get-cutoff-status.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetCutoffStatusHandler', () => {
  let handler: GetCutoffStatusHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetCutoffStatusHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { customerId: 'USR-1', hasActiveCutoff: false, reason: null, scheduledAt: null, resolvedAt: null };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetCutoffStatusQuery('USR-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('water-cutoff', 'get-cutoff-status', { customerId: 'USR-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetCutoffStatusQuery('USR-1'))).rejects.toThrow(PortFallbackException);
  });
});
