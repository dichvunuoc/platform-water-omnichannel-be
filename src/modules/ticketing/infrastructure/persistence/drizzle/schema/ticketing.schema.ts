import { pgTable, varchar, integer, timestamp, boolean, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const ticketsTable = pgTable('tickets', {
  id: varchar('id', { length: 36 }).primaryKey(),
  conversationId: varchar('conversation_id', { length: 36 }),
  customerId: varchar('customer_id', { length: 36 }),
  channel: varchar('channel', { length: 20 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').default('').notNull(),
  stage: varchar('stage', { length: 20 }).notNull().default('RECEIVED'),
  priority: varchar('priority', { length: 5 }).notNull(),
  assignee: varchar('assignee', { length: 36 }),
  parentId: varchar('parent_id', { length: 36 }),
  ackDeadline: timestamp('ack_deadline').notNull(),
  resolveDeadline: timestamp('resolve_deadline').notNull(),
  acknowledgedAt: timestamp('acknowledged_at'),
  closedAt: timestamp('closed_at'),
  escalated: boolean('escalated').default(false).notNull(),
  escalationLevel: varchar('escalation_level', { length: 20 }).default('NONE').notNull(),
  reopenedFromCsat: boolean('reopened_from_csat').default(false).notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const ticketRelations = relations(ticketsTable, ({ many }) => ({
  // Child tickets referencing this ticket as parent
  children: many(ticketsTable, { relationName: 'parent_children' }),
}));

export type TicketRecord = typeof ticketsTable.$inferSelect;
export type InsertTicketRecord = typeof ticketsTable.$inferInsert;
