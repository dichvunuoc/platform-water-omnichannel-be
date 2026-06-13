/**
 * Communication Module — Application Layer Barrel Export
 */

export * from './dtos/proactive-notification.dto';
export * from './dtos/notification.dto';
export * from './dtos/notification-preferences.dto';
export * from './queries/get-active-alerts.query';
export * from './queries/get-alert-history.query';
export * from './queries/get-notification-preferences.query';
export * from './queries/get-notification-history.query';
export * from './commands/acknowledge-alert.command';
export * from './commands/dispatch-notification.command';
export * from './commands/update-notification-preferences.command';
