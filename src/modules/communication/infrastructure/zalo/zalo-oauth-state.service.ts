/**
 * Zalo OAuth State Service
 *
 * Mitigates OAuth `state` tampering (plan hardening #2):
 * the `state` param on the Zalo OAuth URL is a random NONCE, NOT the raw
 * zalo_user_id. The zalo_user_id is stored in Redis keyed by the nonce (5 min TTL,
 * consume-once), so a MITM / browser-edit cannot redirect account-linking to an
 * arbitrary zalo_user_id.
 */

import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CACHE_SERVICE_TOKEN } from '@core';
import type { ICacheService } from '@shared/caching/cache.interface';

const STATE_KEY_PREFIX = 'oauth_state:zalo';
const STATE_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class ZaloOAuthStateService {
  private readonly logger = new Logger(ZaloOAuthStateService.name);

  constructor(
    @Optional()
    @Inject(CACHE_SERVICE_TOKEN)
    private readonly cache?: ICacheService,
  ) {}

  /**
   * Issue a single-use nonce bound to a zalo_user_id.
   * Returns the nonce to embed in the OAuth `state` param.
   */
  async issue(zaloUserId: string): Promise<string> {
    const nonce = randomUUID();
    if (this.cache) {
      await this.cache.set(`${STATE_KEY_PREFIX}:${nonce}`, zaloUserId, STATE_TTL_SECONDS);
    }
    this.logger.debug(`Issued OAuth state nonce for zalo user ${zaloUserId}`);
    return nonce;
  }

  /**
   * Consume a nonce → zalo_user_id. Single-use: deletes after read.
   * Returns null if the nonce is unknown/expired (anti-replay / anti-tamper).
   */
  async consume(nonce: string): Promise<string | null> {
    if (!this.cache) return null;
    const key = `${STATE_KEY_PREFIX}:${nonce}`;
    const zaloUserId = await this.cache.get<string>(key);
    if (zaloUserId) {
      await this.cache.delete(key); // consume-once
    }
    return zaloUserId ?? null;
  }
}
