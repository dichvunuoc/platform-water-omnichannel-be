import {
  Controller, Post, Param, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { TicketingStubService } from './ticketing-stub.service';
import type {
  CreateTicketRequest, AdvanceStageRequest, ReassignRequest,
} from './ticketing-stub.types';

/**
 * Ticketing Stub Controller — INTERNAL ONLY
 *
 * All BFF-facing endpoints (GET /bff/tickets/kanban, GET /bff/tickets/:id, etc.)
 * are handled by the BffController which calls TicketViewService → TicketingStubService.
 *
 * This controller only exposes:
 *   - Internal demo endpoints (J3 triggers: fast-forward SLA, manual warning)
 *   - Write proxy endpoints for create/advance/reassign (called by BFF handler,
 *     NOT directly by the FE)
 */
@Controller('internal/tickets')
export class TicketingStubController {
  constructor(private readonly stub: TicketingStubService) {}

  // ─── Internal demo endpoints (J3 triggers — NOT exposed to FE) ───

  /**
   * Fast-forward SLA to near-breach for demo.
   */
  @Post(':id/fast-forward-sla')
  @HttpCode(HttpStatus.OK)
  fastForwardSla(
    @Param('id') id: string,
    @Body() body: { minutes?: number },
  ) {
    const ticket = this.stub.fastForwardSla(id, body.minutes ?? 3);
    return { ok: true, ticket };
  }

  /**
   * Manually trigger SlaWarning event (J3 demo).
   */
  @Post(':id/trigger-sla-warning')
  @HttpCode(HttpStatus.OK)
  triggerSlaWarning(
    @Param('id') id: string,
    @Body() body: { severity?: 'WARNING' | 'BREACHED' },
  ) {
    this.stub.triggerSlaWarning(id, body.severity ?? 'WARNING');
    return { ok: true };
  }
}
