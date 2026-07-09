import { CreateSurveyRequestHandler } from './create-survey-request.handler';
import { CreateSurveyRequestCommand } from '../create-survey-request.command';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('CreateSurveyRequestHandler', () => {
  let handler: CreateSurveyRequestHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new CreateSurveyRequestHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { surveyId: 'SVY-1', status: 'requested', scheduledAt: null };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new CreateSurveyRequestCommand('USR-1', '12 Nguyen Van Cu', '2026-07-10'));

    expect(portRegistry.execute).toHaveBeenCalledWith('site-survey', 'create-survey-request', {
      customerId: 'USR-1',
      address: '12 Nguyen Van Cu',
      preferredDate: '2026-07-10',
      useCache: false,
    });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(
      handler.execute(new CreateSurveyRequestCommand('USR-1', 'addr', '2026-07-10')),
    ).rejects.toThrow(PortFallbackException);
  });
});
