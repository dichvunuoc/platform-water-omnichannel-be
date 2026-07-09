import { GetAnomalyAlertsHandler } from './get-anomaly-alerts.handler';
import { GetAnomalyAlertsQuery } from '../get-anomaly-alerts.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetAnomalyAlertsHandler', () => {
  let handler: GetAnomalyAlertsHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetAnomalyAlertsHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { customerId: 'USR-1', alerts: [{ alertId: 'ANM-1', meterId: 'MTR-1', type: 'continuous_flow', severity: 'high', detectedAt: '2026-07-06T02:14:00Z' }] };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetAnomalyAlertsQuery('USR-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('meter-anomaly', 'get-anomaly-alerts', { customerId: 'USR-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetAnomalyAlertsQuery('USR-1'))).rejects.toThrow(PortFallbackException);
  });
});
