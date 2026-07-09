import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { SubmitDocumentsCommand, SubmitDocumentsResultType } from '../submit-documents.command';
import type { SubmitDocumentsResult } from '../../dtos/onboarding.dto';

@CommandHandler(SubmitDocumentsCommand)
export class SubmitDocumentsHandler implements ICommandHandler<SubmitDocumentsCommand> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: SubmitDocumentsCommand): Promise<SubmitDocumentsResultType> {
    const result = await this.portRegistry.execute<SubmitDocumentsResult>(
      'onboarding',
      'submit-documents',
      { requestId: command.requestId, customerId: command.customerId, documents: command.documents, useCache: false },
    );
    if (!result?.data) throw new PortFallbackException('onboarding');
    return result.data;
  }
}
