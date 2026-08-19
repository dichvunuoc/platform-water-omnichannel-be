import { Module } from '@nestjs/common';
import { SharedCqrsModule } from 'src/libs/shared';
import { NotificationModule } from '../notification/notification.module';
import { TicketingController } from './infrastructure/http';
import { TicketRepository } from './infrastructure/persistence/write';
import {
  CreateTicketHandler,
  AdvanceStageHandler,
} from './application/commands';
import { TICKET_REPOSITORY_TOKEN } from './constants';
import { IdempotencyService } from 'src/libs/shared/cqrs';
import { SlaWorkerService } from './infrastructure/sla-worker/sla-worker.service';
import { ConversationStartedTicketHandler } from './application/event-handlers/conversation-started.handler';
import { TicketClosedCsatHandler } from './application/event-handlers/ticket-closed-csat.handler';

@Module({
  imports: [SharedCqrsModule, NotificationModule],
  controllers: [TicketingController],
  providers: [
    TicketRepository,
    { provide: TICKET_REPOSITORY_TOKEN, useExisting: TicketRepository },
    CreateTicketHandler,
    AdvanceStageHandler,
    ConversationStartedTicketHandler,
    TicketClosedCsatHandler,
    SlaWorkerService,
    IdempotencyService,
  ],
  exports: [TICKET_REPOSITORY_TOKEN],
})
export class TicketingModule {}
