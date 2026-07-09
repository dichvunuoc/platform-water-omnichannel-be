import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { SurveyResultSchema, CreateSurveyResultSchema } from '../../application/dtos/site-survey.dto';

/** Site Survey Port — on-site survey for new connection (Phase 2, part of onboarding). */
export interface ISiteSurveyPort extends IPortAdapter {
  // Methods: create-survey-request, get-survey-result
}

@Injectable()
export class MockSiteSurveyAdapter extends MockAdapterBase implements ISiteSurveyPort {
  constructor() {
    super(
      'site-survey',
      {
        'create-survey-request': CreateSurveyResultSchema,
        'get-survey-result': SurveyResultSchema,
      },
      new Logger('site-survey-mock-adapter'),
    );
  }
}
