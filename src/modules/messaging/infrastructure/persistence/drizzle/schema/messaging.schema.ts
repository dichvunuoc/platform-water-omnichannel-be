import {
  pgTable,
  varchar,
  integer,
  timestamp,
  text,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Conversations Table
 *
 * One row per Conversation aggregate (the unified inbox thread).
 * `customer_id` is NULL until identity resolution runs (Epic 2 → GlobalCustomerID).
 */
export const conversationsTable = pgTable('conversations', {
  id: varchar('id', { length: 36 }).primaryKey(),
  customerChannelId: varchar('customer_channel_id', { length: 255 }).notNull(),
  channel: varchar('channel', { length: 20 }).notNull(),
  customerId: varchar('customer_id', { length: 36 }),
  ticketId: varchar('ticket_id', { length: 36 }),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Messages Table
 *
 * One row per Message (the normalized OmniMessage). Child of conversations.
 */
export const messagesTable = pgTable('messages', {
  id: varchar('id', { length: 36 }).primaryKey(),
  conversationId: varchar('conversation_id', { length: 36 })
    .notNull()
    .references(() => conversationsTable.id, { onDelete: 'cascade' }),
  channel: varchar('channel', { length: 20 }).notNull(),
  direction: varchar('direction', { length: 10 }).notNull(), // INBOUND | OUTBOUND
  senderType: varchar('sender_type', { length: 10 }).notNull(), // CUSTOMER | AGENT | BOT | SYSTEM
  content: text('content').notNull(),
  externalId: varchar('external_id', { length: 255 }), // channel-side id — for idempotency/dedup (FR3)
  attachments: jsonb('attachments').notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Relations
 */
export const conversationsRelations = relations(conversationsTable, ({ many }) => ({
  messages: many(messagesTable),
}));

export const messagesRelations = relations(messagesTable, ({ one }) => ({
  conversation: one(conversationsTable, {
    fields: [messagesTable.conversationId],
    references: [conversationsTable.id],
  }),
}));

/**
 * Type definitions
 */
export type ConversationRecord = typeof conversationsTable.$inferSelect;
export type InsertConversationRecord = typeof conversationsTable.$inferInsert;
export type MessageRecord = typeof messagesTable.$inferSelect;
export type InsertMessageRecord = typeof messagesTable.$inferInsert;
