import { Injectable, Logger } from '@nestjs/common';
import { ChannelEnum } from '../../../domain';
import type { IOutboundChannelAdapter, OutboundResult } from '../../../application/ports';

/**
 * Mock Outbound Adapter
 *
 * Used for App / Facebook / Email channels in wave-1.
 * Always returns success (the message is "sent" — stubbed).
 */
@Injectable()
export class MockOutboundAdapter implements IOutboundChannelAdapter {
  private readonly logger = new Logger(MockOutboundAdapter.name);

  constructor(private readonly _channel: ChannelEnum) {}

  get channel(): ChannelEnum {
    return this._channel;
  }

  async send(
    customerChannelId: string,
    content: string,
  ): Promise<OutboundResult> {
    this.logger.debug(`Mock outbound [${this._channel}] → ${customerChannelId}: ${content.slice(0, 50)}...`);
    return { success: true, externalId: `mock-${this._channel}-${Date.now()}` };
  }
}
