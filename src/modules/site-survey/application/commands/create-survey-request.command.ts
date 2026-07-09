import { ICommand } from '@core/application';
import type { CreateSurveyResult } from '../dtos/site-survey.dto';

export class CreateSurveyRequestCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly address: string,
    public readonly preferredDate: string,
  ) {}
}
export type CreateSurveyRequestResult = CreateSurveyResult;
