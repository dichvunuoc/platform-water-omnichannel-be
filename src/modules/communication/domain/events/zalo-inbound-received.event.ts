/**
 * ZaloInboundReceivedEvent
 *
 * Domain event carrying an authenticated inbound Zalo OA webhook payload.
 * Enqueued to the Outbox by the webhook controller (synchronously, right after
 * HMAC verification), then published by the OutboxProcessor to the EventBus,
 * where ZaloInboundEventHandler picks it up and runs the worker logic.
 *
 * Decouples the fast webhook HTTP path (verify + enqueue + 200) from the slower
 * processing path (DB lookups, crypto, OA replies) — see plan hardening #4.
 */

import type { IDomainEvent } from '@core/domain';
import { randomUUID } from 'crypto';

export interface ZaloInboundReceivedData {
  /** Original raw Zalo payload (HMAC already verified). JSON string for outbox. */
  rawPayload: string;
  /** The message id, used as the outbox aggregate id + idempotency key. */
  messageId: string;
}

export class ZaloInboundReceivedEvent implements IDomainEvent<ZaloInboundReceivedData> {
  readonly eventId: string;
  readonly eventType = 'zalo.inbound';
  readonly aggregateType = 'ZaloWebhook';
  readonly occurredAt: Date;

  constructor(
    readonly aggregateId: string,
    readonly data: ZaloInboundReceivedData,
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
  }
}
