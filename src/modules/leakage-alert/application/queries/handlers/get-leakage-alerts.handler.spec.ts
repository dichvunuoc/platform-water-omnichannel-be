import { GetLeakageAlertsHandler } from './get-leakage-alerts.handler';
import { GetLeakageAlertsQuery } from '../get-leakage-alerts.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetLeakageAlertsHandler', () => {
  let handler: GetLeakageAlertsHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetLeakageAlertsHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { customerId: 'USR-1', alerts: [{ alertId: 'LEAK-1', customerId: 'USR-1', suspectedLocation: 'addr', confidence: 0.86, status: 'investigating', detectedAt: '2026-07-05T03:20:00Z' }] };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetLeakageAlertsQuery('USR-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('leakage-alert', 'get-leakage-alerts', { customerId: 'USR-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetLeakageAlertsQuery('USR-1'))).rejects.toThrow(PortFallbackException);
  });
});
