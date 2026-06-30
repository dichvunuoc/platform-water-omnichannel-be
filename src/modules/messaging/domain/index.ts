/**
 * Messaging Domain Layer
 *
 * Pure TypeScript — no NestJS / Drizzle. Built on @core.
 */

// Value Objects
export * from './value-objects/channel.value-object';

// Entities
export * from './entities/message.entity';
export * from './entities/conversation.entity';

// Events
export * from './events/message-received.event';
export * from './events/conversation-started.event';

// Repositories (Ports)
export * from './repositories/conversation.repository.interface';
