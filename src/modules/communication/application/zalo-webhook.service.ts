/**
 * Zalo Webhook Service — the ASYNC worker for inbound Zalo OA messages.
 *
 * Invoked by ZaloInboundEventHandler (which the OutboxProcessor dispatches to via
 * the EventBus). Runs OUTSIDE the fast webhook HTTP path so DB lookups, crypto,
 * and OA replies never risk Zalo's 1–2s webhook timeout (plan hardening #4).
 *
 * Flow:
 *  1. Authoritative idempotency re-check (at-least-once outbox delivery) — drop retry.
 *  2. Parse + normalise the raw payload.
 *  3. Resolve sender via provider_links(provider_type='zalo', provider_id=<zaloUserId>):
 *     - FOUND  → RecordSessionEvent(zalo_message_received) → appears on portal timeline.
 *     - MISSING → send the OAuth login link (state=nonce) so the user can link.
 *  4. Store the idempotency result.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { COMMAND_BUS_TOKEN } from '@core';
import type { ICommandBus } from '@core/application';
import { ProviderLinkRepository } from '@modules/auth/infrastructure/persistence/drizzle/provider-link.repository';
import { RecordSessionEventCommand } from '@modules/session/application/commands/record-session-event.command';
import { ZaloOaClient } from '../infrastructure/zalo/zalo-oa.client';
import { ZaloOAuthStateService } from '../infrastructure/zalo/zalo-oauth-state.service';
import { normaliseZaloInbound } from './dtos/zalo-webhook.dto';

@Injectable()
export class ZaloWebhookService {
  private readonly logger = new Logger(ZaloWebhookService.name);

  constructor(
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
    private readonly providerLinks: ProviderLinkRepository,
    private readonly oaClient: ZaloOaClient,
    private readonly oauthState: ZaloOAuthStateService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Process an authenticated, already-HMAC-verified raw Zalo payload.
   *
   * Idempotency is handled at ingress (controller `claim`) — the same message id
   * cannot be enqueued twice — and the outbox marks PROCESSED only on success
   * (no re-delivery), so the worker does not need its own re-check.
   */
  async handle(rawPayload: string, messageId: string): Promise<void> {
    let parsed;
    try {
      parsed = normaliseZaloInbound(JSON.parse(rawPayload) as Record<string, unknown>);
    } catch (err) {
      this.logger.warn(`Unparseable Zalo inbound ${messageId}: ${(err as Error).message}`);
      return;
    }

    const { zaloUserId, text } = parsed;

    // Resolve the Zalo sender to an internal user.
    const link = await this.providerLinks.findByProvider('zalo', zaloUserId);

    if (link) {
      // Linked customer → record the interaction (the omnichannel "magic moment").
      await this.commandBus.execute(
        new RecordSessionEventCommand({
          userId: link.userId,
          eventType: 'zalo_message_received',
          channel: 'zalo',
          content: { text, zaloUserId },
        }),
      );
      this.logger.log(`Recorded Zalo message from ${zaloUserId} → user ${link.userId}`);
      return;
    }

    // Un-linked sender → reply with the OAuth login link (state = nonce, not the raw id).
    const oauthUrl = await this.buildOAuthLink(zaloUserId);
    await this.oaClient.sendMessage(
      zaloUserId,
      `Chào bạn! Để liên kết tài khoản và được hỗ trợ, vui lòng đăng nhập: ${oauthUrl}`,
    );
    this.logger.log(`Sent OAuth link to un-linked Zalo user ${zaloUserId}`);
  }

  /**
   * Build the Zalo OAuth permission URL with a NONCE state (anti-tampering).
   */
  private async buildOAuthLink(zaloUserId: string): Promise<string> {
    const appId = this.config.get<string>('ZALO_APP_ID', '');
    const redirectUri = this.config.get<string>('ZALO_REDIRECT_URI', '');
    const nonce = await this.oauthState.issue(zaloUserId);
    const params = new URLSearchParams({
      app_id: appId,
      redirect_uri: redirectUri,
      state: nonce,
    });
    return `https://oauth.zaloapp.com/v4/permission?${params.toString()}`;
  }
}
