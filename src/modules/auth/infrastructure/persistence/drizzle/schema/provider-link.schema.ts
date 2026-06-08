import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { usersTable } from './user.schema';

/**
 * Provider Type Enum
 */
export const providerTypeEnum = pgEnum('provider_type', [
  'phone',
  'zalo',
  'google',
  'facebook',
  'apple',
]);

/**
 * Provider Links Table Schema
 *
 * Links external identity providers to a User record.
 * One User can have multiple providers (phone, zalo, google, etc.).
 * Supports cross-provider account linking (AC#4).
 */
export const providerLinksTable = pgTable(
  'provider_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    providerType: providerTypeEnum('provider_type').notNull(),
    providerId: varchar('provider_id', { length: 255 }).notNull(), // phone number, Zalo ID, social sub
    providerEmail: varchar('provider_email', { length: 255 }), // from social OAuth
    isVerified: boolean('is_verified').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    // Unique constraint: one provider type+id can only be linked to one user
    uniqueIndex('idx_provider_links_type_id').on(
      table.providerType,
      table.providerId,
    ),
  ],
);

/**
 * TypeScript type for ProviderLink record
 */
export type ProviderLinkRecord = typeof providerLinksTable.$inferSelect;
export type NewProviderLinkRecord = typeof providerLinksTable.$inferInsert;
