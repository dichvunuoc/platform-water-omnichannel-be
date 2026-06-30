/**
 * Ticketing Stub Types
 *
 * In-memory store types + SLA simulation (implementation detail of the stub).
 * Contract types (TicketPriority, TicketStage, event payloads) are imported
 * from the shared contract — NOT defined here.
 */

// Re-export contract types for convenience (stub consumers can import from either)
export type { TicketPriority, TicketStage, SlaSeverity } from '../messaging/domain/contracts';
import type { TicketPriority, TicketStage } from '../messaging/domain/contracts';

/**
 * Mock SLA policies (Chapter 5 §5.2 — P0: 1h ack + 4h resolve; P2: 24h + 7d).
 * For the stub, we use simplified deadline offsets (ms from creation).
 */
export const SLA_POLICIES: Record<TicketPriority, number> = {
  P0: 4 * 60 * 60 * 1000,   // 4 hours
  P1: 8 * 60 * 60 * 1000,   // 8 hours
  P2: 24 * 60 * 60 * 1000,  // 24 hours
  P3: 72 * 60 * 60 * 1000,  // 72 hours
};

export interface StubTicket {
  id: string;
  conversationId: string | null;
  customerId: string | null;
  channel: string;
  title: string;
  description: string;
  stage: TicketStage;
  priority: TicketPriority;
  assignee: string | null;
  createdAt: number;
  updatedAt: number;
  slaDeadline: number;
  closedAt: number | null;
}

export interface KanbanResponse {
  RECEIVED: StubTicket[];
  IN_PROGRESS: StubTicket[];
  WAITING: StubTicket[];
  RESOLVED: StubTicket[];
  CLOSED: StubTicket[];
  total: number;
  slaBreachedCount: number;
  slaWarningCount: number;
}

export interface CreateTicketRequest {
  conversationId: string;
  customerId?: string;
  channel?: string;
  priority?: TicketPriority;
  title?: string;
  description?: string;
  /** Demo: fast-forward SLA to near-breach */
  fastForwardSla?: boolean;
}

export interface AdvanceStageRequest {
  newStage: TicketStage;
}

export interface ReassignRequest {
  assignee: string;
}

/**
 * Event payloads (match the broker contract — Architecture §5)
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

export interface TicketStateChangedPayload {
  ticketId: string;
  newStage: TicketStage;
  previousStage?: TicketStage;
}

export interface SlaWarningPayload {
  ticketId: string;
  conversationId: string | null;
  slaDeadline: number;
  remainingMs: number;
  severity: 'WARNING' | 'BREACHED';
  stage: TicketStage;
  assignee: string | null;
}

export interface TicketClosedPayload {
  ticketId: string;
  conversationId: string | null;
  closedAt: number;
}
