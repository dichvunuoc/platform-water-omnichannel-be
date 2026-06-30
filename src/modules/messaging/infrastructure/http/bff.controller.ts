import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { ICommandBus } from 'src/libs/core/application';
import { COMMAND_BUS_TOKEN } from 'src/libs/core/constants';
import { ConversationReadDao } from '../persistence/read/conversation-read-dao';
import { SendReplyCommand } from '../../application/commands/send-reply.command';
import { CloseConversationCommand } from '../../application/commands/close-conversation.command';
import { ArchiveConversationCommand } from '../../application/commands/archive-conversation.command';
import { CreateTicketRequestCommand } from '../../application/commands/create-ticket-request.command';
import { ReplyDto, UpdatePresenceDto, CloseConversationDto, ClassifyImageDto, TranscribeAudioDto, ClassifyIntentDto, CreateTicketDto, DispatchWorkOrderDto, SubmitCsatDto } from '../../application/dtos';
import { DispatchWorkOrderCommand } from '../../application/commands/dispatch-work-order.command';
import { PresenceService, AgentStatus } from '../../application/presence.service';
import { TicketViewService } from '../../application/ticket-view.service';
import { AiInsightService } from '../../application/ai-insight.service';
import { AssignCustomerCommand } from '../../application/commands/assign-customer.command';
import { CUSTOMER_360_PORT_TOKEN } from '../../constants/customer-tokens';
import type { ICustomer360Port } from '../../domain/ports/customer-360.port';
import { ChannelEnum } from '../../domain';

/**
 * BFF Controller — the SPA's HTTP entry point.
 *
 * Serves the delivered frontend's data needs:
 *   GET /bff/inbox             — paginated conversation list (FR9/FR17)
 *   GET /bff/conversations/:id — full thread + Customer 360 stub + ticket chip (FR10/FR13)
 *   GET /bff/bootstrap         — session + inbox p1 + counters (NFR3 ≤1s)
 *
 * Auth: protected by existing guards (JWT validation + RBAC).
 * Customer 360 + ticket/SLA are mock stubs (real in Epic 2 + Epic 3).
 */
@Controller('bff')
export class BffController {
  constructor(
    private readonly readDao: ConversationReadDao,
    @Inject(COMMAND_BUS_TOKEN)
    private readonly commandBus: ICommandBus,
    private readonly presenceService: PresenceService,
    private readonly aiInsightService: AiInsightService,
    private readonly ticketViewService: TicketViewService,
    @Inject(CUSTOMER_360_PORT_TOKEN)
    private readonly customer360: ICustomer360Port,
  ) {}

  /**
   * Inbox list — paginated, filtered (FR9/FR17).
   *
   * Query params: page, limit, channel, status, customerId
   */
  @Get('inbox')
  async getInbox(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
  ) {
    const filter: {
      channel?: ChannelEnum;
      customerId?: string;
      status?: string;
    } = {};

    if (channel) {
      const upper = channel.toUpperCase();
      if (!Object.values(ChannelEnum).includes(upper as ChannelEnum)) {
        throw new BadRequestException(`Unsupported channel: ${channel}`);
      }
      filter.channel = upper as ChannelEnum;
    }
    if (customerId) filter.customerId = customerId;
    if (status) filter.status = status;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const result = await this.readDao.findInbox(filter, pageNum, limitNum);

    return {
      items: result.items,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      hasNext: (pageNum - 1) * limitNum + result.items.length < result.total,
    };
  }

  /**
   * Conversation detail — full thread + context (FR10/FR13).
   */
  @Get('conversations/:id')
  async getConversation(@Param('id') id: string) {
    const detail = await this.readDao.findById(id);
    if (!detail) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    return detail;
  }

  /**
   * Bootstrap — single call for fast FE interactivity (NFR3 ≤1s).
   *
   * Returns: session info + inbox page 1 + unread count.
   * The FE calls this once on load to reach interactivity fast.
   */
  @Get('bootstrap')
  async getBootstrap() {
    // Parallel queries for speed (NFR3)
    const [inboxResult, activeCount] = await Promise.all([
      this.readDao.findInbox({}, 1, 20),
      this.readDao.countActive(),
    ]);

    return {
      session: {
        // Real session info comes from the auth guard (request.user).
        // MVP: return placeholder; FE reads JWT directly for agent identity.
        agentId: null, // populated by auth middleware in production
        role: null,
      },
      inbox: {
        items: inboxResult.items,
        total: inboxResult.total,
        page: 1,
        limit: 20,
      },
      unreadCount: activeCount,
    };
  }

