import { GetLeakageDetailHandler } from './get-leakage-detail.handler';
import { GetLeakageDetailQuery } from '../get-leakage-detail.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetLeakageDetailHandler', () => {
  let handler: GetLeakageDetailHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetLeakageDetailHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { alertId: 'LEAK-1', customerId: 'USR-1', suspectedLocation: 'addr', confidence: 0.86, status: 'investigating', detectedAt: '2026-07-05T03:20:00Z', description: 'Nghi ngờ rò rỉ', estimatedLossM3: 2.5 };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetLeakageDetailQuery('LEAK-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('leakage-alert', 'get-leakage-detail', { alertId: 'LEAK-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetLeakageDetailQuery('LEAK-1'))).rejects.toThrow(PortFallbackException);
  });
});
