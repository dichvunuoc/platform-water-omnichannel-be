/**
 * Zalo Inbound Event Subscriber
 *
 * The Outbox stores the webhook payload as a JSON string and the OutboxProcessor
 * re-publishes it as a PLAIN object (JSON.parse) — so @nestjs/cqrs
 * @EventsHandler (which matches by constructor) does NOT fire. Instead we
 * subscribe to the event TYPE 'zalo.inbound' via the custom EventBus, which
 * dispatches by `event.eventType` (works with the plain object).
 *
 * Registered on module init; routes the event to the worker (ZaloWebhookService),
 * keeping the webhook HTTP path instant (plan hardening #4).
 */

import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS_TOKEN } from '@core';
import type { IEventBus } from '@core/infrastructure';
import { ZaloInboundReceivedEvent } from '../../domain/events/zalo-inbound-received.event';
import { ZaloWebhookService } from '../zalo-webhook.service';

@Injectable()
export class ZaloInboundSubscriber implements OnModuleInit {
  private readonly logger = new Logger(ZaloInboundSubscriber.name);

  constructor(
    @Inject(EVENT_BUS_TOKEN) private readonly eventBus: IEventBus,
    private readonly webhookService: ZaloWebhookService,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe<ZaloInboundReceivedEvent>(
      'zalo.inbound',
      async (event) => {
        await this.webhookService.handle(
          event.data.rawPayload,
          event.data.messageId,
        );
      },
    );
    this.logger.log('Subscribed to outbox event type "zalo.inbound"');
  }
}
