/**
 * Ticketing Contract — shared types between OmniCare and the Ticketing & SLA service.
 *
 * This file defines the CONTRACT (not implementation). Both the Omnichannel
 * service and the Ticketing stub/real service import from here.
 *
 * When wave-2 replaces the stub, this file stays unchanged — it IS the contract.
 */

/** Ticket priority levels (Chapter 5 §5.2 — P0 khẩn cấp → P3 thấp). */
export type TicketPriority = 'P0' | 'P1' | 'P2' | 'P3';

/** Ticket workflow stages. */
export type TicketStage = 'RECEIVED' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';

/** SLA severity for warning events. */
export type SlaSeverity = 'WARNING' | 'BREACHED' | 'OK';

/**
 * Create Ticket Request payload (FR19 — OmniCare → Ticketing via broker).
 */
export interface TicketCreateRequestedPayload {
  conversationId: string;
  customerId?: string;
  channel?: string;
  priority?: TicketPriority;
  title?: string;
  description?: string;
  idempotencyKey: string;
}

/**
 * Ticket State Changed payload (Ticketing → OmniCare via broker).
 */
export interface TicketStateChangedPayload {
  ticketId: string;
  newStage: TicketStage;
  previousStage?: TicketStage;
}

/**
 * SLA Warning payload (FR25 — Ticketing → OmniCare via broker).
 */
export interface SlaWarningPayload {
  ticketId: string;
  conversationId: string | null;
  slaDeadline: number;
  remainingMs: number;
  severity: 'WARNING' | 'BREACHED';
  stage: TicketStage;
  assignee: string | null;
}

/**
 * Ticket Closed payload (FR42 CSAT trigger — Ticketing → OmniCare).
 */
export interface TicketClosedPayload {
  ticketId: string;
  conversationId: string | null;
  closedAt: number;
}

/**
 * Reassign request payload (FR54 — OmniCare → Ticketing).
 */
export interface TicketReassignRequestedPayload {
  ticketId: string;
  assignee: string;
}
