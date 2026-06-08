import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { usersTable } from './user.schema';

/**
 * Sessions Table Schema
 *
 * Stores better-auth session data for frontend session management.
 * better-auth uses cookie-based sessions with configurable TTL (7-day refresh token).
 * This is the BFF↔Frontend session concern (NOT BFF→downstream JWT — that's Story 1.4).
 */
export const sessionsTable = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 512 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: varchar('ip_address', { length: 255 }),
  userAgent: varchar('user_agent', { length: 1024 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/**
 * TypeScript type for Session record
 */
export type SessionRecord = typeof sessionsTable.$inferSelect;
export type NewSessionRecord = typeof sessionsTable.$inferInsert;
