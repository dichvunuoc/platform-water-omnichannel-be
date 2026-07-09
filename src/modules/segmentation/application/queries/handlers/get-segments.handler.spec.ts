import { GetSegmentsHandler } from './get-segments.handler';
import { GetSegmentsQuery } from '../get-segments.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetSegmentsHandler', () => {
  let handler: GetSegmentsHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetSegmentsHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = {
      customerId: 'USR-1',
      segment: { customerType: 'sinh_hoat', valueSegment: 'VIP', area: 'A', behaviorTags: ['loyal'] },
    };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetSegmentsQuery('USR-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('segmentation', 'get-segments', { customerId: 'USR-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetSegmentsQuery('USR-1'))).rejects.toThrow(PortFallbackException);
  });
});
