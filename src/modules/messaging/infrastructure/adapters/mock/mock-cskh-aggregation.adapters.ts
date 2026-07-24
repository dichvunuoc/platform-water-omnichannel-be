/**
 * 7 Mock aggregation adapters — đọc/mutate cskh-fixture (FE mock-port verbatim).
 * Mỗi adapter implement 1 port (IIncidentPort, ITelephonyPort, …). Throw NestJS
 * HTTP exceptions để GlobalExceptionFilter map → envelope error (giữ behavior
 * cũ của CskhController). Khi service thật → thêm RealAdapter (gRPC/HTTP), swap.
 */
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import {
  cskhIncidents,
  cskhTelephony,
  cskhCsat,
  cskhKnowledge,
  cskhBot,
  cskhBroadcasts,
  cskhDash,
  cskhTickets,
  type Incident,
  type Broadcast,
  type BotData,
  type CallSummary,
  type ActiveCall,
  type CallLogEntry,
  type CallerProfile,
  type CallRecording,
} from '../../http/cskh-fixture';
import type {
  IIncidentPort,
  ITelephonyPort,
  ICsatPort,
  IKnowledgePort,
  IChatbotPort,
  IBroadcastPort,
  IDashboardPort,
} from '../../../domain/ports/cskh-aggregation.ports';

const VALID_KINDS = new Set(['vo_ong', 'ro_ri', 'nuoc_duc', 'mat_nuoc', 'yeu_ap', 'dong_ho']);

// ─── Incident ──────────────────────────────────────────────────────────────────
@Injectable()
export class MockIncidentAdapter implements IIncidentPort {
  list(): Incident[] {
    return cskhIncidents;
  }
  triage(id: string): Incident {
    const inc = cskhIncidents.find((i) => i.id === id);
    if (!inc) throw new NotFoundException('Không tìm thấy sự cố.');
    if (inc.status !== 'new') {
      throw new ConflictException({ code: 'INVALID_TRANSITION', message: 'Trạng thái không hợp lệ để phân loại.' });
    }
    inc.status = 'triaged';
    return inc;
  }
  setKind(id: string, kind: string): Incident {
    if (!VALID_KINDS.has(kind.toLowerCase())) {
      throw new BadRequestException({ code: 'INVALID_KIND', message: 'Loại sự cố không hợp lệ.' });
    }
    const inc = cskhIncidents.find((i) => i.id === id);
    if (!inc) throw new NotFoundException('Không tìm thấy sự cố.');
    inc.kind = kind.toLowerCase();
    return inc;
  }
  dispatch(id: string): Incident {
    const inc = cskhIncidents.find((i) => i.id === id);
    if (!inc) throw new NotFoundException('Không tìm thấy sự cố.');
    if (inc.status !== 'triaged') {
      throw new ConflictException({ code: 'INVALID_TRANSITION', message: 'Trạng thái không hợp lệ để điều phối.' });
    }
    inc.status = 'dispatched';
    return inc;
  }
}

// ─── Telephony (softphone) ────────────────────────────────────────────────────
@Injectable()
export class MockTelephonyAdapter implements ITelephonyPort {
  queue(): CallSummary[] {
    return cskhTelephony.queue;
  }
  activeCall(): ActiveCall | null {
    return cskhTelephony.activeCall;
  }
  log(): CallLogEntry[] {
    return cskhTelephony.log;
  }
  lookupPhone(phone: string): CallerProfile | null {
    // Derive từ tickets fixture (match phone) — demo screen-pop.
    const t = cskhTickets.find((x) => x.phone.replace(/\s/g, '') === phone.replace(/\s/g, ''));
    if (!t) return null;
    return {
      phone: t.phone,
      name: t.name,
      maHb: t.maHb,
      custType: t.custType,
      addr: `${t.addr}, ${t.phuong}`,
      status: 'Đang dùng nước',
    };
  }
  recording(callId: string): CallRecording | null {
    return cskhTelephony.recordings.find((r) => r.callId === callId) ?? null;
  }
}

// ─── CSAT ─────────────────────────────────────────────────────────────────────
@Injectable()
export class MockCsatAdapter implements ICsatPort {
  aggregate() {
    return cskhCsat;
  }
  submit(input: { score: number }): { ok: true; reopened: boolean } {
    // FR27: score < 3 → reopen trigger
    return { ok: true, reopened: input.score < 3 };
  }
}

// ─── Knowledge ────────────────────────────────────────────────────────────────
@Injectable()
export class MockKnowledgeAdapter implements IKnowledgePort {
  list() {
    return cskhKnowledge;
  }
}

// ─── Chatbot ──────────────────────────────────────────────────────────────────
@Injectable()
export class MockChatbotAdapter implements IChatbotPort {
  stats(): BotData {
    return cskhBot;
  }
  toggle(enabled: boolean): BotData {
    cskhBot.enabled = enabled;
    return cskhBot;
  }
}

// ─── Broadcast ────────────────────────────────────────────────────────────────
@Injectable()
export class MockBroadcastAdapter implements IBroadcastPort {
  list(): Broadcast[] {
    return cskhBroadcasts;
  }
  create(input: { title: string; channels: string[]; area: string; window: string }): Broadcast {
    const newBc: Broadcast = {
      id: `bc${Date.now()}`,
      title: input.title,
      status: 'draft',
      channels: input.channels,
      area: input.area,
      window: input.window,
      audience: 0,
      sent: 0,
      opened: 0,
      scheduled: '—',
    };
    cskhBroadcasts.push(newBc);
    return newBc;
  }
  send(id: string): Broadcast {
    const bc = cskhBroadcasts.find((b) => b.id === id);
    if (!bc) throw new NotFoundException('Không tìm thấy broadcast.');
    bc.status = 'sending';
    return bc;
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
@Injectable()
export class MockDashboardAdapter implements IDashboardPort {
  get() {
    return cskhDash;
  }
}
