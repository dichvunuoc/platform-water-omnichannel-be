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
