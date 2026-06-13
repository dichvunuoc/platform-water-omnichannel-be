/**
 * Notification Port Interface & Mock Adapter
 *
 * Port for downstream Notification Service communication.
 * Methods dispatched via PortRegistry.execute('notification', method, params).
 *
 * AC#2: Channel Dispatch (FR54)
 * Story 6.3: get-notification-preferences, update-notification-preferences, get-notification-history
 *
 * CRITICAL: BFF is a pure pass-through for notification dispatch.
 * Rate limiting and channel fallback logic lives in DispatchNotificationHandler.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { DispatchNotificationResultSchema } from '../../application/dtos/notification.dto';
import {
  NotificationPreferencesResponseSchema,
  UpdateNotificationPreferencesResponseSchema,
  NotificationHistoryResponseSchema,
} from '../../application/dtos/notification-preferences.dto';

export interface INotificationPort extends IPortAdapter {
  // Methods invoked via execute(method, params) from IPortAdapter
}

@Injectable()
export class MockNotificationAdapter extends MockAdapterBase implements INotificationPort {
  constructor() {
    super(
      'notification',
      {
        'dispatch-notification': DispatchNotificationResultSchema,
        'get-notification-preferences': NotificationPreferencesResponseSchema,
        'update-notification-preferences': UpdateNotificationPreferencesResponseSchema,
        'get-notification-history': NotificationHistoryResponseSchema,
      },
      new Logger('notification-mock-adapter'),
    );
  }
}
