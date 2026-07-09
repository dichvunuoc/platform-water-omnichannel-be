import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { CreateClickToCallCommand, CreateClickToCallResult } from '../create-click-to-call.command';
import type { ClickToCallResult } from '../../dtos/call-center.dto';

@CommandHandler(CreateClickToCallCommand)
export class CreateClickToCallHandler implements ICommandHandler<CreateClickToCallCommand> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: CreateClickToCallCommand): Promise<CreateClickToCallResult> {
    const r = await this.portRegistry.execute<ClickToCallResult>(
      'call-center',
      'create-click-to-call',
      { customerId: command.customerId, phoneNumber: command.phoneNumber, useCache: false },
    );
    if (!r?.data) throw new PortFallbackException('call-center');
    return r.data;
  }
}
