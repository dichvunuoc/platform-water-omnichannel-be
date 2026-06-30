import {
  Controller, Get, Post, Param, Body, HttpCode, HttpStatus, Inject, NotFoundException,
} from '@nestjs/common';
import type { ICommandBus } from 'src/libs/core/application';
import { COMMAND_BUS_TOKEN } from 'src/libs/core/constants';
import { CreateTicketCommand, AdvanceStageCommand } from '../../application/commands';
import { CreateTicketDto, AdvanceStageDto } from '../../application/dtos';
import type { ITicketRepository } from '../../domain';
import { TICKET_REPOSITORY_TOKEN } from '../../constants';

@Controller('tickets')
export class TicketingController {
  constructor(
    @Inject(COMMAND_BUS_TOKEN)
    private readonly commandBus: ICommandBus,
    @Inject(TICKET_REPOSITORY_TOKEN)
    private readonly repo: ITicketRepository,
  ) {}

  // ─── READ ───

  @Get('kanban')
  async getKanban() {
    const open = await this.repo.findOpenTickets();
    const stages = ['RECEIVED', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'] as const;
    const grouped: any = { total: 0, slaBreachedCount: 0, slaWarningCount: 0 };
    for (const s of stages) grouped[s] = [];

    // Include resolved/closed from full scan (for now, open only for MVP)
    for (const ticket of open) {
      grouped[ticket.stage.value]?.push(this.enrich(ticket));
      grouped.total++;
      if (ticket.resolveRemainingMs < 0) grouped.slaBreachedCount++;
      else if (ticket.resolveRemainingMs < 30 * 60 * 1000) grouped.slaWarningCount++;
    }
    return grouped;
  }

  @Get(':id')
  async getTicket(@Param('id') id: string) {
    const ticket = await this.repo.getById(id);
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    return this.enrich(ticket);
  }

  @Get('conversations/:conversationId/ticket')
  async getConversationTicket(@Param('conversationId') conversationId: string) {
    const ticket = await this.repo.findByConversationId(conversationId);
    if (!ticket) throw new NotFoundException('No ticket linked');
    return this.enrich(ticket);
  }

  // ─── WRITE (commands) ───

  @Post()
  @HttpCode(HttpStatus.OK)
  async createTicket(@Body() dto: CreateTicketDto) {
    const result = await this.commandBus.execute(
      new CreateTicketCommand(
        dto.customerId ?? null,
        null,
        dto.channel ?? 'ZALO',
        dto.title ?? 'Untitled',
        dto.description ?? '',
        dto.priority ?? 'P2',
      ),
    );
    return { ok: true, ticketId: result.ticketId };
  }

  @Post(':id/advance')
  @HttpCode(HttpStatus.OK)
  async advanceStage(
    @Param('id') id: string,
    @Body() dto: AdvanceStageDto,
  ) {
    await this.commandBus.execute(new AdvanceStageCommand(id, dto.newStage));
    return { ok: true, ticketId: id, stage: dto.newStage };
  }

  // ─── SLA enrichment ───

  private enrich(ticket: any) {
    const remainingMs = ticket.resolveRemainingMs;
    const isResolved = ticket.stage?.isResolved ?? false;
    return {
      id: ticket.id,
      conversationId: ticket.conversationId,
      customerId: ticket.customerId,
      channel: ticket.channel,
      title: ticket.title,
      stage: ticket.stage?.value ?? ticket.stage,
      priority: ticket.priority?.value ?? ticket.priority,
      assignee: ticket.assignee,
      parentId: ticket.parentId,
      ackDeadline: ticket.ackDeadline,
      resolveDeadline: ticket.resolveDeadline,
      acknowledgedAt: ticket.acknowledgedAt,
      closedAt: ticket.closedAt,
      escalated: ticket.escalated,
      escalationLevel: ticket.escalationLevel,
      reopenedFromCsat: ticket.reopenedFromCsat,
      slaRemainingMs: isResolved ? 0 : remainingMs,
      slaColor: isResolved ? 'gray' : remainingMs <= 0 ? 'red' : remainingMs < 30 * 60 * 1000 ? 'yellow' : 'green',
      slaWarning: !isResolved && remainingMs < 30 * 60 * 1000 && remainingMs > 0,
      slaBreached: !isResolved && remainingMs <= 0,
    };
  }
}
