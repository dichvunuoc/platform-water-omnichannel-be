import { GetTeamLocationHandler } from './get-team-location.handler';
import { GetTeamLocationQuery } from '../get-team-location.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetTeamLocationHandler', () => {
  let handler: GetTeamLocationHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetTeamLocationHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { ticketId: 'TK-1', teamId: 'TEAM-1', latitude: 20.96, longitude: 107.31, updatedAt: '2026-07-07T08:00:00Z' };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetTeamLocationQuery('TK-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('field-team', 'get-team-location', { ticketId: 'TK-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetTeamLocationQuery('TK-1'))).rejects.toThrow(PortFallbackException);
  });
});
