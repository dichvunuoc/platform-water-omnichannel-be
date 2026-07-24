/** BroadcastModule — thông báo chủ động port (cắt nước, khuyến mãi). Mock default. */
import { Module } from '@nestjs/common';
import { BROADCAST_PORT_TOKEN, MockBroadcastAdapter } from './broadcast.adapter';

@Module({
  providers: [MockBroadcastAdapter, { provide: BROADCAST_PORT_TOKEN, useExisting: MockBroadcastAdapter }],
  exports: [BROADCAST_PORT_TOKEN],
})
export class BroadcastModule {}
