import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetOnboardingStatusQuery, GetOnboardingStatusResult } from '../get-onboarding-status.query';
import type { OnboardingStatus } from '../../dtos/onboarding.dto';

@QueryHandler(GetOnboardingStatusQuery)
export class GetOnboardingStatusHandler implements IQueryHandler<GetOnboardingStatusQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetOnboardingStatusQuery): Promise<GetOnboardingStatusResult> {
    const r = await this.portRegistry.execute<OnboardingStatus>(
      'onboarding',
      'get-onboarding-status',
      { requestId: query.requestId },
    );
    if (!r?.data) throw new PortFallbackException('onboarding');
    return r.data;
  }
}
