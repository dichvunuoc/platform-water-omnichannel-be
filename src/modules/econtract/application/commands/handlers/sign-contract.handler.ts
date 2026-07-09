import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { SignContractCommand, SignContractResultType } from '../sign-contract.command';
import type { SignContractResult } from '../../dtos/econtract.dto';

@CommandHandler(SignContractCommand)
export class SignContractHandler implements ICommandHandler<SignContractCommand> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: SignContractCommand): Promise<SignContractResultType> {
    const r = await this.portRegistry.execute<SignContractResult>('econtract', 'sign-contract', {
      customerId: command.customerId,
      dossierId: command.dossierId,
      signatureRef: command.signatureRef,
      useCache: false,
    });
    if (!r?.data) throw new PortFallbackException('econtract');
    return r.data;
  }
}
