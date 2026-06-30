import { Module } from '@nestjs/common';
import { TicketingStubService } from './ticketing-stub.service';
import { TicketingStubController } from './ticketing-stub.controller';

/**
 * Ticketing Stub Module
 *
 * Wave-1 in-memory Ticketing & SLA service simulator.
 * Replaced by the real Ticketing microservice in wave-2 (same contract).
 */
@Module({
  controllers: [TicketingStubController],
  providers: [TicketingStubService],
  exports: [TicketingStubService],
})
export class TicketingStubModule {}
