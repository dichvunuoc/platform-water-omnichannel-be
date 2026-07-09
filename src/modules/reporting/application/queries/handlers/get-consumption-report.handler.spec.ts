import { GetConsumptionReportHandler } from './get-consumption-report.handler';
import { GetConsumptionReportQuery } from '../get-consumption-report.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetConsumptionReportHandler', () => {
  let handler: GetConsumptionReportHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetConsumptionReportHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { customerId: 'USR-1', period: '2026-06', totalM3: 18, amount: 120000, comparisonPercent: -12 };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetConsumptionReportQuery('USR-1', '2026-06'));

    expect(portRegistry.execute).toHaveBeenCalledWith('reporting', 'get-consumption-report', {
      customerId: 'USR-1',
      period: '2026-06',
    });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetConsumptionReportQuery('USR-1', '2026-06'))).rejects.toThrow(
      PortFallbackException,
    );
  });
});
