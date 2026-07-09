/**
 * Ticket Module DI Tokens
 *
 * Following project convention: {MODULE}_{TYPE}_TOKEN
 * All tokens are Symbols for type-safe injection.
 */

// =============================================================================
// Port Tokens
// =============================================================================
export const TICKET_PORT_TOKEN = Symbol('ITicketPort');
export const KNOWLEDGE_BASE_PORT_TOKEN = Symbol('IKnowledgeBasePort');
