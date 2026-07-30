import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { NOTIFICATION_PORT_TOKEN } from '../notification/notification.tokens';
import type { INotificationPort, NotificationSendRequest } from '../notification/notification.port';
import { INCIDENT_PORT_TOKEN, type IIncidentPort } from '../incident/incident.adapter';
import { TELEPHONY_PORT_TOKEN, type ITelephonyPort } from '../telephony/telephony.adapter';
import { CSAT_PORT_TOKEN, type ICsatPort } from '../csat/csat.adapter';
import { KNOWLEDGE_PORT_TOKEN, type IKnowledgePort } from '../knowledge/knowledge.adapter';
import { CHATBOT_PORT_TOKEN, type IChatbotPort } from '../chatbot/chatbot.adapter';
import { BROADCAST_PORT_TOKEN, type IBroadcastPort } from '../broadcast/broadcast.adapter';
import { DASHBOARD_PORT_TOKEN, type IDashboardPort } from '../dashboard/dashboard.adapter';
import {
  cskhCatalogs,
  cskhTickets,
  type Ticket,
  type TicketListDto,
} from './cskh-fixture';
import { CONVERSATION_READ_DAO_TOKEN } from '../messaging/constants/tokens';
import type { ConversationReadDao, ConversationDetail } from '../messaging/infrastructure/persistence/read/conversation-read-dao';
import type { ICommandBus } from 'src/libs/core/application';
import { COMMAND_BUS_TOKEN } from 'src/libs/core/constants';
import { SendReplyCommand } from '../messaging/application/commands/send-reply.command';
import { CUSTOMER_360_PORT_TOKEN } from '../customer-360/customer-360.tokens';
import type { ICustomer360Port } from '../customer-360/customer-360.port';
import {
  mapInboxItem,
  mapConversationDetail,
  type InboxPageDto,
  type ConversationDetailDto,
} from './cskh.dto';

/**
 * CSKH BFF Controller — hợp đồng FE agent desktop (`water-business-cskh-fe`).
 *
 * Prefix `/api/cskh`. Aggregation LEAN: 7 domain qua port-adapter (incident,
 * telephony, csat, knowledge, chatbot, broadcast, dashboard) — Mock default, swap
 * RealAdapter khi service sẵn. Ticket + catalogs giữ direct (core/config, không
 * phải service aggregation). Notification (gRPC) fire-and-forget trên 3 trigger.
 *
 * Envelope R0 + error codes (NOT_FOUND, INVALID_STATUS, INVALID_KIND, INVALID_TRANSITION).
 */
@Controller('api/cskh')
export class CskhController {
  private readonly logger = new Logger(CskhController.name);

  constructor(
    @Inject(NOTIFICATION_PORT_TOKEN) private readonly notifications: INotificationPort,
    @Inject(INCIDENT_PORT_TOKEN) private readonly incidents: IIncidentPort,
    @Inject(TELEPHONY_PORT_TOKEN) private readonly telephony: ITelephonyPort,
    @Inject(CSAT_PORT_TOKEN) private readonly csatPort: ICsatPort,
    @Inject(KNOWLEDGE_PORT_TOKEN) private readonly knowledgePort: IKnowledgePort,
    @Inject(CHATBOT_PORT_TOKEN) private readonly chatbotPort: IChatbotPort,
    @Inject(BROADCAST_PORT_TOKEN) private readonly broadcastPort: IBroadcastPort,
    @Inject(DASHBOARD_PORT_TOKEN) private readonly dashboardPort: IDashboardPort,
    @Inject(CONVERSATION_READ_DAO_TOKEN) private readonly readDao: ConversationReadDao,
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
    @Inject(CUSTOMER_360_PORT_TOKEN) private readonly customer360: ICustomer360Port,
  ) {}

  /** Fire-and-forget notification — không block nghiệp vụ khi noti fail. */
  private fireNoti(req: NotificationSendRequest): void {
    this.notifications
      .send(req)
      .catch((e) =>
        this.logger.warn(`noti templateKey=${req.templateKey} failed: ${e.message}`),
      );
  }

  // ── Inbox (BRIDGE Task B4: real conversations từ DB qua ConversationReadDao) ──
  @Get('inbox')
  async inbox(
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ): Promise<InboxPageDto> {
    const filter: { channel?: string; status?: string; customerId?: string } = {};
    if (channel) filter.channel = channel.toUpperCase();
    if (status) filter.status = status.toUpperCase();
    if (customerId) filter.customerId = customerId;
    const p = Number(page);
    const l = Number(limit);
    const result = await this.readDao.findInbox(filter as any, p, l);
    return {
      items: result.items.map(mapInboxItem),
      total: result.total,
      page: p,
      limit: l,
      hasNext: (p - 1) * l + result.items.length < result.total,
    };
  }

