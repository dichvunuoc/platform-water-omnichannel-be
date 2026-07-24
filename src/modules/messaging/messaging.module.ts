import { Module } from '@nestjs/common';
import { SharedCqrsModule } from 'src/libs/shared';
import { IdempotencyService } from 'src/libs/shared/cqrs';
import { TicketingStubModule } from '../ticketing-stub/ticketing-stub.module';
import { InboundWebhookController } from './infrastructure/http';
import { BffController } from './infrastructure/http/bff.controller';
import { CskhController } from './infrastructure/http/cskh.controller';
import { MessagingGateway } from './infrastructure/realtime';
import { ConversationRepository } from './infrastructure/persistence/write';
import { ConversationReadDao } from './infrastructure/persistence/read';
import { ZaloOutboundAdapter, MockOutboundAdapter } from './infrastructure/channels/outbound';
import { ReceiveInboundMessageHandler, SendReplyHandler, CloseConversationHandler, ArchiveConversationHandler, AssignCustomerHandler, CreateTicketRequestHandler } from './application/commands/handlers';
import { PresenceService } from './application/presence.service';
import { AiInsightService } from './application/ai-insight.service';
import { MockAiVisionAdapter, MockAudioAiAdapter, MockNlpAdapter } from './infrastructure/adapters/mock/mock-ai-adapters';
import { MockCustomer360Adapter } from './infrastructure/adapters/mock/mock-customer-360.adapter';
import { Customer360BffAdapter } from './infrastructure/adapters/http/customer-360-bff.adapter';
import { MockFieldTeamAdapter } from './infrastructure/adapters/mock/mock-field-team.adapter';
import { TicketViewService } from './application/ticket-view.service';
import { DispatchWorkOrderHandler } from './application/commands/handlers/dispatch-work-order.handler';
import { FIELD_TEAM_PORT_TOKEN } from './constants/field-team-tokens';
import { NOTIFICATION_PORT_TOKEN } from './constants/notification-tokens';
import { MockNotificationAdapter } from './infrastructure/adapters/mock/mock-notification.adapter';
import { NotificationGrpcAdapter } from './infrastructure/adapters/grpc/notification-grpc.adapter';
import { KeycloakSaTokenService } from './infrastructure/adapters/grpc/keycloak-sa-token.service';
import { ConfigService } from '@nestjs/config';
import {
  MockIncidentAdapter,
  MockTelephonyAdapter,
  MockCsatAdapter,
  MockKnowledgeAdapter,
  MockChatbotAdapter,
  MockBroadcastAdapter,
  MockDashboardAdapter,
} from './infrastructure/adapters/mock/mock-cskh-aggregation.adapters';
import {
  INCIDENT_PORT_TOKEN,
  TELEPHONY_PORT_TOKEN,
  CSAT_PORT_TOKEN,
  KNOWLEDGE_PORT_TOKEN,
  CHATBOT_PORT_TOKEN,
  BROADCAST_PORT_TOKEN,
  DASHBOARD_PORT_TOKEN,
} from './constants/cskh-aggregation.tokens';
import {
  CONVERSATION_REPOSITORY_TOKEN,
  CONVERSATION_READ_DAO_TOKEN,
} from './constants/tokens';
import { OUTBOUND_ADAPTERS_TOKEN } from './constants/outbound-tokens';
import { CUSTOMER_360_PORT_TOKEN } from './constants/customer-tokens';
import { ChannelEnum } from './domain';

/**
 * Messaging Module
 *
 * Epic 1 — the ingestion spine + unified inbox.
 *
 * Wave-1 scope (story 1.1): webhook ingress → 200-OK → idempotency →
 * normalization → Conversation/Message persistence → outbox (FR1/2/3/4/7/8).
 *
 * Later stories add: realtime gateway (1.3), BFF inbox endpoints (1.4),
 * reply/outbound (1.5), presence/routing (1.6), AI display (1.7).
 */
