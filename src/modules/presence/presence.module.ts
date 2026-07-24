/** PresenceModule — agent availability (Redis hoặc in-memory fallback). */
import { Module } from '@nestjs/common';
import { PresenceService } from './presence.service';

@Module({
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
