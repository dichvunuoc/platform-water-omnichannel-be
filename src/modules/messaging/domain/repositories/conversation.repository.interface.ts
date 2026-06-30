import { IAggregateRepository } from 'src/libs/core/domain';
import { Conversation } from '../entities/conversation.entity';
import { ChannelEnum } from '../value-objects/channel.value-object';

/**
 * Conversation Repository Interface (Port)
 *
 * Extends IAggregateRepository with conversation-specific lookups.
 * Implemented in Infrastructure (Drizzle write-side repository).
 */
export interface IConversationRepository extends IAggregateRepository<Conversation> {
  /**
   * Find the active conversation for a given channel + channel-side customer id.
   * Used at ingress to attach an inbound message to an existing thread (FR1/FR8)
   * or decide to start a new one.
   */
  findActiveByCustomerChannel(
    channel: ChannelEnum,
    customerChannelId: string,
  ): Promise<Conversation | null>;

  /**
   * Inbox read-side helper: paginated active conversations (FR9/FR17).
   * (Read-optimized queries typically go via a Read DAO; this is a convenience.)
   */
  findActiveConversations(
    filters: {
      channel?: ChannelEnum;
      customerId?: string;
    },
    page: number,
    limit: number,
  ): Promise<{ items: Conversation[]; total: number }>;
}
