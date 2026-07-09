import { GetCallHistoryHandler } from './get-call-history.handler';
import { GetCallHistoryQuery } from '../get-call-history.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetCallHistoryHandler', () => {
  let handler: GetCallHistoryHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetCallHistoryHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { customerId: 'USR-1', calls: [{ callId: 'CALL-1', startedAt: '2026-07-06T09:12:00Z', durationSec: 184, outcome: 'completed' }] };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetCallHistoryQuery('USR-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('call-center', 'get-call-history', { customerId: 'USR-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetCallHistoryQuery('USR-1'))).rejects.toThrow(PortFallbackException);
  });
});
