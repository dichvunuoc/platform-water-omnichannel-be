/**
 * Acknowledge Alert Handler (AC#3)
 *
 * Records customer acknowledgement via PortRegistry → proactive-notification port.
 * WRITE operation — useCache: false (acknowledgement should always hit downstream live).
 */

import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { AcknowledgeAlertCommand } from '../acknowledge-alert.command';
import type { AcknowledgeAlertResponse } from '../../dtos/proactive-notification.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

@CommandHandler(AcknowledgeAlertCommand)
export class AcknowledgeAlertHandler implements ICommandHandler<AcknowledgeAlertCommand> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: AcknowledgeAlertCommand): Promise<AcknowledgeAlertResponse> {
    const result = await this.portRegistry.execute<AcknowledgeAlertResponse>(
      'proactive-notification',
      'acknowledge-alert',
      { alertId: command.alertId, customerId: command.customerId, useCache: false },
    );

    if (!result?.data) {
      throw new PortFallbackException('proactive-notification');
    }

    return result.data;
  }
}
