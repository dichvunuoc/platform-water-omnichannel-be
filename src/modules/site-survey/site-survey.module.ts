import { Module, OnModuleInit } from '@nestjs/common';
import { SiteSurveyController } from './infrastructure/http/site-survey.controller';
import { MockSiteSurveyAdapter } from './infrastructure/ports/site-survey.port';
import { SITE_SURVEY_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { CreateSurveyRequestHandler } from './application/commands/handlers/create-survey-request.handler';
import { GetSurveyResultHandler } from './application/queries/handlers/get-survey-result.handler';

@Module({
  controllers: [SiteSurveyController],
  providers: [
    MockSiteSurveyAdapter,
    { provide: SITE_SURVEY_PORT_TOKEN, useExisting: MockSiteSurveyAdapter },
    CreateSurveyRequestHandler,
    GetSurveyResultHandler,
  ],
  exports: [SITE_SURVEY_PORT_TOKEN],
})
export class SiteSurveyModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockSiteSurveyAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register('site-survey', this.mockAdapter, this.mockAdapter);
  }
}
