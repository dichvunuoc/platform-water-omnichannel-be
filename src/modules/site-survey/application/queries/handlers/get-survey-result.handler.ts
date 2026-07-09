import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetSurveyResultQuery, GetSurveyResultResult } from '../get-survey-result.query';
import type { SurveyResult } from '../../dtos/site-survey.dto';

@QueryHandler(GetSurveyResultQuery)
export class GetSurveyResultHandler implements IQueryHandler<GetSurveyResultQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetSurveyResultQuery): Promise<GetSurveyResultResult> {
    const r = await this.portRegistry.execute<SurveyResult>('site-survey', 'get-survey-result', {
      surveyId: query.surveyId,
    });
    if (!r?.data) throw new PortFallbackException('site-survey');
    return r.data;
  }
}