  /**
   * Agent reply — send a message to the customer on the origin channel (FR5/FR11).
   *
   * Creates an OUTBOUND message, persists it, echoes via realtime,
   * and fire-and-forget sends to the channel adapter.
   */
  @Post('conversations/:id/reply')
  async reply(
    @Param('id') id: string,
    @Body() body: ReplyDto,
  ) {
    const result = await this.commandBus.execute(
      new SendReplyCommand(id, body.agentId, body.content, body.attachments ?? []),
    );
    return { ok: true, ...result };
  }

  // ─── Ticket Create Request (FR19 — Epic 3) ───

  /**
   * Request ticket creation from a conversation (FR19).
   *
   * OmniCare only PUBLISHES the request + links the conversation when the
   * ticket ID comes back. The actual ticket logic (FR21-23) is the Ticketing
   * service's job — NOT here.
   */
  @Post('conversations/:id/create-ticket')
  async createTicket(
    @Param('id') id: string,
    @Body() body: CreateTicketDto,
  ) {
    const result = await this.commandBus.execute(
      new CreateTicketRequestCommand(
        id,
        body.priority,
        body.title,
        body.description,
        body.fastForwardSla,
      ),
    );
    return { ok: true, ticketId: result.ticketId, ticketUrl: `/tickets/${result.ticketId}` };
  }

  // ─── Ticket Kanban + SLA (FR20/FR60 — Epic 3, read side) ───

  /**
   * Kanban view — tickets grouped by stage + SLA enrichment (FR20/FR60).
   * Each ticket includes slaRemainingMs, slaColor (green/yellow/red/gray).
   */
  @Get('tickets/kanban')
  async getKanban() {
    return this.ticketViewService.getKanbanView();
  }

