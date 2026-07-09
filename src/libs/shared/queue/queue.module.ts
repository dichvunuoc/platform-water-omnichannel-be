/**
 * Queue Module — Queued resilience tier (BullMQ)
 *
 * @Global so PortRegistry (and any module) can inject QueueService.
 * Disabled gracefully (no-op) when REDIS_HOST is unset.
 */

import { Global, Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { StructuredLogger } from '../observability/structured-logger.service';

@Global()
@Module({
  providers: [QueueService, StructuredLogger],
  exports: [QueueService],
})
export class QueueModule {}
