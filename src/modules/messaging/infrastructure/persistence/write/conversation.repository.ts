import { Injectable, Inject, Optional } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { IEventBus, IOutboxRepository } from 'src/libs/core/infrastructure';
import { ConcurrencyException } from 'src/libs/core/common';
import { OUTBOX_REPOSITORY_TOKEN } from 'src/libs/core/constants';
import {
  BaseAggregateRepository,
  SaveOptions,
  EVENT_BUS_TOKEN,
  DATABASE_WRITE_TOKEN,
  type DrizzleDB,
  type DrizzleTransaction,
} from 'src/libs/shared';
import {
  Channel,
  Conversation,
  ConversationStatus,
  Message,
  MessageDirection,
  SenderType,
  type ChannelEnum,
} from '../../../domain';
import type { IConversationRepository } from '../../../domain';
import {
  conversationsTable,
  messagesTable,
  type ConversationRecord,
  type MessageRecord,
} from '../drizzle/schema';

/**
 * Conversation Repository (Drizzle write impl)
 *
 * Mirrors OrderRepository: extends BaseAggregateRepository for outbox + OCC.
 * Persists Conversation + child Messages in one transaction; domain events
 * go to the transactional outbox within the same tx (FR7/NFR9).
 */
@Injectable()
export class ConversationRepository
  extends BaseAggregateRepository<Conversation>
  implements IConversationRepository
{
  constructor(
    @Inject(DATABASE_WRITE_TOKEN)
    private readonly db: DrizzleDB,
    @Inject(EVENT_BUS_TOKEN)
    protected readonly eventBus: IEventBus,
    @Optional()
    @Inject(OUTBOX_REPOSITORY_TOKEN)
    outboxRepository?: IOutboxRepository,
  ) {
    super(eventBus, outboxRepository, { useOutbox: !!outboxRepository });
  }

  protected async persist(
    aggregate: Conversation,
    expectedVersion: number,
    options?: SaveOptions,
  ): Promise<void> {
    const db = (options?.transaction as DrizzleTransaction) || this.db;
    const conversationRecord = this.toConversationPersistence(aggregate);
    const messageRecords = this.toMessagesPersistence(aggregate);

    // FIX: use UPSERT instead of INSERT-vs-UPDATE branching.
    // Reason: Conversation.create() fires 2 events (ConversationStarted + MessageReceived)
    // which increments version to 2. The base save() calculates expectedVersion = version-1 = 1,
    // which is != 0, so it tries UPDATE on a row that doesn't exist yet → ConcurrencyException.
    // UPSERT (INSERT ... ON CONFLICT DO UPDATE) handles both new + existing cleanly.
    await db
      .insert(conversationsTable)
      .values(conversationRecord)
      .onConflictDoUpdate({
        target: conversationsTable.id,
        set: {
          customerChannelId: conversationRecord.customerChannelId,
          channel: conversationRecord.channel,
          customerId: conversationRecord.customerId,
          ticketId: conversationRecord.ticketId,
          status: conversationRecord.status,
          version: conversationRecord.version,
          updatedAt: conversationRecord.updatedAt,
        },
      });

    // Messages: always delete + re-insert (idempotent — same pattern as existing)
    await db
      .delete(messagesTable)
      .where(eq(messagesTable.conversationId, aggregate.id));
    if (messageRecords.length > 0) {
      await db.insert(messagesTable).values(messageRecords);
    }
  }

  async getById(id: string): Promise<Conversation | null> {
    const convResult = await this.db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id))
      .limit(1);

    if (convResult.length === 0) return null;

    const msgResult = await this.db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id));

    return this.toDomain(convResult[0], msgResult);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(conversationsTable).where(eq(conversationsTable.id, id));
  }

  async findActiveByCustomerChannel(
    channel: ChannelEnum,
    customerChannelId: string,
  ): Promise<Conversation | null> {
    const convResult = await this.db
      .select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.channel, channel),
          eq(conversationsTable.customerChannelId, customerChannelId),
          eq(conversationsTable.status, ConversationStatus.ACTIVE),
        ),
      )
      .limit(1);

    if (convResult.length === 0) return null;

    const msgResult = await this.db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, convResult[0].id));

    return this.toDomain(convResult[0], msgResult);
  }

  async findActiveConversations(
    filters: { channel?: ChannelEnum; customerId?: string },
    page: number,
    limit: number,
  ): Promise<{ items: Conversation[]; total: number }> {
    const conditions: ReturnType<typeof eq>[] = [
      eq(conversationsTable.status, ConversationStatus.ACTIVE),
    ];
    if (filters.channel) {
      conditions.push(eq(conversationsTable.channel, filters.channel));
    }
    if (filters.customerId) {
      conditions.push(eq(conversationsTable.customerId, filters.customerId));
    }

    const offset = (page - 1) * limit;
    const rows = await this.db
      .select()
      .from(conversationsTable)
      .where(and(...conditions))
      .orderBy(desc(conversationsTable.updatedAt))
      .limit(limit)
      .offset(offset);

    const countResult = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(conversationsTable)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count) || 0;

    const items: Conversation[] = [];
    for (const row of rows) {
      const msgs = await this.db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, row.id));
      items.push(this.toDomain(row, msgs));
    }

    return { items, total };
  }

  // --- Mappers ---

  private toConversationPersistence(
    aggregate: Conversation,
  ): InsertConversationRecord {
    return {
      id: aggregate.id,
      customerChannelId: aggregate.customerChannelId,
      channel: aggregate.channel.value,
      customerId: aggregate.customerId,
      ticketId: aggregate.ticketId,
      status: aggregate.status,
      version: aggregate.version,
      createdAt: aggregate.createdAt,
      updatedAt: aggregate.updatedAt,
    };
  }

  private toMessagesPersistence(aggregate: Conversation): InsertMessageRecord[] {
    return aggregate.messages.map((msg) => ({
      id: msg.id,
      conversationId: aggregate.id,
      channel: msg.channel.value,
      direction: msg.direction,
      senderType: msg.senderType,
      content: msg.content,
      externalId: msg.externalId ?? null,
      attachments: [...msg.attachments],
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    }));
  }

  private toDomain(
    convRow: ConversationRecord,
    msgRows: MessageRecord[],
  ): Conversation {
    const messages: Message[] = msgRows.map((row) =>
      Message.reconstitute(
        row.id,
        row.conversationId,
        Channel.create(row.channel),
        row.direction as MessageDirection,
        row.senderType as SenderType,
        row.content,
        row.externalId ?? undefined,
        row.attachments as string[],
        row.createdAt,
        row.updatedAt,
      ),
    );

    return Conversation.reconstitute(
      convRow.id,
      convRow.customerChannelId,
      Channel.create(convRow.channel),
      convRow.customerId ?? null,
      messages,
      convRow.status as ConversationStatus,
      convRow.version,
      convRow.createdAt,
      convRow.updatedAt,
      (convRow as any).ticketId ?? null,
    );
  }
}

// Type imports for mappers
type InsertConversationRecord = typeof conversationsTable.$inferInsert;
type InsertMessageRecord = typeof messagesTable.$inferInsert;
