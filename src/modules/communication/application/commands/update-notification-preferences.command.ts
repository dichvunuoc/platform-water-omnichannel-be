/**
 * Update Notification Preferences Command (AC#2 — FR56)
 *
 * Updates customer notification preferences via PortRegistry → notification port.
 * WRITE operation — useCache: false.
 */

import { ICommand } from '@core/application';
import type { UpdateNotificationPreferencesPayload, UpdateNotificationPreferencesResponse } from '../dtos/notification-preferences.dto';

export class UpdateNotificationPreferencesCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly payload: UpdateNotificationPreferencesPayload,
  ) {}
}

export type UpdateNotificationPreferencesCommandResult = UpdateNotificationPreferencesResponse;
