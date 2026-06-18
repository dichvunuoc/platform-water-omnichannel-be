/**
 * Zalo OA Client
 *
 * Sends an outbound text message to a user via the Zalo OA chat API
 * (`/oa/v3/sendmessage`). Used by the Account Linking flow to reply to a
 * first-time (un-linked) sender with the OAuth login link.
 *
 * When ZALO_OA_ENABLED=false (Phase 1), sendMessage is a NO-OP log stub —
 * no real Zalo call is made. Flip the flag + supply credentials to go live.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZaloTokenManager } from './zalo-token-manager';

@Injectable()
export class ZaloOaClient {
  private readonly logger = new Logger(ZaloOaClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly tokenManager: ZaloTokenManager,
  ) {
    this.baseUrl = this.config.get<string>('ZALO_OA_BASE_URL', 'https://openapi.zaloapp.com');
  }

  /**
   * Send a text message to a Zalo OA user.
   */
  async sendMessage(zaloUserId: string, text: string): Promise<void> {
    if (!this.tokenManager.isEnabled()) {
      // Phase 1 stub — log what we WOULD send so the flow is observable without an OA.
      this.logger.log(`[STUB] Zalo OA sendMessage → user ${zaloUserId}: ${text}`);
      return;
    }

    const accessToken = await this.tokenManager.getAccessToken();
    const res = await fetch(`${this.baseUrl}/oa/v3/sendmessage?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { user_id: zaloUserId },
        message: { text },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(
        `Zalo OA sendMessage failed: HTTP ${res.status} for user ${zaloUserId}: ${body}`,
      );
      throw new Error(`Zalo OA sendMessage failed: HTTP ${res.status}`);
    }
    this.logger.log(`Sent Zalo OA message to user ${zaloUserId}`);
  }
}
