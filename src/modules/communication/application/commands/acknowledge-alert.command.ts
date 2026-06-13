/**
 * Acknowledge Alert Command (AC#3)
 *
 * Records customer acknowledgement of an alert.
 * WRITE operation — uses COMMAND_BUS_TOKEN and useCache: false.
 */

import { ICommand } from '@core/application';
import type { AcknowledgeAlertResponse } from '../dtos/proactive-notification.dto';

export class AcknowledgeAlertCommand implements ICommand {
  constructor(
    public readonly alertId: string,
    public readonly customerId: string,
  ) {}
}

export type AcknowledgeAlertResult = AcknowledgeAlertResponse;
