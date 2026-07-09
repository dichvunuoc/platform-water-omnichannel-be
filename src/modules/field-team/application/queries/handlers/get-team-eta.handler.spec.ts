import { GetTeamEtaHandler } from './get-team-eta.handler';
import { GetTeamEtaQuery } from '../get-team-eta.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetTeamEtaHandler', () => {
  let handler: GetTeamEtaHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetTeamEtaHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { ticketId: 'TK-1', teamId: 'TEAM-1', etaMinutes: 22, status: 'en_route' };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetTeamEtaQuery('TK-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('field-team', 'get-team-eta', { ticketId: 'TK-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetTeamEtaQuery('TK-1'))).rejects.toThrow(PortFallbackException);
  });
});
