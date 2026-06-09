/**
 * Billing Module DI Tokens
 *
 * Following project convention: {MODULE}_{TYPE}_TOKEN
 * All tokens are Symbols for type-safe injection.
 */

// =============================================================================
// Port Tokens
// =============================================================================
export const TARIFF_PORT_TOKEN = Symbol('ITariffPort');

// Invoice Port — Story 3.3 (placeholder for future use)
export const INVOICE_PORT_TOKEN = Symbol('IInvoicePort');
