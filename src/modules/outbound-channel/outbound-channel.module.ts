/** OutboundChannelModule — channel adapters (Zalo real骨架 + App/FB/Email mock). */
import { Module } from '@nestjs/common';
import { ZaloOutboundAdapter } from './zalo-outbound.adapter';
import { MockOutboundAdapter } from './mock-outbound.adapter';
import { OUTBOUND_ADAPTERS_TOKEN } from './outbound.tokens';
import { ChannelEnum } from '../messaging/domain';

@Module({
  providers: [
    ZaloOutboundAdapter,
    {
      provide: OUTBOUND_ADAPTERS_TOKEN,
      useFactory: (zalo: ZaloOutboundAdapter) => {
        const map = new Map<string, any>();
        map.set(ChannelEnum.ZALO, zalo);
        map.set(ChannelEnum.APP, new MockOutboundAdapter(ChannelEnum.APP));
        map.set(
          ChannelEnum.FACEBOOK,
          new MockOutboundAdapter(ChannelEnum.FACEBOOK),
        );
        map.set(ChannelEnum.EMAIL, new MockOutboundAdapter(ChannelEnum.EMAIL));
        return map;
      },
      inject: [ZaloOutboundAdapter],
    },
  ],
  exports: [OUTBOUND_ADAPTERS_TOKEN],
})
export class OutboundChannelModule {}
