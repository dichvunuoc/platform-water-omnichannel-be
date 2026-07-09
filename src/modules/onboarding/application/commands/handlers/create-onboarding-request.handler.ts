import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { CreateOnboardingRequestCommand, CreateOnboardingRequestResult } from '../create-onboarding-request.command';
import type { CreateOnboardingResult } from '../../dtos/onboarding.dto';

@CommandHandler(CreateOnboardingRequestCommand)
export class CreateOnboardingRequestHandler
  implements ICommandHandler<CreateOnboardingRequestCommand>
{
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: CreateOnboardingRequestCommand): Promise<CreateOnboardingRequestResult> {
    const r = await this.portRegistry.execute<CreateOnboardingResult>(
      'onboarding',
      'create-onboarding-request',
      { customerId: command.customerId, ...command.payload, useCache: false },
    );
    if (!r?.data) throw new PortFallbackException('onboarding');
    return r.data;
  }
}