  @Get('conversations/:id')
  async conversation(@Param('id') id: string): Promise<ConversationDetailDto> {
    const detail = await this.readDao.findById(id);
    if (!detail) throw new NotFoundException(`Không tìm thấy hội thoại ${id}`);
    return this.enrichedDetail(detail);
  }

  /** POST /conversations/:id/reply (Task B8) — agent reply qua SendReplyCommand + re-fetch detail. */
  @Post('conversations/:id/reply')
  @HttpCode(HttpStatus.OK)
  async replyConversation(
    @Param('id') id: string,
    @Body() body: { agentId?: string; content: string },
  ): Promise<ConversationDetailDto> {
    await this.commandBus.execute(
      new SendReplyCommand(id, body.agentId ?? 'agent-mvp', body.content, []),
    );
    const detail = await this.readDao.findById(id);
    if (!detail) throw new NotFoundException(`Không tìm thấy hội thoại ${id}`);
    return this.enrichedDetail(detail);
  }

  /** Map detail + enrich Customer360 (Task B7) qua ICustomer360Port; fallback stub khi chưa resolve. */
  private async enrichedDetail(detail: ConversationDetail): Promise<ConversationDetailDto> {
    const dto = mapConversationDetail(detail);
    const profile =
      (await this.customer360
        .resolveIdentity(detail.channel, detail.customerChannelId)
        .catch(() => null)) ??
      (detail.customerId
        ? await this.customer360.getProfile(detail.customerId).catch(() => null)
        : null);
    if (profile) {
      dto.customer = { id: profile.id, name: profile.name };
      dto.customer360 = {
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        address: profile.address,
        custType: profile.customerType,
        contract: profile.contract,
      };
    }
    return dto;
  }

  // ── Health ────────────────────────────────────────────────────────────────────
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async health(): Promise<{ status: string; service: string; timestamp: string }> {
    return { status: 'ok', service: 'cskh-bff', timestamp: new Date().toISOString() };
  }

  // ── Catalogs (reference data, direct) ─────────────────────────────────────────
  @Get('catalogs')
  async catalogs() {
    return cskhCatalogs;
  }

  // ── Dashboard (→ IDashboardPort) ──────────────────────────────────────────────
  @Get('dashboard')
  async dashboard() {
    return await this.dashboardPort.get();
  }

  // ── Tickets (core — direct fixture; ticketing-stub backing sau) ───────────────
  @Get('tickets')
  async listTickets(
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('topic') topic?: string,
    @Query('priority') priority?: string,
    @Query('q') q?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
  ): Promise<TicketListDto> {
    let items = cskhTickets.slice();
    if (status) items = items.filter((t) => t.status.toLowerCase() === status!.toLowerCase());
    if (channel) items = items.filter((t) => t.channel.toLowerCase() === channel!.toLowerCase());
    if (topic) items = items.filter((t) => t.topic.toLowerCase() === topic!.toLowerCase());
    if (priority) items = items.filter((t) => t.priority.toLowerCase() === priority!.toLowerCase());
    if (q) {
      const ql = q.toLowerCase();
      items = items.filter(
        (t) =>
          t.name.toLowerCase().includes(ql) ||
          t.code.toLowerCase().includes(ql) ||
          t.maHb.toLowerCase().includes(ql) ||
          t.preview.toLowerCase().includes(ql),
      );
    }
    const p = Number(page);
    const ps = Number(pageSize);
    return { items: items.slice((p - 1) * ps, p * ps), total: items.length, page: p, pageSize: ps };
  }

  @Get('tickets/:id')
  async getTicket(@Param('id') id: string): Promise<Ticket> {
    const t = cskhTickets.find((x) => x.id === id);
    if (!t) throw new NotFoundException('Không tìm thấy phiếu.');
    return t;
  }

  @Post('tickets/:id/reply')
  @HttpCode(HttpStatus.OK)
  async reply(@Param('id') id: string, @Body() body: { text: string }): Promise<Ticket> {
    const t = cskhTickets.find((x) => x.id === id);
    if (!t) throw new NotFoundException('Không tìm thấy phiếu.');
    t.messages.push({ from: 'agent', text: body.text, time: nowTime() });
    return t;
  }

  @Post('tickets/:id/assign')
  @HttpCode(HttpStatus.OK)
  async assign(@Param('id') id: string, @Body() body: { agent: string }): Promise<Ticket> {
    const t = cskhTickets.find((x) => x.id === id);
    if (!t) throw new NotFoundException('Không tìm thấy phiếu.');
    t.agent = body.agent;
    return t;
  }

