import { Module } from '@nestjs/common';
import { SharedCqrsModule } from 'src/libs/shared';
import { IdempotencyService } from 'src/libs/shared/cqrs';
import { TicketingStubModule } from '../ticketing-stub/ticketing-stub.module';
import { Customer360Module } from '../customer-360/customer-360.module';
import { PresenceModule } from '../presence/presence.module';
import { AiInsightModule } from '../ai-insight/ai-insight.module';
import { OutboundChannelModule } from '../outbound-channel/outbound-channel.module';
import { FieldTeamModule } from '../field-team/field-team.module';
import { InboundWebhookController } from './infrastructure/http';
import { BffController } from './infrastructure/http/bff.controller';
import { ConversationRepository } from './infrastructure/persistence/write';
import { ConversationReadDao } from './infrastructure/persistence/read';
import {
  ReceiveInboundMessageHandler,
  SendReplyHandler,
  CloseConversationHandler,
  ArchiveConversationHandler,
  AssignCustomerHandler,
  CreateTicketRequestHandler,
} from './application/commands/handlers';
import { DispatchWorkOrderHandler } from './application/commands/handlers/dispatch-work-order.handler';
import { TicketViewService } from './application/ticket-view.service';
import {
  CONVERSATION_REPOSITORY_TOKEN,
  CONVERSATION_READ_DAO_TOKEN,
} from './constants/tokens';

/**
 * Messaging Module — CORE conversation domain (lean).
 *
 * Chỉ còn: conversation aggregate persistence (write + read DAO), command handlers,
 * ingress (InboundWebhookController) + inbox API (BffController /bff/*), idempotency,
 * ticket view (read-side). Service connections (presence, AI, outbound, field-team,
 * customer-360) + realtime đã tách sang module riêng — import ở đây vì core cần.
 */
@Module({
  imports: [
    SharedCqrsModule,
    TicketingStubModule,
    Customer360Module,
    PresenceModule,
    AiInsightModule,
    OutboundChannelModule,
    FieldTeamModule,
  ],
  controllers: [InboundWebhookController, BffController],
  providers: [
    ConversationRepository,
    { provide: CONVERSATION_REPOSITORY_TOKEN, useExisting: ConversationRepository },
    ConversationReadDao,
    { provide: CONVERSATION_READ_DAO_TOKEN, useExisting: ConversationReadDao },

    // Command handlers (ingest, reply, close/archive, assign, create-ticket, dispatch)
    ReceiveInboundMessageHandler,
    SendReplyHandler,
    CloseConversationHandler,
    ArchiveConversationHandler,
    AssignCustomerHandler,
    CreateTicketRequestHandler,
    DispatchWorkOrderHandler,

    IdempotencyService,
    TicketViewService,
  ],
  exports: [CONVERSATION_REPOSITORY_TOKEN],
})
export class MessagingModule {}
