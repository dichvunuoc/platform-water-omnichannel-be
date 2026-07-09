import { GetQualityAlertsHandler } from './get-quality-alerts.handler';
import { GetQualityAlertsQuery } from '../get-quality-alerts.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetQualityAlertsHandler', () => {
  let handler: GetQualityAlertsHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetQualityAlertsHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data (no area filter)', async () => {
    const data = { alerts: [{ alertId: 'QA-1', area: 'CP-1', parameter: 'turbidity', value: 5, limit: 2, issuedAt: '2026-07-07T06:00:00Z', status: 'active' }] };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetQualityAlertsQuery());

    expect(portRegistry.execute).toHaveBeenCalledWith('water-quality', 'get-quality-alerts', {});
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetQualityAlertsQuery())).rejects.toThrow(PortFallbackException);
  });
});
