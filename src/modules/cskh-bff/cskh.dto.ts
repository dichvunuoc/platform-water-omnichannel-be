/**
 * CSKH BFF serialization layer — map Conversation read model (DAO) → FE-facing DTO.
 *
 * Bridge (Task B4): DB → ConversationReadDao → CskhController → mappers (here) → FE.
 * Map enum tại biên (ZALO→zalo, ACTIVE→active, CUSTOMER→cust), derive unread=0.
 * Detail enrich Customer360 qua ICustomer360Port (ở controller, fallback embedded stub).
 */
import type {
  InboxItem,
  ConversationDetail,
} from '../messaging/infrastructure/persistence/read/conversation-read-dao';
import type { Ticket as TicketAggregate } from '../ticketing/domain/entities/ticket.entity';
import type { Ticket as TicketDtoShape } from './cskh-fixture';
import type { CustomerProfile } from '../customer-360/customer-360.port';
import { SLA_POLICIES } from '../ticketing/domain/value-objects/ticket-priority.value-object';

// ─── FE-facing types ──────────────────────────────────────────────────────────
export type ChannelCode = 'zalo' | 'app' | 'facebook' | 'email' | 'voip' | 'hotline' | 'web';
export type ConvStatus = 'active' | 'closed' | 'archived';
export type MessageFrom = 'cust' | 'agent' | 'bot' | 'sys';

export interface MessageDto {
  id: string;
  from: MessageFrom;
  text: string;
  attachments: string[];
  time: string;
}

export interface Customer360Dto {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  custType?: string;
  contract?: string;
}

export interface ConversationListItemDto {
  id: string;
  channel: ChannelCode;
  status: ConvStatus;
  customer: { id: string | null; name: string };
  preview: string;
  lastMessageAt: string;
  unread: number;
}

