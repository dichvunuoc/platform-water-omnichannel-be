import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * User Role Enum
 */
export const userRoleEnum = pgEnum('user_role', ['customer', 'admin']);

/**
 * User Status Enum
 */
export const userStatusEnum = pgEnum('user_status', [
  'active',
  'suspended',
  'deleted',
]);

/**
 * Users Table Schema
 *
 * Stores customer identity records in the BFF-owned PostgreSQL database.
 *
 * PII fields (email, phone):
 * - Encrypted via AES-256-GCM with random IV (stored in email/phone columns)
 * - Searchable via HMAC-SHA256 blind index (stored in email_hash/phone_hash columns)
 * - Query pattern: WHERE phone_hash = hmac_sha256(phone_input, secret)
 */
export const usersTable = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // PII fields — AES-256-GCM encrypted (random IV, NOT searchable directly)
    email: varchar('email', { length: 512 }),
    phone: varchar('phone', { length: 512 }),
    // Blind index hashes — HMAC-SHA256 for searchable lookups
    emailHash: varchar('email_hash', { length: 64 }),
    phoneHash: varchar('phone_hash', { length: 64 }),
    name: varchar('name', { length: 255 }),
    role: userRoleEnum('role').default('customer'),
    status: userStatusEnum('status').default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    // Unique blind index for phone lookup — prevents duplicate phone registrations
    uniqueIndex('idx_users_phone_hash').on(table.phoneHash),
    // Unique blind index for email lookup — prevents duplicate email registrations
    uniqueIndex('idx_users_email_hash').on(table.emailHash),
  ],
);

/**
 * TypeScript type for User record
 */
export type UserRecord = typeof usersTable.$inferSelect;
export type NewUserRecord = typeof usersTable.$inferInsert;
