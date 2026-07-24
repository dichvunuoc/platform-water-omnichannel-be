/**
 * CSKH Aggregation Ports — LEAN port-adapter (KHÔNG DDD) cho BFF layer.
 *
 * Mỗi port = 1 domain service mà omichannel_be aggregate (incident, telephony,
 * csat, knowledge, chatbot, broadcast, dashboard). Mock default (đọc cskh-fixture)
 * → real adapter (gRPC/HTTP) khi service sẵn sàng (swap qua config, giữ nguyên
 * controller). Messaging core DDD giữ nguyên; aggregation layer lean.
 *
 * Pattern: clone ICustomer360Port / INotificationPort (đã làm).
 */
import type {
  Incident,
  Broadcast,
  BotData,
  CsatAggregate,
  KnowledgeBase,
  DashboardData,
  CallSummary,
  ActiveCall,
  CallLogEntry,
  CallerProfile,
  CallRecording,
} from '../../infrastructure/http/cskh-fixture';

// ─── Incident (sự cố hiện trường → incident-service) ──────────────────────────
export interface IIncidentPort {
  list(): Incident[];
  triage(id: string): Incident;
  setKind(id: string, kind: string): Incident;
  dispatch(id: string): Incident;
}

// ─── Telephony (tổng đài 1900 → telephony/PBX service) ───────────────────────
export interface ITelephonyPort {
  queue(): CallSummary[];
  activeCall(): ActiveCall | null;
  log(): CallLogEntry[];
  lookupPhone(phone: string): CallerProfile | null;
  recording(callId: string): CallRecording | null;
}

// ─── CSAT (khảo sát hài lòng → csat service) ──────────────────────────────────
export interface ICsatPort {
  aggregate(): CsatAggregate;
  submit(input: {
    ticketId: string;
    score: number;
    ch: string;
    agent: string;
    topic: string;
    text?: string;
  }): { ok: true; reopened: boolean };
}

// ─── Knowledge (tri thức & kịch bản → kb service) ─────────────────────────────
export interface IKnowledgePort {
  list(): KnowledgeBase;
}

// ─── Chatbot (Zalo OA → chatbot service) ──────────────────────────────────────
export interface IChatbotPort {
  stats(): BotData;
  toggle(enabled: boolean): BotData;
}

// ─── Broadcast (thông báo chủ động → broadcast service) ───────────────────────
export interface IBroadcastPort {
  list(): Broadcast[];
  create(input: { title: string; channels: string[]; area: string; window: string }): Broadcast;
  send(id: string): Broadcast;
}

// ─── Dashboard (điều hành CSKH → aggregate metrics) ───────────────────────────
export interface IDashboardPort {
  get(): DashboardData;
}
