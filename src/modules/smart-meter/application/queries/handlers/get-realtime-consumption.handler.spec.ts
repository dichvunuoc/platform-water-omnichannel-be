import { GetRealtimeConsumptionHandler } from './get-realtime-consumption.handler';
import { GetRealtimeConsumptionQuery } from '../get-realtime-consumption.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetRealtimeConsumptionHandler', () => {
  let handler: GetRealtimeConsumptionHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetRealtimeConsumptionHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { customerId: 'USR-1', meterId: 'MTR-1', currentFlowM3h: 0.12, todayM3: 0.3, lastReadingAt: '2026-07-07T08:00:00Z' };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetRealtimeConsumptionQuery('USR-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('smart-meter', 'get-realtime-consumption', { customerId: 'USR-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetRealtimeConsumptionQuery('USR-1'))).rejects.toThrow(PortFallbackException);
  });
});
