import { IQuery } from '@core/application';
import type { SurveyResult } from '../dtos/site-survey.dto';

export class GetSurveyResultQuery extends IQuery<SurveyResult> {
  constructor(public readonly surveyId: string) {
    super();
  }
}
export type GetSurveyResultResult = SurveyResult;
