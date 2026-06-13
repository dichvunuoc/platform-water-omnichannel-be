/**
 * Update Notification Preferences Handler (AC#2 — FR56)
 *
 * Updates customer notification preferences via PortRegistry → notification port.
 * WRITE operation — useCache: false (preferences should always hit downstream live).
 */

import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { UpdateNotificationPreferencesCommand } from '../update-notification-preferences.command';
import type { UpdateNotificationPreferencesResponse } from '../../dtos/notification-preferences.dto';
import { PortFallbackException } from '@shared/port/port-exceptions';

@CommandHandler(UpdateNotificationPreferencesCommand)
export class UpdateNotificationPreferencesHandler implements ICommandHandler<UpdateNotificationPreferencesCommand> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: UpdateNotificationPreferencesCommand): Promise<UpdateNotificationPreferencesResponse> {
    const result = await this.portRegistry.execute<UpdateNotificationPreferencesResponse>(
      'notification',
      'update-notification-preferences',
      {
        customerId: command.customerId,
        channels: command.payload.channels,
        useCache: false,
      },
    );

    if (!result?.data) {
      throw new PortFallbackException('notification');
    }

    return result.data;
  }
}
