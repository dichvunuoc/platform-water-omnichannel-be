import { GetActiveCampaignsHandler } from './get-active-campaigns.handler';
import { GetActiveCampaignsQuery } from '../get-active-campaigns.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetActiveCampaignsHandler', () => {
  let handler: GetActiveCampaignsHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetActiveCampaignsHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { customerId: 'USR-1', campaigns: [{ campaignId: 'CAMP-1', title: 'Tiết kiệm', audience: 'all', startsAt: '2026-06-01T00:00:00Z', endsAt: '2026-08-31T23:59:59Z' }] };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetActiveCampaignsQuery('USR-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('campaign', 'get-active-campaigns', { customerId: 'USR-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetActiveCampaignsQuery('USR-1'))).rejects.toThrow(PortFallbackException);
  });
});
