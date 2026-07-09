import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { CreateSurveyRequestCommand, CreateSurveyRequestResult } from '../create-survey-request.command';
import type { CreateSurveyResult } from '../../dtos/site-survey.dto';

@CommandHandler(CreateSurveyRequestCommand)
export class CreateSurveyRequestHandler implements ICommandHandler<CreateSurveyRequestCommand> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: CreateSurveyRequestCommand): Promise<CreateSurveyRequestResult> {
    const r = await this.portRegistry.execute<CreateSurveyResult>(
      'site-survey',
      'create-survey-request',
      {
        customerId: command.customerId,
        address: command.address,
        preferredDate: command.preferredDate,
        useCache: false,
      },
    );
    if (!r?.data) throw new PortFallbackException('site-survey');
    return r.data;
  }
}
