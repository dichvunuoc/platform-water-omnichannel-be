/**
 * Meter Module DI Tokens
 *
 * Following project convention: {MODULE}_{TYPE}_TOKEN
 * All tokens are Symbols for type-safe injection.
 */

// =============================================================================
// Port Tokens
// =============================================================================
export const METER_PORT_TOKEN = Symbol('IMeterPort');

// Meter Reading Port — consumption history, comparison, reading detail (Story 3.1)
export const METER_READING_PORT_TOKEN = Symbol('IMeterReadingPort');
