import { GetAnomalyDetailHandler } from './get-anomaly-detail.handler';
import { GetAnomalyDetailQuery } from '../get-anomaly-detail.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetAnomalyDetailHandler', () => {
  let handler: GetAnomalyDetailHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetAnomalyDetailHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { alertId: 'ANM-1', meterId: 'MTR-1', type: 'continuous_flow', severity: 'high', detectedAt: '2026-07-06T02:14:00Z', description: 'Chảy liên tục', recommendedAction: 'Kiểm tra rò rỉ' };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetAnomalyDetailQuery('ANM-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('meter-anomaly', 'get-anomaly-detail', { alertId: 'ANM-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetAnomalyDetailQuery('ANM-1'))).rejects.toThrow(PortFallbackException);
  });
});
