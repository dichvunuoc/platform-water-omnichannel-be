import {
  pgTable,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Verification Table Schema
 *
 * Stores OTP and email/phone verification tokens for better-auth.
 * Required by the `phoneNumber` plugin for OTP-based authentication.
 *
 * better-auth uses this table to:
 * - Store OTP codes sent via SMS (phoneNumber plugin)
 * - Track email verification tokens
 * - Enforce expiry and attempt limits
 */
export const verificationTable = pgTable(
  'verification',
  {
    id: varchar('id', { length: 256 }).primaryKey(),
    /** Identifier being verified (phone number or email) */
    identifier: varchar('identifier', { length: 255 }).notNull(),
    /** Verification value (OTP code or token) */
    value: varchar('value', { length: 255 }).notNull(),
    /** When this verification expires */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    // Index for fast lookup by identifier (phone/email)
    index('idx_verification_identifier').on(table.identifier),
  ],
);

/**
 * TypeScript type for Verification record
 */
export type VerificationRecord = typeof verificationTable.$inferSelect;
export type NewVerificationRecord = typeof verificationTable.$inferInsert;
