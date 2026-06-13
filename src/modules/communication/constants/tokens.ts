/**
 * Communication Module DI Tokens
 *
 * Following project convention: {MODULE}_{TYPE}_TOKEN
 * All tokens are Symbols for type-safe injection.
 */

// =============================================================================
// Port Tokens
// =============================================================================
export const PROACTIVE_NOTIFICATION_PORT_TOKEN = Symbol('IProactiveNotificationPort');
export const NOTIFICATION_PORT_TOKEN = Symbol('INotificationPort');
