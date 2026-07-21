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
  ConflictException,
} from '@nestjs/common';
import {
  cskhCatalogs,
  cskhTickets,
  cskhIncidents,
  cskhCsat,
  cskhKnowledge,
  cskhBot,
  cskhBroadcasts,
  cskhDash,
  type Ticket,
  type TicketListDto,
  type Incident,
  type Broadcast,
  type BotData,
} from './cskh-fixture';

/**
 * CSKH BFF Controller — hợp đồng FE agent desktop (`water-business-cskh-fe`).
 *
 * Prefix `/api/cskh` — 19 endpoints match FE cũ contract (mock-port verbatim từ
 * `cskh-fixture.ts`). Đa kênh (5 channels: hotline/zalo/app/web/facebook).
 *
 * Envelope R0: success → `{success,data,error:null}`; error → `{success:false,
 * error:{code,detail}}`. Mã lỗi match FE: NOT_FOUND (404), INVALID_STATUS (400),
 * INVALID_KIND (400), INVALID_TRANSITION (409).
 *
 * Sau này thay fixture bằng real backing (conversation ingest → Ticket, ...).
 */
@Controller('api/cskh')
export class CskhController {
  // ── Health (Phase 0 contract verify) ────────────────────────────────────────
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async health(): Promise<{ status: string; service: string; timestamp: string }> {
    return { status: 'ok', service: 'cskh-bff', timestamp: new Date().toISOString() };
  }

  // ── Catalogs ──────────────────────────────────────────────────────────────────
  @Get('catalogs')
  async catalogs() {
    return cskhCatalogs;
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  @Get('dashboard')
  async dashboard() {
    return cskhDash;
  }

  // ── Tickets ───────────────────────────────────────────────────────────────────
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
    const total = items.length;
    const paged = items.slice((p - 1) * ps, p * ps);
    return { items: paged, total, page: p, pageSize: ps };
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
    return t;
  }

  // ── Incidents ─────────────────────────────────────────────────────────────────
  @Get('incidents')
  async listIncidents() {
    return cskhIncidents;
  }

  @Post('incidents/:id/triage')
  @HttpCode(HttpStatus.OK)
  async triageIncident(@Param('id') id: string): Promise<Incident> {
    const inc = cskhIncidents.find((i) => i.id === id);
    if (!inc) throw new NotFoundException('Không tìm thấy sự cố.');
    if (inc.status !== 'new') {
      throw new ConflictException({ code: 'INVALID_TRANSITION', message: 'Trạng thái không hợp lệ để phân loại.' });
    }
    inc.status = 'triaged';
    return inc;
  }

  @Post('incidents/:id/kind')
  @HttpCode(HttpStatus.OK)
  async setIncidentKind(@Param('id') id: string, @Body() body: { kind: string }): Promise<Incident> {
    if (!VALID_KINDS.has(body.kind.toLowerCase())) {
      throw new BadRequestException({ code: 'INVALID_KIND', message: 'Loại sự cố không hợp lệ.' });
    }
    const inc = cskhIncidents.find((i) => i.id === id);
    if (!inc) throw new NotFoundException('Không tìm thấy sự cố.');
    inc.kind = body.kind.toLowerCase();
    return inc;
  }

  @Post('incidents/:id/dispatch')
  @HttpCode(HttpStatus.OK)
  async dispatchIncident(@Param('id') id: string): Promise<Incident> {
    const inc = cskhIncidents.find((i) => i.id === id);
    if (!inc) throw new NotFoundException('Không tìm thấy sự cố.');
    if (inc.status !== 'triaged') {
      throw new ConflictException({ code: 'INVALID_TRANSITION', message: 'Trạng thái không hợp lệ để điều phối.' });
    }
    inc.status = 'dispatched';
    return inc;
  }

  // ── CSAT / Knowledge / Chatbot ────────────────────────────────────────────────
  @Get('csat')
  async csat() {
    return cskhCsat;
  }

  @Get('knowledge')
  async knowledge() {
    return cskhKnowledge;
  }

  @Get('chatbot')
  async chatbot(): Promise<BotData> {
    return cskhBot;
  }

  @Post('chatbot/toggle')
  @HttpCode(HttpStatus.OK)
  async toggleChatbot(@Body() body: { enabled: boolean }): Promise<BotData> {
    cskhBot.enabled = body.enabled;
    return cskhBot;
  }

  // ── Broadcasts ────────────────────────────────────────────────────────────────
  @Get('broadcasts')
  async listBroadcasts() {
    return cskhBroadcasts;
  }

  @Post('broadcasts')
  @HttpCode(HttpStatus.OK)
  async createBroadcast(
    @Body() body: { title: string; channels: string[]; area: string; window: string },
  ): Promise<Broadcast> {
    const newBc: Broadcast = {
      id: `bc${Date.now()}`,
      title: body.title,
      status: 'draft',
      channels: body.channels,
      area: body.area,
      window: body.window,
      audience: 0,
      sent: 0,
      opened: 0,
      scheduled: '—',
    };
    cskhBroadcasts.push(newBc);
    return newBc;
  }

  @Post('broadcasts/:id/send')
  @HttpCode(HttpStatus.OK)
  async sendBroadcast(@Param('id') id: string): Promise<Broadcast> {
    const bc = cskhBroadcasts.find((b) => b.id === id);
    if (!bc) throw new NotFoundException('Không tìm thấy broadcast.');
    bc.status = 'sending';
    return bc;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const VALID_STATUSES = new Set(['new', 'progress', 'waiting', 'resolved', 'closed']);
const VALID_KINDS = new Set(['vo_ong', 'ro_ri', 'nuoc_duc', 'mat_nuoc', 'yeu_ap', 'dong_ho']);

function nowTime(): string {
  return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
