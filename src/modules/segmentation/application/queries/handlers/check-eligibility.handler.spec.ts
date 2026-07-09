import { CheckEligibilityHandler } from './check-eligibility.handler';
import { CheckEligibilityQuery } from '../check-eligibility.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('CheckEligibilityHandler', () => {
  let handler: CheckEligibilityHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new CheckEligibilityHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { customerId: 'USR-1', campaignId: 'CAMP-1', eligible: true, reasons: ['VIP'] };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new CheckEligibilityQuery('USR-1', 'CAMP-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('segmentation', 'check-eligibility', {
      customerId: 'USR-1',
      campaignId: 'CAMP-1',
    });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new CheckEligibilityQuery('USR-1', 'CAMP-1'))).rejects.toThrow(
      PortFallbackException,
    );
  });
});
