import { GetOnboardingStatusHandler } from './get-onboarding-status.handler';
import { GetOnboardingStatusQuery } from '../get-onboarding-status.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetOnboardingStatusHandler', () => {
  let handler: GetOnboardingStatusHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetOnboardingStatusHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { requestId: 'ONB-1', customerId: 'USR-1', stage: 'site_survey', createdAt: '2026-07-06T10:00:00Z', updatedAt: '2026-07-07T08:30:00Z' };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetOnboardingStatusQuery('ONB-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('onboarding', 'get-onboarding-status', { requestId: 'ONB-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetOnboardingStatusQuery('ONB-1'))).rejects.toThrow(PortFallbackException);
  });
});
