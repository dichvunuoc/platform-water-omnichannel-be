/**
 * Payment Module DI Tokens
 *
 * Following project convention: {MODULE}_{TYPE}_TOKEN
 * All tokens are Symbols for type-safe injection.
 */

// =============================================================================
// Port Tokens
// =============================================================================
export const PAYMENT_PORT_TOKEN = Symbol('IPaymentPort');
export const DEBT_PORT_TOKEN = Symbol('IDebtPort');
