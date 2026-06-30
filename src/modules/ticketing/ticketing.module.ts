import { Module } from '@nestjs/common';
import { SharedCqrsModule } from 'src/libs/shared';
import { TicketingController } from './infrastructure/http';
import { TicketRepository } from './infrastructure/persistence/write';
import { CreateTicketHandler, AdvanceStageHandler } from './application/commands';
import { TICKET_REPOSITORY_TOKEN } from './constants';
import { IdempotencyService } from 'src/libs/shared/cqrs';

@Module({
  imports: [SharedCqrsModule],
  controllers: [TicketingController],
  providers: [
    // Repository
    TicketRepository,
    { provide: TICKET_REPOSITORY_TOKEN, useExisting: TicketRepository },

    // Command handlers
    CreateTicketHandler,
    AdvanceStageHandler,

    // Idempotency
    IdempotencyService,
  ],
  exports: [TICKET_REPOSITORY_TOKEN],
})
export class TicketingModule {}
