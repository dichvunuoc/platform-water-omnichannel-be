/**
 * Dispatch Notification Command (AC#1, #2, #3 — FR54/FR55)
 *
 * Cross-module command — dispatched from payment, ticket, and other modules.
 * Handled by DispatchNotificationHandler in the communication module.
 *
 * Flow: Rate limiter check → channel dispatch → session event stub.
 */

import { ICommand } from '@core/application';
import type { DispatchNotificationPayload, DispatchNotificationResult } from '../dtos/notification.dto';

export class DispatchNotificationCommand implements ICommand {
  constructor(public readonly payload: DispatchNotificationPayload) {}
}

export type DispatchNotificationCommandResult = DispatchNotificationResult;
