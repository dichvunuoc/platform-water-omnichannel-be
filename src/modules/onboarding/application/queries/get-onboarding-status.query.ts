import { IQuery } from '@core/application';
import type { OnboardingStatus } from '../dtos/onboarding.dto';

export class GetOnboardingStatusQuery extends IQuery<OnboardingStatus> {
  constructor(public readonly requestId: string) {
    super();
  }
}
export type GetOnboardingStatusResult = OnboardingStatus;