  @Post('tickets/:id/status')
  @HttpCode(HttpStatus.OK)
  async setStatus(@Param('id') id: string, @Body() body: { status: string }): Promise<Ticket> {
    if (!VALID_STATUSES.has(body.status.toLowerCase())) {
      throw new BadRequestException({ code: 'INVALID_STATUS', message: 'Trạng thái không hợp lệ.' });
    }
    const t = cskhTickets.find((x) => x.id === id);
    if (!t) throw new NotFoundException('Không tìm thấy phiếu.');
    t.status = body.status.toLowerCase();
    return t;
  }

  @Post('tickets/:id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolve(@Param('id') id: string): Promise<Ticket> {
    const t = cskhTickets.find((x) => x.id === id);
    if (!t) throw new NotFoundException('Không tìm thấy phiếu.');
    t.status = 'resolved';
    t.slaLeftH = null;
    this.fireNoti({
      templateKey: 'cskh.csat_request',
      recipients: [{ phone: t.phone }],
      data: { ticketCode: t.code, customerName: t.name },
      idempotencyKey: `cskh.csat:${t.id}`,
    });
    return t;
  }

  // ── Incidents (→ IIncidentPort) ───────────────────────────────────────────────
  @Get('incidents')
  async listIncidents() {
    return this.incidents.list();
  }

  @Post('incidents/:id/triage')
  @HttpCode(HttpStatus.OK)
  async triageIncident(@Param('id') id: string) {
    return this.incidents.triage(id);
  }

  @Post('incidents/:id/kind')
  @HttpCode(HttpStatus.OK)
  async setIncidentKind(@Param('id') id: string, @Body() body: { kind: string }) {
    return this.incidents.setKind(id, body.kind);
  }

  @Post('incidents/:id/dispatch')
  @HttpCode(HttpStatus.OK)
  async dispatchIncident(@Param('id') id: string) {
    const inc = this.incidents.dispatch(id);
    this.fireNoti({
      templateKey: 'cskh.incident.dispatched',
      recipients: [{ phone: inc.phone }],
      data: { incidentCode: inc.code, address: inc.addr, crewEta: 45 },
      idempotencyKey: `cskh.incident.dispatch:${inc.id}`,
    });
    return inc;
  }

  // ── Telephony / Softphone (→ ITelephonyPort) — NEW ───────────────────────────
  @Get('softphone/queue')
  async softphoneQueue() {
    return this.telephony.queue();
  }

  @Get('softphone/active')
  async softphoneActive() {
    return this.telephony.activeCall();
  }

  @Get('softphone/log')
  async softphoneLog() {
    return this.telephony.log();
  }

  @Get('softphone/lookup/:phone')
  async softphoneLookup(@Param('phone') phone: string) {
    const profile = this.telephony.lookupPhone(phone);
    if (!profile) throw new NotFoundException(`Không tìm thấy SĐT ${phone}`);
    return profile;
  }

  @Get('calls/:callId/recording')
  async callRecording(@Param('callId') callId: string) {
    const rec = this.telephony.recording(callId);
    if (!rec) throw new NotFoundException(`Không tìm thấy bản ghi ${callId}`);
    return rec;
  }

  // ── CSAT (→ ICsatPort) ────────────────────────────────────────────────────────
  @Get('csat')
  async csat() {
    return this.csatPort.aggregate();
  }

  // ── Knowledge (→ IKnowledgePort) ──────────────────────────────────────────────
  @Get('knowledge')
  async knowledge() {
    return this.knowledgePort.list();
  }

  // ── Chatbot (→ IChatbotPort) ──────────────────────────────────────────────────
  @Get('chatbot')
  async chatbot() {
    return this.chatbotPort.stats();
  }

  @Post('chatbot/toggle')
  @HttpCode(HttpStatus.OK)
  async toggleChatbot(@Body() body: { enabled: boolean }) {
    return this.chatbotPort.toggle(body.enabled);
  }

  // ── Broadcasts (→ IBroadcastPort) ─────────────────────────────────────────────
  @Get('broadcasts')
  async listBroadcasts() {
    return this.broadcastPort.list();
  }

  @Post('broadcasts')
  @HttpCode(HttpStatus.OK)
  async createBroadcast(
    @Body() body: { title: string; channels: string[]; area: string; window: string },
  ) {
    return this.broadcastPort.create(body);
  }

  @Post('broadcasts/:id/send')
  @HttpCode(HttpStatus.OK)
  async sendBroadcast(@Param('id') id: string) {
    const bc = this.broadcastPort.send(id);
    this.fireNoti({
      templateKey: 'cskh.broadcast',
      recipients: [{ phone: '0900000000' }],
      data: { title: bc.title, area: bc.area, window: bc.window, audience: bc.audience },
      idempotencyKey: `cskh.broadcast:${bc.id}`,
    });
    return bc;
  }
}

// ── Helpers (ticket core) ──────────────────────────────────────────────────────
const VALID_STATUSES = new Set(['new', 'progress', 'waiting', 'resolved', 'closed']);

function nowTime(): string {
  return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