@Module({
  imports: [SharedCqrsModule, TicketingStubModule],
  controllers: [InboundWebhookController, BffController, CskhController],
  providers: [
    // Write side
    ConversationRepository,
    {
      provide: CONVERSATION_REPOSITORY_TOKEN,
      useExisting: ConversationRepository,
    },

    // Read side (BFF inbox queries)
    ConversationReadDao,

    // Realtime gateway (socket.io — pushes messages to agent screens)
    MessagingGateway,

    // Application handlers
    ReceiveInboundMessageHandler,
    SendReplyHandler,
    CloseConversationHandler,
    ArchiveConversationHandler,
    AssignCustomerHandler,
    CreateTicketRequestHandler,

    // Presence (FR16 — Redis-backed agent availability)
    PresenceService,

    // AI insight (FR15 — mock adapters wave-1; real AI external wave-3)
    AiInsightService,
    { provide: 'IAiVisionPort', useExisting: MockAiVisionAdapter },
    { provide: 'IAudioAiPort', useExisting: MockAudioAiAdapter },
    { provide: 'INlpPort', useExisting: MockNlpAdapter },
    MockAiVisionAdapter,
    MockAudioAiAdapter,
    MockNlpAdapter,

    // Customer 360 (FR28-31) — Mock default; Customer360BffAdapter khi CSKH_BFF_URL set
    // (gọi qua .NET water-business-cskh-bff, không qua customer service trực tiếp)
    MockCustomer360Adapter,
    Customer360BffAdapter,
    {
      provide: CUSTOMER_360_PORT_TOKEN,
      useFactory: (
        config: ConfigService,
        mock: MockCustomer360Adapter,
        bff: Customer360BffAdapter,
      ) => (config.get<string>('CSKH_BFF_URL') ? bff : mock),
      inject: [ConfigService, MockCustomer360Adapter, Customer360BffAdapter],
    },

    // Outbound channel adapters
    ZaloOutboundAdapter,
    {
      provide: OUTBOUND_ADAPTERS_TOKEN,
      useFactory: (zalo: ZaloOutboundAdapter) => {
        const map = new Map<string, any>();
        map.set(ChannelEnum.ZALO, zalo);
        map.set(ChannelEnum.APP, new MockOutboundAdapter(ChannelEnum.APP));
        map.set(ChannelEnum.FACEBOOK, new MockOutboundAdapter(ChannelEnum.FACEBOOK));
        map.set(ChannelEnum.EMAIL, new MockOutboundAdapter(ChannelEnum.EMAIL));
        return map;
      },
      inject: [ZaloOutboundAdapter],
    },

    // Idempotency (from @shared — uses Redis or in-memory)
    IdempotencyService,

    // Ticket view (FR20/FR60 — BFF read-side enrichment for Kanban + SLA chip)
    TicketViewService,

    // Field-team dispatch (FR62 — Epic 7)
    DispatchWorkOrderHandler,
    MockFieldTeamAdapter,
    { provide: FIELD_TEAM_PORT_TOKEN, useExisting: MockFieldTeamAdapter },

    // Notification (gRPC Send → notification-be-rs; Mock default, Grpc khi NOTIFICATION_GRPC_URL set)
    KeycloakSaTokenService,
    MockNotificationAdapter,
    NotificationGrpcAdapter,
    {
      provide: NOTIFICATION_PORT_TOKEN,
      useFactory: (
        config: ConfigService,
        mock: MockNotificationAdapter,
        grpc: NotificationGrpcAdapter,
      ) => (config.get<string>('NOTIFICATION_GRPC_URL') ? grpc : mock),
      inject: [ConfigService, MockNotificationAdapter, NotificationGrpcAdapter],
    },

    // CSKH aggregation ports (7 domain — Mock default, lean port-adapter; RealAdapter khi service sẵn)
    MockIncidentAdapter,
    MockTelephonyAdapter,
    MockCsatAdapter,
    MockKnowledgeAdapter,
    MockChatbotAdapter,
    MockBroadcastAdapter,
    MockDashboardAdapter,
    { provide: INCIDENT_PORT_TOKEN, useExisting: MockIncidentAdapter },
    { provide: TELEPHONY_PORT_TOKEN, useExisting: MockTelephonyAdapter },
    { provide: CSAT_PORT_TOKEN, useExisting: MockCsatAdapter },
    { provide: KNOWLEDGE_PORT_TOKEN, useExisting: MockKnowledgeAdapter },
    { provide: CHATBOT_PORT_TOKEN, useExisting: MockChatbotAdapter },
    { provide: BROADCAST_PORT_TOKEN, useExisting: MockBroadcastAdapter },
    { provide: DASHBOARD_PORT_TOKEN, useExisting: MockDashboardAdapter },
  ],
  exports: [CONVERSATION_REPOSITORY_TOKEN],
})
export class MessagingModule {}
