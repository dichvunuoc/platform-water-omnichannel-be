import { Module, OnModuleInit } from '@nestjs/common';
import { OnboardingController } from './infrastructure/http/onboarding.controller';
import { MockOnboardingAdapter } from './infrastructure/ports/onboarding.port';
import { ONBOARDING_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { CreateOnboardingRequestHandler } from './application/commands/handlers/create-onboarding-request.handler';
import { SubmitDocumentsHandler } from './application/commands/handlers/submit-documents.handler';
import { GetOnboardingStatusHandler } from './application/queries/handlers/get-onboarding-status.handler';

@Module({
  controllers: [OnboardingController],
  providers: [
    MockOnboardingAdapter,
    { provide: ONBOARDING_PORT_TOKEN, useExisting: MockOnboardingAdapter },
    CreateOnboardingRequestHandler,
    SubmitDocumentsHandler,
    GetOnboardingStatusHandler,
  ],
  exports: [ONBOARDING_PORT_TOKEN],
})
export class OnboardingModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockOnboardingAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register('onboarding', this.mockAdapter, this.mockAdapter);
  }
}
