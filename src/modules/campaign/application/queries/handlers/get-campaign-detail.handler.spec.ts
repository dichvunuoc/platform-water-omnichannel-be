import { GetCampaignDetailHandler } from './get-campaign-detail.handler';
import { GetCampaignDetailQuery } from '../get-campaign-detail.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetCampaignDetailHandler', () => {
  let handler: GetCampaignDetailHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetCampaignDetailHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { campaignId: 'CAMP-1', title: 'Tiết kiệm', audience: 'all', startsAt: '2026-06-01T00:00:00Z', endsAt: '2026-08-31T23:59:59Z', description: 'Giảm 10%', termsUrl: 'https://x/terms' };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetCampaignDetailQuery('CAMP-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('campaign', 'get-campaign-detail', { campaignId: 'CAMP-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetCampaignDetailQuery('CAMP-1'))).rejects.toThrow(PortFallbackException);
  });
});
