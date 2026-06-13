/**
 * Proactive Notification Port Interface & Mock Adapter
 *
 * Defines the contract for downstream proactive communication service.
 * MockProactiveNotificationAdapter returns mock data during development.
 *
 * AC: #1 (active alerts), #2 (alert history), #3 (acknowledge), #4 (dynamic cache tier)
 *
 * IMPORTANT: Uses cacheTier: dynamic — responses cached 5-15 min.
 * Port config already exists in api-endpoints.yaml.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  GetActiveAlertsResponseSchema,
  AlertHistoryResponseSchema,
  AcknowledgeAlertResponseSchema,
} from '../../application/dtos/proactive-notification.dto';

/**
 * Proactive Notification Port Interface
 *
 * Methods: get-active-alerts, get-alert-history, acknowledge-alert
 * Each method is dispatched via PortRegistry.execute('proactive-notification', method, params).
 */
export interface IProactiveNotificationPort extends IPortAdapter {
  // Methods are invoked via execute(method, params) from IPortAdapter
}

/**
 * Mock Proactive Notification Adapter
 *
 * Returns mock alert responses from JSON files for development.
 * Extends MockAdapterBase for consistent mock behavior.
 */
@Injectable()
export class MockProactiveNotificationAdapter extends MockAdapterBase implements IProactiveNotificationPort {
  constructor() {
    super(
      'proactive-notification',
      {
        'get-active-alerts': GetActiveAlertsResponseSchema,
        'get-alert-history': AlertHistoryResponseSchema,
        'acknowledge-alert': AcknowledgeAlertResponseSchema,
      },
      new Logger('proactive-notification-mock-adapter'),
    );
  }
}
