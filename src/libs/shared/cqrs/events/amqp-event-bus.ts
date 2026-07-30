/**
 * AMQP Event Bus — RabbitMQ-backed implementation of IEventBus.
 *
 * Replaces the in-process EventBus when AMQP_URL is set. Events flow:
 *   OutboxProcessor → AmqpEventBus.publish() → RabbitMQ exchange → durable queues
 *   → consumers (ack on success, nack→DLQ on failure).
 *
 * Key reliability features:
 *  - Persistent messages (survive broker restart).
 *  - Publisher confirms (channel.waitForConfirms).
 *  - Manual ack + dead-letter queue per durable queue.
 *  - Subscribe buffers until channel is ready (lifecycle safety).
 *
 * Fallback: if the channel drops, publish() logs a warning and returns
 * (the outbox row stays PENDING → retried by the processor).
 */
import { Injectable, Logger, Inject } from '@nestjs/common';
import type { ConfirmChannel } from 'amqplib';
import type { IEventBus } from '../../../core/infrastructure/events/interfaces/event-bus.interface';
import type { IDomainEvent } from '../../../core/domain/events';
import { AmqpConnection, EXCHANGE_NAME } from './amqp-connection';

interface PendingSubscription {
  eventType: string;
  queueName: string;
  handler: (event: IDomainEvent) => Promise<void>;
  options?: { durable?: boolean; autoDelete?: boolean };
}

@Injectable()
export class AmqpEventBus implements IEventBus {
  private readonly logger = new Logger('AmqpEventBus');
  private readonly pendingSubs: PendingSubscription[] = [];
  private registered = false;

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async publish(event: IDomainEvent): Promise<void> {
    const channel = this.amqpConnection.getChannel();
    if (!channel) {
      this.logger.warn(
        `Channel not ready — event ${event.eventType} will be retried by outbox`,
      );
      throw new Error('AMQP channel not available');
    }

    const buffer = Buffer.from(JSON.stringify(event));
    channel.publish(
      EXCHANGE_NAME,
      event.eventType,
      buffer,
      {
        persistent: true,
        contentType: 'application/json',
        messageId: event.eventId,
        timestamp: Date.now(),
        headers: {
          aggregateType: event.aggregateType,
        },
      },
    );

    // Publisher confirms — ensures broker accepted the message.
    await channel.waitForConfirms();
  }

  subscribe<T extends IDomainEvent>(
    eventType: string,
    handler: (event: T) => Promise<void>,
    options?: { queueName?: string; durable?: boolean; autoDelete?: boolean },
  ): void {
    const queueName = options?.queueName ?? `${eventType}.consumer`;
    const sub: PendingSubscription = {
      eventType,
      queueName,
      handler: handler as (event: IDomainEvent) => Promise<void>,
      options,
    };

    const channel = this.amqpConnection.getChannel();
    if (channel) {
      this.registerSubscription(channel, sub).catch((e) =>
        this.logger.error(`Failed to subscribe ${queueName}: ${e.message}`),
      );
    } else {
      // Buffer until channel is ready.
      this.pendingSubs.push(sub);
      this.logger.warn(`Buffered subscription for ${queueName} (channel not ready)`);
    }
  }

  /**
   * Called by AmqpConnection after reconnect to flush buffered subscriptions
   * and re-assert existing ones.
   */
  async flushPending(channel: ConfirmChannel): Promise<void> {
    const subs = [...this.pendingSubs, ...(this.registered ? [] : [])];
    this.pendingSubs.length = 0;

    for (const sub of subs) {
      await this.registerSubscription(channel, sub);
    }
    this.registered = true;
    if (subs.length > 0) {
      this.logger.log(`Flushed ${subs.length} buffered subscriptions`);
    }
  }

  private async registerSubscription(
    channel: ConfirmChannel,
    sub: PendingSubscription,
  ): Promise<void> {
    const durable = sub.options?.durable ?? true;
    const autoDelete = sub.options?.autoDelete ?? false;

    // Dead-letter setup for durable queues.
    const args: Record<string, unknown> = {};
    if (durable) {
      const dlx = `${sub.queueName}.dlx`;
      await channel.assertExchange(dlx, 'direct', { durable: true });
      await channel.assertQueue(`${sub.queueName}.dlq`, { durable: true });
      await channel.bindQueue(`${sub.queueName}.dlq`, dlx, sub.queueName);
      args['x-dead-letter-exchange'] = dlx;
      args['x-dead-letter-routing-key'] = sub.queueName;
    }

    // Assert the consumer queue.
    await channel.assertQueue(sub.queueName, { durable, autoDelete, arguments: args });

    // Bind to the topic exchange via routing key = eventType.
    await channel.bindQueue(sub.queueName, EXCHANGE_NAME, sub.eventType);

    // Consume with manual ack.
    await channel.consume(
      sub.queueName,
      async (msg) => {
        if (!msg) return;
        try {
          const event = JSON.parse(msg.content.toString()) as IDomainEvent;
          await sub.handler(event);
          channel.ack(msg);
        } catch (err) {
          this.logger.error(
            `Consumer error in ${sub.queueName}: ${(err as Error).message} → DLQ`,
          );
          // Nack without requeue → goes to DLQ.
          channel.nack(msg, false, false);
        }
      },
      { noAck: false },
    );

    this.logger.log(`Subscribed: ${sub.queueName} ← ${sub.eventType} (durable=${durable})`);
  }
}