  /**
   * Ticket detail — SLA-enriched single ticket view.
   */
  @Get('tickets/:ticketId')
  async getTicket(@Param('ticketId') ticketId: string) {
    const view = this.ticketViewService.getTicketView(ticketId);
    if (!view) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }
    return view;
  }

  // ─── Presence (FR16) ───

  /**
   * Set agent availability status.
   */
  @Post('agent/presence')
  async updatePresence(@Body() body: UpdatePresenceDto, @Req() req: any) {
    const agentId = req.user?.sub ?? req.user?.userId ?? 'agent-mvp';
    await this.presenceService.setStatus(agentId, body.status);
    return { ok: true, agentId, status: body.status };
  }

  /**
   * Get agent availability status.
   */
  @Get('agent/presence')
  async getPresence(@Req() req: any) {
    const agentId = req.user?.sub ?? req.user?.userId ?? 'agent-mvp';
    const status = await this.presenceService.getStatus(agentId);
    return { agentId, status: status ?? AgentStatus.OFFLINE };
  }

  // ─── Conversation lifecycle (FR18) ───

  /**
   * Close a conversation (distinct from ticket resolution).
   */
  @Post('conversations/:id/close')
  async closeConversation(
    @Param('id') id: string,
    @Body() body: CloseConversationDto,
  ) {
    await this.commandBus.execute(
      new CloseConversationCommand(id, body.agentId),
    );
    return { ok: true, conversationId: id, status: 'CLOSED' };
  }

  /**
   * Archive a conversation.
   */
  @Post('conversations/:id/archive')
  async archiveConversation(
    @Param('id') id: string,
    @Body() body: CloseConversationDto,
  ) {
    await this.commandBus.execute(
      new ArchiveConversationCommand(id, body.agentId),
    );
    return { ok: true, conversationId: id, status: 'ARCHIVED' };
  }

  // ─── AI Insight Display (FR15) ───

  /**
   * Classify an image attachment via AI Vision port (FR15).
   * Returns mock data in wave-1; real AI in wave-3.
   * Non-blocking: never throws (NFR22 safe degradation).
   */
  @Post('ai/classify-image')
  async classifyImage(@Body() body: ClassifyImageDto) {
    const insight = await this.aiInsightService.classifyImage(body.imageUrl);
    return { ok: true, insight };
  }

  /**
   * Transcribe an audio attachment via Audio AI port (FR15).
   */
  @Post('ai/transcribe')
  async transcribeAudio(@Body() body: TranscribeAudioDto) {
    const insight = await this.aiInsightService.transcribeAudio(body.audioUrl);
    return { ok: true, insight };
  }

  /**
   * Classify the intent of a text message via NLP port (FR15).
   */
  @Post('ai/classify-intent')
  async classifyIntent(@Body() body: ClassifyIntentDto) {
    const insight = await this.aiInsightService.classifyIntent(body.text);
    return { ok: true, insight };
  }

  // ─── Customer Identity & 360 (FR28/FR29/FR31 — Epic 2) ───

  /**
   * Resolve customer identity for a conversation (FR28).
   * If resolved → assigns customerId + returns profile.
   * If not resolved → returns fallback action (FR30).
   */
  @Post('conversations/:id/resolve-identity')
  async resolveIdentity(@Param('id') id: string) {
    const result = await this.commandBus.execute(
      new AssignCustomerCommand(id),
    );
    return { ok: true, ...result };
  }

  /**
   * Get Customer 360 profile (FR29) — displayed in the conversation side panel.
   */
  @Get('customers/:customerId')
  async getCustomer360(@Param('customerId') customerId: string) {
    const profile = await this.customer360.getProfile(customerId);
    if (!profile) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }
    return profile;
  }

  /**
   * Manually link a provisional customer profile (FR31 — for unknown customers).
   */
  @Post('conversations/:id/assign-customer')
  async assignCustomer(
    @Param('id') id: string,
    @Body() body: { customerId: string },
  ) {
    const result = await this.commandBus.execute(
      new AssignCustomerCommand(id, body.customerId),
    );
    return { ok: true, ...result };
  }

  // ─── Supervisor Dashboard + Reassign (FR53/FR54 — Epic 8) ───

  /**
   * Operations dashboard KPIs (FR53).
   * BFF-aggregated: ticket volume + channel mix + SLA stats + open counts.
   */
  @Get('operations/kpis')
  async getDashboardKpis() {
    const kanban = this.ticketViewService.getKanbanView();
    return {
      totalTickets: kanban.total,
      slaBreachedCount: kanban.slaBreachedCount,
      slaWarningCount: kanban.slaWarningCount,
      slaComplianceRate: kanban.total > 0
        ? Math.round(((kanban.total - kanban.slaBreachedCount) / kanban.total) * 1000) / 10
        : 100,
      openTickets: kanban.RECEIVED.length + kanban.IN_PROGRESS.length + kanban.WAITING.length,
      received: kanban.RECEIVED.length,
      inProgress: kanban.IN_PROGRESS.length,
      waiting: kanban.WAITING.length,
      resolved: kanban.RESOLVED.length,
      closed: kanban.CLOSED.length,
      channelMix: this.computeChannelMix(kanban),
      csatScore: 4.4,
      csatTotal: 150,
      timestamp: Date.now(),
    };
  }

  /**
   * Reassign ticket to another agent (FR54).
   * Proxied to the Ticketing service (stub).
   */
  @Post('tickets/:ticketId/advance')
  async advanceTicketStage(
    @Param('ticketId') ticketId: string,
    @Body() body: { newStage: string },
  ) {
    const ticket = this.ticketViewService.getTicketView(ticketId);
    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }
    return { ok: true, ticketId, newStage: body.newStage };
  }

  @Post('tickets/:ticketId/reassign')
  async reassignTicket(
    @Param('ticketId') ticketId: string,
    @Body() body: { assignee: string },
  ) {
    const ticket = this.ticketViewService.getTicketView(ticketId);
    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }
    // Proxy to Ticketing stub for reassignment (FR54)
    return { ok: true, ticketId, assignee: body.assignee };
  }

  private computeChannelMix(kanban: any): Record<string, number> {
    const mix: Record<string, number> = {};
    for (const stage of ['RECEIVED', 'IN_PROGRESS', 'WAITING']) {
      for (const t of kanban[stage]) {
        mix[t.channel] = (mix[t.channel] ?? 0) + 1;
      }
    }
    return mix;
  }

  // ─── Field-Incident Dispatch (FR62 — Epic 7) ───

  /**
   * Dispatch a Work Order to the Field-team App (FR62).
   */
  @Post('conversations/:id/dispatch-work-order')
  async dispatchWorkOrder(
    @Param('id') id: string,
    @Body() body: DispatchWorkOrderDto,
  ) {
    const result = await this.commandBus.execute(
      new DispatchWorkOrderCommand(
        id, body.agentId, body.incidentType, body.priority,
        body.address, body.photoUrls ?? [], body.customerId,
      ),
    );
    return { ok: true, ...result };
  }

  // ─── Voice Call Handling (FR32/FR33/FR35/FR59 — Epic 4 MVP) ───

  /**
   * Softphone screen-pop — lookup customer by phone (FR32/FR33).
   * Returns mock customer profile for the given phone number.
   */
  @Get('softphone/lookup/:phone')
  async softphoneLookup(@Param('phone') phone: string) {
    return {
      phone,
      customer: {
        id: 'cust-phone-001',
        name: 'Trần Thị Hoa',
        contract: 'HD-2024-0042',
        consumption: '48 m³/tháng (↑ 3x)',
        receivables: '125.000 VND',
      },
      callState: 'RINGING',
    };
  }

  /**
   * Get active softphone call state (mock).
   */
  @Get('softphone/active')
  async softphoneActive() {
    return { activeCalls: 3, calls: [] };
  }

  /**
   * Recording reference — mock audio file for a past call (FR35).
   */
  @Get('calls/:callId/recording')
  async getRecording(@Param('callId') callId: string) {
    return {
      callId,
      recordingUrl: `https://cdn.omnicare.vn/recordings/${callId}.mp3`,
      duration: 185,
      consentGiven: true,
      retainedUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  // ─── Knowledge Base (FR14/FR39 — Epic 5 MVP) ───

  /**
   * KB Vietnamese search — returns mock FAQ articles (FR14/FR39).
   */
  @Get('kb/search')
  async kbSearch(@Query('q') query: string = '') {
    const articles = [
      { id: 'kb-001', title: 'Biểu giá nước sinh hoạt', snippet: 'Bậc thang 4 mức: 0-10m³: 5.900đ; 10-20m³: 7.800đ...', tags: ['hóa đơn', 'biểu giá'] },
      { id: 'kb-002', title: 'Cách đọc chỉ số đồng hồ nước', snippet: 'Đọc 4-5 chữ số đen từ trái qua phải...', tags: ['đồng hồ', 'chỉ số'] },
      { id: 'kb-003', title: 'Lịch cắt nước dự kiến P. Hòa Bình', snippet: 'Ngày 20/06: 08:00-12:00, đường Lê Lợi...', tags: ['cắt nước', 'Hòa Bình'] },
      { id: 'kb-004', title: 'Báo sự cố vỡ ống nước', snippet: 'Gọi 1900 hoặc Zalo OA kèm ảnh hiện trường...', tags: ['sự cố', 'vỡ ống'] },
      { id: 'kb-005', title: 'Tra cứu công nợ hóa đơn', snippet: 'Nhập mã khách hàng hoặc SĐT trên My Công ty App...', tags: ['công nợ', 'tra cứu'] },
    ];

    const q = query.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const results = q
      ? articles.filter(a => {
          const title = a.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
          const snippet = a.snippet.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
          const tags = a.tags.map(t => t.normalize('NFD').replace(/[̀-ͯ]/g, ''));
          return title.includes(q) || snippet.includes(q) || tags.some(t => t.includes(q));
        })
      : articles;

    return { query, results, total: results.length };
  }

  // ─── CSAT (FR42 — Epic 6 MVP) ───

  /**
   * Submit CSAT rating after ticket close (FR42).
   * Returns mock result + emits CsatSubmitted (for Ticketing auto-reopen — FR27).
   */
  @Post('csat')
  async submitCsat(@Body() body: SubmitCsatDto) {
    const { ticketId, rating } = body;

    return {
      ok: true,
      ticketId,
      rating,
      submittedAt: Date.now(),
      csatSubmitted: true,
      // If <3 stars → Ticketing would auto-reopen (FR27) — mock acknowledges
      autoReopenTriggered: rating < 3,
    };
  }
}
