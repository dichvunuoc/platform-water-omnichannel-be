import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { eq, and, desc, sql, type SQL } from 'drizzle-orm';
import {
  BaseReadDao,
  DATABASE_READ_TOKEN,
  type DrizzleDB,
} from 'src/libs/shared';
import type { ICacheService } from 'src/libs/core/infrastructure';
import { CACHE_SERVICE_TOKEN } from 'src/libs/core/constants';
import {
  conversationsTable,
  messagesTable,
} from '../drizzle/schema';
import { ChannelEnum } from '../../../domain';

/**
 * Inbox list item — read-optimized summary (FR9/FR17).
 */
export interface InboxItem {
  id: string;
  customerChannelId: string;
  channel: string;
  customerId: string | null;
  status: string;
  messageCount: number;
  lastMessage: {
    id: string;
    content: string;
    senderType: string;
    direction: string;
    createdAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Conversation detail with full thread (FR10/FR13).
 */
export interface ConversationDetail {
  id: string;
  customerChannelId: string;
  channel: string;
  customerId: string | null;
  status: string;
  messages: Array<{
    id: string;
    content: string;
    direction: string;
    senderType: string;
    channel: string;
    externalId: string | null;
    attachments: string[];
    createdAt: Date;
  }>;
  /** Mock Customer 360 stub (real in Epic 2). */
  customer360: {
    name: string;
    contract: string | null;
    debt: string | null;
    consumption: string | null;
    address: string | null;
  } | null;
  /** Mock ticket/SLA chip (real in Epic 3). */
  ticketChip: {
    ticketId: string | null;
    slaStatus: string | null;
    slaDeadline: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Inbox filter options (FR17).
 */
export interface InboxFilter {
  channel?: ChannelEnum;
  customerId?: string;
  status?: string;
}

const CACHE_TTL = 5; // 5s — short TTL to minimize stale detail after writes (reply/close)
const CACHE_PREFIX = 'inbox:';

/**
 * Conversation Read DAO
 *
 * Read-optimized queries for the BFF inbox endpoints (FR9/FR10/FR13/FR17).
 * Extends BaseReadDao; uses DATABASE_READ_TOKEN (read replica if configured).
 */
@Injectable()
export class ConversationReadDao extends BaseReadDao {
  private readonly logger = new Logger(ConversationReadDao.name);

  constructor(
    @Inject(DATABASE_READ_TOKEN)
    private readonly db: DrizzleDB,
    @Optional()
    @Inject(CACHE_SERVICE_TOKEN)
    private readonly cacheService?: ICacheService,
  ) {
    super();
  }

  protected async executeQuery<T = unknown>(
    sqlText: string,
    params?: unknown[],
  ): Promise<T[]> {
    const result = await this.db.execute(sqlText);
    return result.rows as T[];
  }

  /**
   * Paginated inbox list with last-message preview (FR9/FR17).
   */
  async findInbox(
    filter: InboxFilter,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ items: InboxItem[]; total: number }> {
    const offset = (page - 1) * limit;
    const conditions = this.buildConditions(filter);

    // Fetch conversations
    const conversations = await this.db
      .select()
      .from(conversationsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(conversationsTable.updatedAt))
      .limit(limit)
      .offset(offset);

    // Count total
    const countResult = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(conversationsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const total = Number(countResult[0]?.count) || 0;

    if (conversations.length === 0) {
      return { items: [], total };
    }

    // Batch-fetch ONLY the latest message per conversation (DISTINCT ON — avoids loading full history)
    const convIds = conversations.map((c) => c.id);
    const lastMessages = await this.db.execute(
      sql`SELECT DISTINCT ON (${messagesTable.conversationId}) *
          FROM ${messagesTable}
          WHERE ${messagesTable.conversationId} IN (${sql.join(
            convIds.map((id) => sql`${id}`),
            sql`, `,
          )})
          ORDER BY ${messagesTable.conversationId}, ${messagesTable.createdAt} DESC`,
    );

    const lastMsgRows = (lastMessages.rows || []) as Array<typeof messagesTable.$inferSelect>;

    // Group + pick last message per conversation
    const lastMsgMap = new Map<string, typeof messagesTable.$inferSelect>();
    for (const msg of lastMsgRows) {
      if (!lastMsgMap.has(msg.conversationId)) {
        lastMsgMap.set(msg.conversationId, msg); // first in desc order = latest
      }
    }

    // Count messages per conversation (batch)
    const countRows = await this.db
      .select({
        conversationId: messagesTable.conversationId,
        count: sql<number>`COUNT(*)`,
      })
      .from(messagesTable)
      .where(
        sql`${messagesTable.conversationId} IN (${sql.join(
          convIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
      .groupBy(messagesTable.conversationId);

    const countMap = new Map<string, number>();
    for (const row of countRows) {
      countMap.set(row.conversationId, Number(row.count));
    }

    const items: InboxItem[] = conversations.map((conv) => {
      const lastMsg = lastMsgMap.get(conv.id);
      return {
        id: conv.id,
        customerChannelId: conv.customerChannelId,
        channel: conv.channel,
        customerId: conv.customerId,
        status: conv.status,
        messageCount: countMap.get(conv.id) || 0,
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              content: lastMsg.content,
              senderType: lastMsg.senderType,
              direction: lastMsg.direction,
              createdAt: lastMsg.createdAt,
            }
          : null,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      };
    });

    return { items, total };
  }

  /**
   * Conversation detail with full thread (FR10/FR13).
   */
  async findById(id: string): Promise<ConversationDetail | null> {
    // Check cache
    if (this.cacheService) {
      const cached = await this.cacheService.get<ConversationDetail>(
        `${CACHE_PREFIX}detail:${id}`,
      );
      if (cached) return cached;
    }

    const convResult = await this.db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id))
      .limit(1);

    if (convResult.length === 0) return null;

    const conv = convResult[0];
    const msgs = await this.db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.createdAt); // chronological (FR8)

    const detail: ConversationDetail = {
      id: conv.id,
      customerChannelId: conv.customerChannelId,
      channel: conv.channel,
      customerId: conv.customerId,
      status: conv.status,
      messages: msgs.map((m) => ({
        id: m.id,
        content: m.content,
        direction: m.direction,
        senderType: m.senderType,
        channel: m.channel,
        externalId: m.externalId,
        attachments: m.attachments as string[],
        createdAt: m.createdAt,
      })),
      // Mock Customer 360 (real in Epic 2)
      customer360: conv.customerId
        ? {
            name: `Customer ${conv.customerId.slice(0, 8)}`,
            contract: 'HD-2024-0001',
            debt: '0 VND',
            consumption: '32 m³',
            address: 'P. Hòa Bình, Q. Lê Lợi',
          }
        : null,
      // Mock ticket/SLA chip (real in Epic 3)
      ticketChip: {
        ticketId: null,
        slaStatus: null,
        slaDeadline: null,
      },
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    };

    // Cache
    if (this.cacheService) {
      await this.cacheService.set(
        `${CACHE_PREFIX}detail:${id}`,
        detail,
        CACHE_TTL,
      );
    }

    return detail;
  }

  /**
   * Count unread/active conversations (for bootstrap).
   */
  async countActive(filter?: InboxFilter): Promise<number> {
    const conditions = this.buildConditions({
      ...filter,
      status: 'ACTIVE',
    });

    const result = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(conversationsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Number(result[0]?.count) || 0;
  }

  private buildConditions(filter: InboxFilter): SQL[] {
    const conditions: SQL[] = [];

    if (filter.status) {
      conditions.push(eq(conversationsTable.status, filter.status));
    } else {
      // Default: ACTIVE only
      conditions.push(eq(conversationsTable.status, 'ACTIVE'));
    }

    if (filter.channel) {
      conditions.push(eq(conversationsTable.channel, filter.channel));
    }

    if (filter.customerId) {
      conditions.push(eq(conversationsTable.customerId, filter.customerId));
    }

    return conditions;
  }
}
