/**
 * Setup Auto Debit Handler (AC#1, #3, #4)
 *
 * Registers bank account for automatic bill payment via payment port.
 * cacheTier: transaction — every request hits Payment Service live (FR35).
 *
 * AC#2: bankAccount fields are auto-redacted by global pino-redact config.
 */

import { Logger } from '@nestjs/common';
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { SetupAutoDebitCommand } from '../setup-auto-debit.command';
import type { SetupAutoDebitResponse } from '../../dtos/payment.dto';
import type { PortResult } from '@shared/port/port.interface';
import { NotFoundException } from '@core/common';

@CommandHandler(SetupAutoDebitCommand)
export class SetupAutoDebitHandler implements ICommandHandler<SetupAutoDebitCommand> {
  private readonly logger = new Logger(SetupAutoDebitHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: SetupAutoDebitCommand): Promise<SetupAutoDebitResponse> {
    // AC#2: bankAccount is redacted by global pino-redact
    this.logger.log(`Auto debit registration initiated`);

    const result: PortResult<SetupAutoDebitResponse> =
      await this.portRegistry.execute<SetupAutoDebitResponse>(
        'payment',
        'setup-auto-debit',
        { customerId: command.customerId, bankAccount: command.bankAccount },
      );

    if (!result.data) {
      throw new NotFoundException(
        'Auto debit registration failed — no response from payment service',
      );
    }

    this.logger.log(`Auto debit registered: ${result.data.registrationId}, status: ${result.data.status}`);
    return result.data;
  }
}
