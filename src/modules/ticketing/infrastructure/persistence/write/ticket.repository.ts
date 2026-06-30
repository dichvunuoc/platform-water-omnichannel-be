import { Inject, Optional, Logger } from '@nestjs/common';
import { eq, and, isNull, ne } from 'drizzle-orm';
import type { DrizzleDB } from 'src/libs/shared/database';
import { DATABASE_WRITE_TOKEN } from 'src/libs/core/constants';
import type { IEventBus } from 'src/libs/core/infrastructure';
import { EVENT_BUS_TOKEN } from 'src/libs/core/constants';
import type { IOutboxRepository } from 'src/libs/core/infrastructure';
import { OUTBOX_REPOSITORY_TOKEN } from 'src/libs/core/constants';
import { BaseAggregateRepository, type SaveOptions } from 'src/libs/core/infrastructure';
import {
  Ticket,
  TicketPriorityEnum,
  TicketStageEnum,
  type ITicketRepository,
  type EscalationLevel,
} from '../../../domain';
import { ticketsTable, type InsertTicketRecord } from '../drizzle/schema/ticketing.schema';

export class TicketRepository
  extends BaseAggregateRepository<Ticket>
  implements ITicketRepository
{
  constructor(
    @Inject(DATABASE_WRITE_TOKEN)
    private readonly db: DrizzleDB,
    @Inject(EVENT_BUS_TOKEN)
    eventBus: IEventBus,
    @Optional()
    @Inject(OUTBOX_REPOSITORY_TOKEN)
    outboxRepository?: IOutboxRepository,
  ) {
    super(eventBus, outboxRepository, { useOutbox: !!outboxRepository });
  }

  protected async persist(
    aggregate: Ticket,
    expectedVersion: number,
    options?: SaveOptions,
  ): Promise<void> {
    const record = this.toPersistence(aggregate);

    // UPSERT pattern (same fix as ConversationRepository)
    await this.db
      .insert(ticketsTable)
      .values(record)
      .onConflictDoUpdate({
        target: ticketsTable.id,
        set: {
          conversationId: record.conversationId,
          customerId: record.customerId,
          channel: record.channel,
          title: record.title,
          description: record.description,
          stage: record.stage,
          priority: record.priority,
          assignee: record.assignee,
          parentId: record.parentId,
          ackDeadline: record.ackDeadline,
          resolveDeadline: record.resolveDeadline,
          acknowledgedAt: record.acknowledgedAt,
          closedAt: record.closedAt,
          escalated: record.escalated,
          escalationLevel: record.escalationLevel,
          reopenedFromCsat: record.reopenedFromCsat,
          version: record.version,
          updatedAt: record.updatedAt,
        },
      });
  }

  async getById(id: string): Promise<Ticket | null> {
    const rows = await this.db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return this.toDomain(rows[0]);
  }

  async findByConversationId(conversationId: string): Promise<Ticket | null> {
    const rows = await this.db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.conversationId, conversationId))
      .limit(1);
    if (rows.length === 0) return null;
    return this.toDomain(rows[0]);
  }

  async findOpenTickets(): Promise<Ticket[]> {
    const rows = await this.db
      .select()
      .from(ticketsTable)
      .where(
        and(
          ne(ticketsTable.stage, 'RESOLVED'),
          ne(ticketsTable.stage, 'CLOSED'),
        ),
      );
    return rows.map((r) => this.toDomain(r));
  }

  async findByParentId(parentId: string): Promise<Ticket[]> {
    const rows = await this.db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.parentId, parentId));
    return rows.map((r) => this.toDomain(r));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(ticketsTable).where(eq(ticketsTable.id, id));
  }

  // ─── Mappers ───

  private toPersistence(t: Ticket): InsertTicketRecord {
    return {
      id: t.id,
      conversationId: t.conversationId,
      customerId: t.customerId,
      channel: t.channel,
      title: t.title,
      description: t.description,
      stage: t.stage.value,
      priority: t.priority.value,
      assignee: t.assignee,
      parentId: t.parentId,
      ackDeadline: t.ackDeadline,
      resolveDeadline: t.resolveDeadline,
      acknowledgedAt: t.acknowledgedAt,
      closedAt: t.closedAt,
      escalated: t.escalated,
      escalationLevel: t.escalationLevel,
      reopenedFromCsat: t.reopenedFromCsat,
      version: t.version,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  private toDomain(row: typeof ticketsTable.$inferSelect): Ticket {
    return Ticket.reconstitute(
      row.id,
      row.conversationId,
      row.customerId,
      row.channel,
      row.title,
      row.description,
      row.priority as TicketPriorityEnum,
      row.stage as TicketStageEnum,
      row.assignee,
      row.parentId,
      row.ackDeadline,
      row.resolveDeadline,
      row.acknowledgedAt,
      row.closedAt,
      row.escalated,
      row.escalationLevel as EscalationLevel,
      row.reopenedFromCsat,
      row.version,
      row.createdAt,
      row.updatedAt,
    );
  }
}
