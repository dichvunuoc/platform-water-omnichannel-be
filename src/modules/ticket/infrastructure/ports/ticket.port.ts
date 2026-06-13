/**
 * Ticket Port Interface & Mock Adapter
 *
 * Defines the contract for downstream ticketing service communication.
 * MockTicketAdapter returns mock data during development.
 *
 * Story 5.1: AC#3 create-ticket, AC#4 tracking ID response
 * Story 5.2: AC#1 get-ticket-status, AC#2 get-ticket-history
 * Story 5.3: AC#2 submit-feedback
 *
 * Cache tier: dynamic (5-15 min) — ticket status changes frequently.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  CreateTicketResponseSchema,
  TicketStatusResponseSchema,
  TicketHistoryResponseSchema,
  SubmitFeedbackResponseSchema,
} from '../../application/dtos/ticket.dto';

/**
 * Ticket Port Interface
 *
 * Methods dispatched via PortRegistry.execute('ticket', method, params):
 *   create-ticket       — Story 5.1
 *   get-ticket-status   — Story 5.2 (AC#1)
 *   get-ticket-history  — Story 5.2 (AC#2)
 *   submit-feedback     — Story 5.3 (AC#2)
 */
export interface ITicketPort extends IPortAdapter {
  // Methods are invoked via execute(method, params) from IPortAdapter
}

/**
 * Mock Ticket Adapter
 *
 * Returns mock ticket responses from JSON files for development.
 * Extends MockAdapterBase for consistent mock behavior.
 */
@Injectable()
export class MockTicketAdapter extends MockAdapterBase implements ITicketPort {
  constructor() {
    super(
      'ticket',
      {
        'create-ticket': CreateTicketResponseSchema,
        'get-ticket-status': TicketStatusResponseSchema,
        'get-ticket-history': TicketHistoryResponseSchema,
        'submit-feedback': SubmitFeedbackResponseSchema,
      },
      new Logger('ticket-mock-adapter'),
    );
  }
}
