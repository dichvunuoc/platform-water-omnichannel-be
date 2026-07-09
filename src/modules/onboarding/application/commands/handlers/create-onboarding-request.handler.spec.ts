import { CreateOnboardingRequestHandler } from './create-onboarding-request.handler';
import { CreateOnboardingRequestCommand } from '../create-onboarding-request.command';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('CreateOnboardingRequestHandler', () => {
  let handler: CreateOnboardingRequestHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new CreateOnboardingRequestHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { requestId: 'ONB-1', stage: 'submitted', createdAt: '2026-07-07T10:00:00Z' };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(
      new CreateOnboardingRequestCommand('USR-1', {
        address: '12 Nguyen Van Cu',
        customerType: 'sinh_hoat',
        documents: ['doc-1'],
      }),
    );

    expect(portRegistry.execute).toHaveBeenCalledWith('onboarding', 'create-onboarding-request', {
      customerId: 'USR-1',
      address: '12 Nguyen Van Cu',
      customerType: 'sinh_hoat',
      documents: ['doc-1'],
      useCache: false,
    });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(
      handler.execute(
        new CreateOnboardingRequestCommand('USR-1', {
          address: 'addr',
          customerType: 'sinh_hoat',
          documents: [],
        }),
      ),
    ).rejects.toThrow(PortFallbackException);
  });
});
