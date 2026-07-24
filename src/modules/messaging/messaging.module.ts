import { Module } from '@nestjs/common';
import { SharedCqrsModule } from 'src/libs/shared';
import { IdempotencyService } from 'src/libs/shared/cqrs';
import { TicketingStubModule } from '../ticketing-stub/ticketing-stub.module';
import { Customer360Module } from '../customer-360/customer-360.module';
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
import { MockFieldTeamAdapter } from './infrastructure/adapters/mock/mock-field-team.adapter';
import { TicketViewService } from './application/ticket-view.service';
import { DispatchWorkOrderHandler } from './application/commands/handlers/dispatch-work-order.handler';
import { FIELD_TEAM_PORT_TOKEN } from './constants/field-team-tokens';
import {
  CONVERSATION_REPOSITORY_TOKEN,
  CONVERSATION_READ_DAO_TOKEN,
} from './constants/tokens';
import { OUTBOUND_ADAPTERS_TOKEN } from './constants/outbound-tokens';
import { ChannelEnum } from './domain';

/**
 * Messaging Module — CORE (Epic 1): ingestion spine + unified inbox + realtime.
 * Tách aggregation ra các module riêng (CskhModule + 9 service module). BffController
 * (/bff/conversations, inbox) dùng Customer360Module (import). CskhController đã chuyển
 * sang CskhModule.
 */
@Module({
  imports: [SharedCqrsModule, TicketingStubModule, Customer360Module],
  controllers: [InboundWebhookController, BffController],
  providers: [
    // Write side
    ConversationRepository,
    { provide: CONVERSATION_REPOSITORY_TOKEN, useExisting: ConversationRepository },

    // Read side (BFF inbox queries)
    ConversationReadDao,
    { provide: CONVERSATION_READ_DAO_TOKEN, useExisting: ConversationReadDao },

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
