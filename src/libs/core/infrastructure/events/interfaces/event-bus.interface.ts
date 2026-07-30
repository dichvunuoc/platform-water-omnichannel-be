import { IDomainEvent } from '../../../domain/events';

/**
 * Event Bus interface
 * Provides publish/subscribe pattern for domain events
 */
export interface IEventBus {
  publish(event: IDomainEvent): Promise<void>;
  subscribe<T extends IDomainEvent>(
    eventType: string,
    handler: (event: T) => Promise<void>,
    options?: EventBusSubscribeOptions,
  ): void;
}

/** Options for subscribe — AmqpEventBus uses queueName/durable/autoDelete.
 *  In-process EventBus ignores them (backward compatible). */
export interface EventBusSubscribeOptions {
  /** Stable queue name per consumer TYPE (e.g., 'identity-resolution').
   *  Critical for multi-replica: all replicas of the same consumer bind to
   *  the SAME queue → RabbitMQ competing consumers (each message processed once). */
  queueName?: string;
  durable?: boolean;
  autoDelete?: boolean;
}
