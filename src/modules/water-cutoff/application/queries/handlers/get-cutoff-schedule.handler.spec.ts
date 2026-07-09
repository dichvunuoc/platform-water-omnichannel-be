import { GetCutoffScheduleHandler } from './get-cutoff-schedule.handler';
import { GetCutoffScheduleQuery } from '../get-cutoff-schedule.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetCutoffScheduleHandler', () => {
  let handler: GetCutoffScheduleHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetCutoffScheduleHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { areaId: 'CP-1', schedules: [{ from: '2026-07-08T08:00:00Z', to: '2026-07-08T12:00:00Z', reason: 'maintenance' }] };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetCutoffScheduleQuery('CP-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('water-cutoff', 'get-cutoff-schedule', { areaId: 'CP-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetCutoffScheduleQuery('CP-1'))).rejects.toThrow(PortFallbackException);
  });
});
