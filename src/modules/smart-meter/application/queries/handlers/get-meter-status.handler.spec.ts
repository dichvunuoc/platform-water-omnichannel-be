import { GetMeterStatusHandler } from './get-meter-status.handler';
import { GetMeterStatusQuery } from '../get-meter-status.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetMeterStatusHandler', () => {
  let handler: GetMeterStatusHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetMeterStatusHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { meterId: 'MTR-1', online: true, batteryLevel: 82, lastSeenAt: '2026-07-07T07:55:00Z' };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetMeterStatusQuery('MTR-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('smart-meter', 'get-meter-status', { meterId: 'MTR-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetMeterStatusQuery('MTR-1'))).rejects.toThrow(PortFallbackException);
  });
});
