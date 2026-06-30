import { Module } from '@nestjs/common';
import { SharedCqrsModule } from 'src/libs/shared';
import { IdempotencyService } from 'src/libs/shared/cqrs';
import { TicketingStubModule } from '../ticketing-stub/ticketing-stub.module';
import { InboundWebhookController } from './infrastructure/http';
import { BffController } from './infrastructure/http/bff.controller';
import { MessagingGateway } from './infrastructure/realtime';
import { ConversationRepository } from './infrastructure/persistence/write';
import { ConversationReadDao } from './infrastructure/persistence/read';
import { ZaloOutboundAdapter, MockOutboundAdapter } from './infrastructure/channels/outbound';
import { ReceiveInboundMessageHandler, SendReplyHandler, CloseConversationHandler, ArchiveConversationHandler, AssignCustomerHandler, CreateTicketRequestHandler } from './application/commands/handlers';
import { PresenceService } from './application/presence.service';
import { AiInsightService } from './application/ai-insight.service';
import { MockAiVisionAdapter, MockAudioAiAdapter, MockNlpAdapter } from './infrastructure/adapters/mock/mock-ai-adapters';
import { MockCustomer360Adapter } from './infrastructure/adapters/mock/mock-customer-360.adapter';
import { MockFieldTeamAdapter } from './infrastructure/adapters/mock/mock-field-team.adapter';
import { TicketViewService } from './application/ticket-view.service';
import { DispatchWorkOrderHandler } from './application/commands/handlers/dispatch-work-order.handler';
import { FIELD_TEAM_PORT_TOKEN } from './constants/field-team-tokens';
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
  controllers: [InboundWebhookController, BffController],
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

    // Customer 360 (FR28-31 — mock adapter wave-1; real Customer 360 wave-3)
    { provide: CUSTOMER_360_PORT_TOKEN, useExisting: MockCustomer360Adapter },
    MockCustomer360Adapter,

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
  ],
  exports: [CONVERSATION_REPOSITORY_TOKEN],
})
export class MessagingModule {}
