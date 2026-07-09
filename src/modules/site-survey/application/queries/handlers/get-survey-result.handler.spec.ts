import { GetSurveyResultHandler } from './get-survey-result.handler';
import { GetSurveyResultQuery } from '../get-survey-result.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetSurveyResultHandler', () => {
  let handler: GetSurveyResultHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetSurveyResultHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { surveyId: 'SVY-1', customerId: 'USR-1', status: 'completed', scheduledAt: '2026-07-05T08:00:00Z', result: { feasible: true, notes: 'ok' } };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetSurveyResultQuery('SVY-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('site-survey', 'get-survey-result', { surveyId: 'SVY-1' });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetSurveyResultQuery('SVY-1'))).rejects.toThrow(PortFallbackException);
  });
});
