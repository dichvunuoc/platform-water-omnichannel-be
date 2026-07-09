import { GetQualityAtLocationHandler } from './get-quality-at-location.handler';
import { GetQualityAtLocationQuery } from '../get-quality-at-location.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetQualityAtLocationHandler', () => {
  let handler: GetQualityAtLocationHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetQualityAtLocationHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { location: 'Cẩm Phả', testedAt: '2026-07-07T06:00:00Z', turbidity: 0.4, chlorine: 0.3, ph: 7.2, status: 'safe' };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetQualityAtLocationQuery('Cẩm Phả'));

    expect(portRegistry.execute).toHaveBeenCalledWith('water-quality', 'get-quality-at-location', { location: 'Cẩm Phả' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetQualityAtLocationQuery('Cẩm Phả'))).rejects.toThrow(PortFallbackException);
  });
});
