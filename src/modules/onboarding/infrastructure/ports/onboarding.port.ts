import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { OnboardingStatusSchema, CreateOnboardingResultSchema } from '../../application/dtos/onboarding.dto';

/** Onboarding Port — new connection signup workflow (Phase 2, S5). */
export interface IOnboardingPort extends IPortAdapter {
  // Methods: create-onboarding-request, get-onboarding-status
}

@Injectable()
export class MockOnboardingAdapter extends MockAdapterBase implements IOnboardingPort {
  constructor() {
    super(
      'onboarding',
      {
        'create-onboarding-request': CreateOnboardingResultSchema,
        'get-onboarding-status': OnboardingStatusSchema,
      },
      new Logger('onboarding-mock-adapter'),
    );
  }
}
