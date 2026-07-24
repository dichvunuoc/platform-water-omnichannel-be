/** BroadcastModule — thông báo chủ động port (cắt nước, khuyến mãi). Mock default. */
import { Module } from '@nestjs/common';
import { BROADCAST_PORT_TOKEN } from '../messaging/constants/cskh-aggregation.tokens';
import { MockBroadcastAdapter } from '../messaging/infrastructure/adapters/mock/mock-cskh-aggregation.adapters';

@Module({
  providers: [MockBroadcastAdapter, { provide: BROADCAST_PORT_TOKEN, useExisting: MockBroadcastAdapter }],
  exports: [BROADCAST_PORT_TOKEN],
})
export class BroadcastModule {}
