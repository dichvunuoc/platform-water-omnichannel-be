import { GetCustomerLocationHandler } from './get-customer-location.handler';
import { GetCustomerLocationQuery } from '../get-customer-location.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetCustomerLocationHandler', () => {
  let handler: GetCustomerLocationHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetCustomerLocationHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { customerId: 'USR-1', latitude: 20.96, longitude: 107.31, address: 'Cẩm Phả' };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetCustomerLocationQuery('USR-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('gis', 'get-customer-location', { customerId: 'USR-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetCustomerLocationQuery('USR-1'))).rejects.toThrow(PortFallbackException);
  });
});
