/**
 * Drizzle Schema Exports
 *
 * Export tất cả table schemas
 */

import {
  outboxStatusEnum,
  outboxTable,
} from '@shared/database/outbox/drizzle/schema/outbox.schema';

import {
  usersTable,
  userRoleEnum,
  userStatusEnum,
} from '@modules/auth/infrastructure/persistence/drizzle/schema/user.schema';

import {
  providerLinksTable,
  providerTypeEnum,
} from '@modules/auth/infrastructure/persistence/drizzle/schema/provider-link.schema';

import { sessionsTable } from '@modules/auth/infrastructure/persistence/drizzle/schema/session.schema';

export const schema = {
  outboxTable,
  outboxStatusEnum,
  // Auth module tables
  usersTable,
  userRoleEnum,
  userStatusEnum,
  providerLinksTable,
  providerTypeEnum,
  sessionsTable,
};