export interface ConversationDetailDto extends ConversationListItemDto {
  messages: MessageDto[];
  customer360: Customer360Dto | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboxPageDto {
  items: ConversationListItemDto[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

// ─── Enum maps ────────────────────────────────────────────────────────────────
const CHANNEL_MAP: Record<string, ChannelCode> = {
  ZALO: 'zalo', APP: 'app', FACEBOOK: 'facebook', EMAIL: 'email', VOIP: 'voip',
};
const STATUS_MAP: Record<string, ConvStatus> = {
  ACTIVE: 'active', CLOSED: 'closed', ARCHIVED: 'archived',
};
const SENDER_MAP: Record<string, MessageFrom> = {
  CUSTOMER: 'cust', AGENT: 'agent', BOT: 'bot', SYSTEM: 'sys',
};

const mapChannel = (raw: string): ChannelCode => CHANNEL_MAP[raw] ?? 'app';
const mapStatus = (raw: string): ConvStatus => STATUS_MAP[raw] ?? 'active';
const toIso = (d: Date | string): string =>
  d instanceof Date ? d.toISOString() : String(d);

// ─── Mappers ──────────────────────────────────────────────────────────────────
type InternalMessage = ConversationDetail['messages'][number];

export function mapMessage(m: InternalMessage): MessageDto {
  return {
    id: m.id,
    from: SENDER_MAP[m.senderType] ?? 'sys',
    text: m.content,
    attachments: m.attachments ?? [],
    time: toIso(m.createdAt),
  };
}

export function mapInboxItem(item: InboxItem): ConversationListItemDto {
  return {
    id: item.id,
    channel: mapChannel(item.channel),
    status: mapStatus(item.status),
    customer: {
      id: item.customerId,
      // List level chưa join CustomerProfile — dùng customerChannelId làm placeholder.
      name: item.customerChannelId,
    },
    preview: item.lastMessage?.content ?? '',
    lastMessageAt: toIso(item.lastMessage?.createdAt ?? item.updatedAt),
    unread: 0,
  };
}

export function mapConversationDetail(detail: ConversationDetail): ConversationDetailDto {
  const last = detail.messages[detail.messages.length - 1];
  return {
    id: detail.id,
    channel: mapChannel(detail.channel),
    status: mapStatus(detail.status),
    customer: {
      id: detail.customerId,
      name: detail.customer360?.name ?? detail.customerChannelId,
    },
    preview: last?.content ?? '',
    lastMessageAt: toIso(last?.createdAt ?? detail.updatedAt),
    unread: 0,
    messages: detail.messages.map(mapMessage),
    customer360: detail.customer360
      ? {
          id: detail.customerId ?? detail.id,
          name: detail.customer360.name,
          address: detail.customer360.address ?? undefined,
          contract: detail.customer360.contract ?? undefined,
        }
      : null,
    createdAt: toIso(detail.createdAt),
    updatedAt: toIso(detail.updatedAt),
  };
}

// ─── Phase 2b: Ticket → TicketDto mapper + heuristic ─────────────────────────

const STAGE_MAP: Record<string, string> = {
  RECEIVED: 'new', IN_PROGRESS: 'progress', WAITING: 'waiting',
  RESOLVED: 'resolved', CLOSED: 'closed',
};
const PRIORITY_MAP: Record<string, string> = {
  P0: 'urgent', P1: 'high', P2: 'normal', P3: 'low',
};
const TICKET_CHANNEL_MAP: Record<string, string> = {
  ZALO: 'zalo', APP: 'app', FACEBOOK: 'facebook',
  EMAIL: 'web', VOIP: 'hotline', HOTLINE: 'hotline', WEB: 'web',
};

type TicketMsgFrom = 'cust' | 'agent' | 'bot' | 'sys';

/** Keyword-based heuristic classifier (bridge đến Phase 2c real AI). */
export function classifyHeuristic(text: string): {
  topic: string; sentiment: string; matched: boolean; confidence: number;
} {
  const t = (text || '').toLowerCase();
  if (/vỡ|bể|ống|rò rỉ|nước phun|lênh láng/.test(t))
    return { topic: 'suco', sentiment: 'neg', matched: true, confidence: 92 };
  if (/đục|mùi|màu|bẩn|chất lượng/.test(t))
    return { topic: 'chatluong', sentiment: 'neg', matched: true, confidence: 88 };
  if (/hoá đơn|hóa đơn|tiền|công nợ|thanh toán/.test(t))
    return { topic: 'hoadon', sentiment: 'neu', matched: true, confidence: 85 };
  if (/lắp|mới|đấu nối|tháo/.test(t))
    return { topic: 'daunoi', sentiment: 'neu', matched: true, confidence: 80 };
  if (/đổi|cập nhật|thông tin|địa chỉ/.test(t))
    return { topic: 'thongtin', sentiment: 'neu', matched: true, confidence: 75 };
  if (/cảm ơn|thank/.test(t))
    return { topic: 'gopy', sentiment: 'pos', matched: true, confidence: 70 };
  if (/bức xúc|khiếu nại|phàn nàn/.test(t))
    return { topic: 'gopy', sentiment: 'neg', matched: true, confidence: 78 };
  return { topic: 'gopy', sentiment: 'neu', matched: false, confidence: 0 };
}

function normalizeCustType(raw?: string | null): string {
  if (!raw) return 'sh';
  const lower = raw.toLowerCase();
  if (lower.includes('kinh doanh') || lower.includes('dịch vụ') || lower === 'kddv') return 'kddv';
  return 'sh';
}

function formatRelative(date: Date | string): string {
  const ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const diff = Date.now() - ms;
  if (diff < 60000) return 'vừa xong';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} phút`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ`;
  return `${Math.floor(diff / 86400000)} ngày`;
}

function mapTicketMessage(m: InternalMessage): {
  from: TicketMsgFrom; text: string; time: string; photo?: string;
} {
  const d = m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt);
  return {
    from: (SENDER_MAP[m.senderType] ?? 'sys') as TicketMsgFrom,
    text: m.content,
    time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    photo: m.attachments?.[0],
  };
}

/**
 * Map real Ticket aggregate → FE-facing TicketDto (25 fields, frozen FE contract).
 * Composes from: Ticket + Customer360 profile + Conversation messages.
 * AI fields via heuristic (Phase 2c sẽ thay bằng real AI persist).
 */
export function mapTicket(
  ticket: TicketAggregate,
  opts: {
    profile?: CustomerProfile | null;
    lastMessage?: { content: string; createdAt: Date | string } | null;
    conversation?: ConversationDetail | null;
    agentName?: string;
  } = {},
): TicketDtoShape {
  const now = Date.now();
  const created = ticket.createdAt instanceof Date ? ticket.createdAt : new Date(ticket.createdAt);
  const isResolved = ticket.stage.value === 'RESOLVED' || ticket.stage.value === 'CLOSED';
  const remainingMs = ticket.resolveRemainingMs;
  const slaTotalMs = SLA_POLICIES[ticket.priority.value]?.resolveMs ?? 24 * 3600000;
  const lastMsgContent = opts.conversation?.messages?.length
    ? opts.conversation.messages[opts.conversation.messages.length - 1].content
    : opts.lastMessage?.content ?? ticket.description ?? '';
  const heur = classifyHeuristic(lastMsgContent);

  return {
    id: ticket.id,
    code: ticket.id, // reuse SC-xxx (FE <Show> renders string)
    topic: heur.topic,
    channel: TICKET_CHANNEL_MAP[ticket.channel] ?? 'app',
    kind: null,
    priority: PRIORITY_MAP[ticket.priority.value] ?? 'normal',
    status: STAGE_MAP[ticket.stage.value] ?? 'new',
    sentiment: heur.sentiment,
    aiTag: heur.matched,
    aiConf: heur.confidence,
    name: opts.profile?.name ?? ticket.customerId ?? 'Khách',
    maHb: opts.profile?.contract ?? '',
    phone: opts.profile?.phone ?? '',
    addr: opts.profile?.address ?? '',
    phuong: '', // không có trong CustomerProfile
    custType: normalizeCustType(opts.profile?.customerType),
    preview: lastMsgContent.slice(0, 100),
    messages: opts.conversation?.messages?.map(mapTicketMessage) ?? [],
    agent: opts.agentName ?? '—',
    openedAt: created.getHours() + created.getMinutes() / 60,
    ageH: Math.round(((now - created.getTime()) / 3600000) * 10) / 10,
    slaLeftH: isResolved ? null : Math.round((remainingMs / 3600000) * 10) / 10,
    slaTotalH: Math.round((slaTotalMs / 3600000) * 10) / 10,
    unread: 0,
    msgTime: opts.lastMessage?.createdAt
      ? formatRelative(opts.lastMessage.createdAt)
      : '—',
  };
}
