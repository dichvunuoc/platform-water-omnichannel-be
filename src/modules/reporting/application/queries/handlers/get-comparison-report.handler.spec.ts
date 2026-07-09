import { GetComparisonReportHandler } from './get-comparison-report.handler';
import { GetComparisonReportQuery } from '../get-comparison-report.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetComparisonReportHandler', () => {
  let handler: GetComparisonReportHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetComparisonReportHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { customerId: 'USR-1', comparisonType: 'previous_period', current: 18, previous: 20.5, changePercent: -12.2 };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetComparisonReportQuery('USR-1', 'previous_period'));

    expect(portRegistry.execute).toHaveBeenCalledWith('reporting', 'get-comparison-report', {
      customerId: 'USR-1',
      comparisonType: 'previous_period',
    });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(
      handler.execute(new GetComparisonReportQuery('USR-1', 'previous_period')),
    ).rejects.toThrow(PortFallbackException);
  });
});
