/**
 * Drizzle Schema Exports
 *
 * Export tất cả table schemas for the OmniCare project.
 * (Product/Order demo modules removed — OmniCare modules registered here.)
 */

import {
  conversationsTable,
  messagesTable,
  conversationsRelations,
  messagesRelations,
} from '@modules/messaging/infrastructure/persistence/drizzle/schema';
import {
  outboxStatusEnum,
  outboxTable,
} from '@shared/database/outbox/drizzle/schema/outbox.schema';

export const schema = {
  conversationsTable,
  messagesTable,
  conversationsRelations,
  messagesRelations,
  outboxTable,
  outboxStatusEnum,
};
