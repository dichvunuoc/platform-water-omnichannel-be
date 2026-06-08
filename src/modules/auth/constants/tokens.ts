/**
 * Auth Module DI Tokens
 *
 * Following project convention: {MODULE}_{TYPE}_TOKEN
 * All tokens are Symbols for type-safe injection.
 */

// =============================================================================
// Service Tokens
// =============================================================================
export const PII_ENCRYPTION_SERVICE_TOKEN = Symbol('IPiiEncryptionService');

// =============================================================================
// Port Tokens
// =============================================================================
export const AUTH_PORT_TOKEN = Symbol('IAuthPort');

// =============================================================================
// better-auth Instance Token
// =============================================================================
export const BETTER_AUTH_INSTANCE_TOKEN = Symbol('BetterAuthInstance');
