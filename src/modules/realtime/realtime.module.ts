/** RealtimeModule — socket.io gateway (push message/sla events → agent screens). */
import { Module } from '@nestjs/common';
import { SharedCqrsModule } from 'src/libs/shared';
import { MessagingGateway } from '../messaging/infrastructure/realtime';

@Module({
  imports: [SharedCqrsModule],
  providers: [MessagingGateway],
})
export class RealtimeModule {}
