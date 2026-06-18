/**
 * Communication Module
 *
 * NestJS module for proactive notifications + notification dispatch.
 * Registers two port adapters with PortRegistry via onModuleInit.
 *
 * Ports in this module:
 *   proactive-notification — cacheTier: dynamic (5-15 min cache, FR50-FR53)
 *   notification           — cacheTier: dynamic (FR54/FR55 — notification dispatch)
 *
 * Story 6.1: ProactiveNotificationController, AcknowledgeAlertHandler, GetActiveAlertsHandler, GetAlertHistoryHandler
 * Story 6.2: DispatchNotificationHandler, RedisRateLimiterService, MockNotificationAdapter
 * Story 6.3: NotificationController, GetNotificationPreferencesHandler, GetNotificationHistoryHandler, UpdateNotificationPreferencesHandler
 *
 * Pattern: ...TicketModule → CommunicationModule → AuthPropagationModule → PortModule
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { ProactiveNotificationController } from './infrastructure/http/proactive-notification.controller';
import { NotificationController } from './infrastructure/http/notification.controller';
import { ZaloWebhookController } from './infrastructure/http/zalo-webhook.controller';
import { MockProactiveNotificationAdapter } from './infrastructure/ports/proactive-notification.port';
import { MockNotificationAdapter } from './infrastructure/ports/notification.port';
import { PROACTIVE_NOTIFICATION_PORT_TOKEN, NOTIFICATION_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetActiveAlertsHandler } from './application/queries/handlers/get-active-alerts.handler';
import { GetAlertHistoryHandler } from './application/queries/handlers/get-alert-history.handler';
import { GetNotificationPreferencesHandler } from './application/queries/handlers/get-notification-preferences.handler';
import { GetNotificationHistoryHandler } from './application/queries/handlers/get-notification-history.handler';
import { AcknowledgeAlertHandler } from './application/commands/handlers/acknowledge-alert.handler';
import { DispatchNotificationHandler } from './application/commands/handlers/dispatch-notification.handler';
import { UpdateNotificationPreferencesHandler } from './application/commands/handlers/update-notification-preferences.handler';
import { RedisRateLimiterService } from './infrastructure/rate-limiter/redis-rate-limiter.service';
// Zalo OA omnichannel integration (inbound webhook → async Account Linking / timeline)
import { ZaloOaClient } from './infrastructure/zalo/zalo-oa.client';
import { ZaloTokenManager } from './infrastructure/zalo/zalo-token-manager';
import { ZaloOAuthStateService } from './infrastructure/zalo/zalo-oauth-state.service';
import { ZaloWebhookService } from './application/zalo-webhook.service';
import { ZaloInboundSubscriber } from './application/handlers/zalo-inbound-event.handler';
import { ProviderLinkRepository } from '@modules/auth/infrastructure/persistence/drizzle/provider-link.repository';

@Module({
  controllers: [ProactiveNotificationController, NotificationController, ZaloWebhookController],
  providers: [
    // Port Adapters (single instance shared via useExisting)
    MockProactiveNotificationAdapter,
    {
      provide: PROACTIVE_NOTIFICATION_PORT_TOKEN,
      useExisting: MockProactiveNotificationAdapter,
    },
    MockNotificationAdapter,
    {
      provide: NOTIFICATION_PORT_TOKEN,
      useExisting: MockNotificationAdapter,
    },
    // Query Handlers
    GetActiveAlertsHandler,
    GetAlertHistoryHandler,
    GetNotificationPreferencesHandler,
    GetNotificationHistoryHandler,
    // Command Handlers
    AcknowledgeAlertHandler,
    DispatchNotificationHandler,
    UpdateNotificationPreferencesHandler,
    // Rate Limiter
    RedisRateLimiterService,
    // Zalo OA omnichannel: outbound client + token manager + OAuth nonce + worker + subscriber
    ProviderLinkRepository,
    ZaloTokenManager,
    ZaloOaClient,
    ZaloOAuthStateService,
    ZaloWebhookService,
    ZaloInboundSubscriber,
  ],
  exports: [PROACTIVE_NOTIFICATION_PORT_TOKEN, NOTIFICATION_PORT_TOKEN],
})
export class CommunicationModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockProactiveNotificationAdapter: MockProactiveNotificationAdapter,
    private readonly mockNotificationAdapter: MockNotificationAdapter,
    // Injecting the subscriber forces NestJS to instantiate it (providers are
    // otherwise lazy) so its onModuleInit subscribes to the 'zalo.inbound' outbox event.
    private readonly _zaloInboundSubscriber: ZaloInboundSubscriber,
  ) {}

  /**
   * Register ports with PortRegistry on module init.
   * proactive-notification: dynamic tier — 5-15 min cache (FR50-FR53)
   * notification: dynamic tier — 300s TTL (FR54/FR55)
   */
  onModuleInit() {
    this.portRegistry.register(
      'proactive-notification',
      this.mockProactiveNotificationAdapter,
      this.mockProactiveNotificationAdapter,
    );
    this.portRegistry.register(
      'notification',
      this.mockNotificationAdapter,
      this.mockNotificationAdapter,
    );
  }
}
