import { CheckCoverageHandler } from './check-coverage.handler';
import { CheckCoverageQuery } from '../check-coverage.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('CheckCoverageHandler', () => {
  let handler: CheckCoverageHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new CheckCoverageHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { address: '12 Nguyen Van Cu', covered: true, dma: 'CP-1', estimatedConnectionDays: 7 };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new CheckCoverageQuery('12 Nguyen Van Cu'));

    expect(portRegistry.execute).toHaveBeenCalledWith('gis', 'check-coverage', { address: '12 Nguyen Van Cu' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new CheckCoverageQuery('addr'))).rejects.toThrow(PortFallbackException);
  });
});
