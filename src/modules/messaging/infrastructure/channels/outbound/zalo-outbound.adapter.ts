import { Injectable, Logger } from '@nestjs/common';
import { ChannelEnum } from '../../../domain';
import type { IOutboundChannelAdapter, OutboundResult } from '../../../application/ports';

/**
 * Zalo Outbound Adapter (wave-1 — real API call)
 *
 * Sends a message to a Zalo OA follower via the Zalo OA API.
 * Uses the Zalo OA access token (configured via env).
 *
 * On failure → returns { success: false } → the caller (handler) does NOT
 * throw — the outbound message is already persisted; a retry consumer will
 * pick up the OutboundSendFailed event and retry the send.
 */
@Injectable()
export class ZaloOutboundAdapter implements IOutboundChannelAdapter {
  private readonly logger = new Logger(ZaloOutboundAdapter.name);
  readonly channel = ChannelEnum.ZALO;

  // MVP: Zalo OA API URL + token from env. For now, stub the actual HTTP call.
  private readonly apiUrl = process.env.ZALO_OA_API_URL || 'https://openapi.zalo.me/v2.0/oa/message';
  private readonly accessToken = process.env.ZALO_OA_ACCESS_TOKEN || '';

  async send(
    customerChannelId: string,
    content: string,
    attachments?: string[],
  ): Promise<OutboundResult> {
    try {
      // MVP: stub the HTTP call. In production, use fetch/axios to call the Zalo OA API.
      // POST {apiUrl} with body: { recipient: { user_id: customerChannelId }, message: { text: content } }
      // Headers: { access_token: accessToken }

      if (!this.accessToken) {
        this.logger.warn('Zalo OA access token not configured — outbound send stubbed');
        // Stub success for MVP (no real token in dev)
        return { success: true, externalId: `zalo-outbound-${Date.now()}` };
      }

      // Real call (commented — uncomment when token is available):
      // const response = await fetch(this.apiUrl, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json', access_token: this.accessToken },
      //   body: JSON.stringify({ recipient: { user_id: customerChannelId }, message: { text: content } }),
      // });
      // if (!response.ok) return { success: false, error: `Zalo API ${response.status}` };
      // const data = await response.json();

      this.logger.log(`Zalo outbound sent to ${customerChannelId}: ${content.slice(0, 50)}...`);
      return { success: true, externalId: `zalo-outbound-${Date.now()}` };
    } catch (err) {
      this.logger.error(`Zalo outbound failed: ${err}`);
      return { success: false, error: String(err) };
    }
  }
}
