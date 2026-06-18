/**
 * Zalo Account Linking Service
 *
 * Completes the OAuth-driven Account Linking flow (plan hardening #2):
 * after a customer authorizes the Zalo OAuth (scope phone_number) and is
 * redirected back with a NONCE `state`, this service:
 *   1. Consumes the nonce (single-use, Redis) → recovers the zalo_user_id.
 *      (The raw zalo_user_id is NEVER on the URL — anti-tampering.)
 *   2. Looks up the internal User by the phone's blind index (phone_hash).
 *   3. Persists the mapping in provider_links(zalo, zalo_user_id, userId).
 *
 * After this, an inbound Zalo message from that sender resolves (FOUND branch)
 * and is recorded on the customer's timeline.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import { DATABASE_WRITE_TOKEN } from '@core';
import { PII_ENCRYPTION_SERVICE_TOKEN } from '../constants/tokens';
import type { DrizzleDB } from '@shared/database/drizzle/database.type';
import { usersTable, type UserRecord } from '../infrastructure/persistence/drizzle/schema/user.schema';
import { ProviderLinkRepository } from '../infrastructure/persistence/drizzle/provider-link.repository';
import { ZaloOAuthStateService } from '@modules/communication/infrastructure/zalo/zalo-oauth-state.service';
import { PiiEncryptionService } from '../infrastructure/persistence/encryption/pii-encryption.service';

export type LinkResult =
  | { linked: true; userId: string; zaloUserId: string }
  | { linked: false; reason: 'invalid_state' | 'user_not_found' | 'already_linked' };

@Injectable()
export class ZaloAccountLinkingService {
  private readonly logger = new Logger(ZaloAccountLinkingService.name);

  constructor(
    @Inject(DATABASE_WRITE_TOKEN) private readonly db: DrizzleDB,
    @Inject(PII_ENCRYPTION_SERVICE_TOKEN) private readonly pii: PiiEncryptionService,
    private readonly providerLinks: ProviderLinkRepository,
    private readonly oauthState: ZaloOAuthStateService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Link a Zalo sender to an internal user, keyed by a single-use OAuth nonce.
   * @param nonce  The OAuth `state` value issued when the OAuth link was sent.
   * @param phone  The phone number obtained from the Zalo OAuth `/me` response.
   */
  async linkByNonce(nonce: string, phone: string): Promise<LinkResult> {
    // 1. Consume the nonce → zalo_user_id (anti-tampering + anti-replay).
    const zaloUserId = await this.oauthState.consume(nonce);
    if (!zaloUserId) {
      this.logger.warn('Zalo linking failed: invalid/expired OAuth state nonce');
      return { linked: false, reason: 'invalid_state' };
    }

    // 2. Resolve the internal user by phone blind index.
    const user = await this.findUserByPhone(phone);
    if (!user) {
      this.logger.warn(`Zalo linking: no user found for the provided phone`);
      return { linked: false, reason: 'user_not_found' };
    }

    // 3. Idempotent: if already linked, nothing to do.
    const existing = await this.providerLinks.findByProvider('zalo', zaloUserId);
    if (existing) {
      return { linked: false, reason: 'already_linked' };
    }

    await this.providerLinks.link({
      userId: user.id,
      providerType: 'zalo',
      providerId: zaloUserId,
    });

    this.logger.log(`Linked Zalo user ${zaloUserId} → user ${user.id}`);
    return { linked: true, userId: user.id, zaloUserId };
  }

  private async findUserByPhone(phone: string): Promise<UserRecord | null> {
    const phoneHash = this.pii.hashIfNeeded(phone);
    if (!phoneHash) return null;
    const rows = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.phoneHash, phoneHash))
      .limit(1);
    return rows[0] ?? null;
  }
}
