/**
 * Zalo OA Token Manager
 *
 * Mitigates access-token expiry (plan hardening #3): Zalo OA access tokens
 * expire (≈15–24h). We do NOT hardcode the token in env. Instead we refresh it
 * using the long-lived refresh token and cache the current access token in Redis.
 *
 * When ZALO_OA_ENABLED=false (Phase 1, no real OA), this returns a stub token —
 * the OA client is also stubbed in that mode, so no real call is made.
 */

import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_SERVICE_TOKEN } from '@core';
import type { ICacheService } from '@shared/caching/cache.interface';

const TOKEN_CACHE_KEY = 'zalo:oa:access_token';
const TOKEN_TTL_SECONDS = 600; // refresh proactively; cache 10 min between refresh checks

export interface ZaloOaTokens {
  accessToken: string;
  /** Unix seconds when the access token expires. */
  expiresAt?: number;
}

@Injectable()
export class ZaloTokenManager {
  private readonly logger = new Logger(ZaloTokenManager.name);
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly refreshToken: string;
  private readonly appId: string;
  private readonly appSecret: string;

  constructor(
    private readonly config: ConfigService,
    @Optional() @Inject(CACHE_SERVICE_TOKEN) private readonly cache?: ICacheService,
  ) {
    this.enabled = this.config.get<string>('ZALO_OA_ENABLED', 'false') === 'true';
    this.baseUrl = this.config.get<string>('ZALO_OA_BASE_URL', 'https://openapi.zaloapp.com');
    this.refreshToken = this.config.get<string>('ZALO_OA_REFRESH_TOKEN', '');
    this.appId = this.config.get<string>('ZALO_OA_APP_ID', '');
    this.appSecret = this.config.get<string>('ZALO_OA_APP_SECRET', '');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get a valid OA access token, refreshing via the refresh token if needed.
   * Phase 1 (disabled) → stub token.
   */
  async getAccessToken(): Promise<string> {
    if (!this.enabled) return 'stub-oa-access-token';

    const cached = this.cache ? await this.cache.get<ZaloOaTokens>(TOKEN_CACHE_KEY) : null;
    const now = Math.floor(Date.now() / 1000);
    if (cached?.accessToken && (!cached.expiresAt || cached.expiresAt - now > 60)) {
      return cached.accessToken;
    }
    return this.refresh();
  }

  /**
   * Exchange the refresh token for a fresh access token and cache it.
   * Zalo OA: POST {baseUrl}/oa/v3/access_token (app credentials + refresh_token).
   * NOTE: the exact endpoint/body must be confirmed against the live OA docs when
   * ZALO_OA_ENABLED is flipped to true — the structure here follows Zalo's v3 model.
   */
  private async refresh(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/oa/v3/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        app_id: this.appId,
        app_secret: this.appSecret,
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
      }),
    });
    if (!res.ok) {
      this.logger.error(`Zalo token refresh failed: HTTP ${res.status}`);
      throw new Error('Failed to refresh Zalo OA access token');
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) {
      throw new Error('Zalo token refresh returned no access_token');
    }
    const tokens: ZaloOaTokens = {
      accessToken: json.access_token,
      expiresAt: json.expires_in
        ? Math.floor(Date.now() / 1000) + json.expires_in
        : undefined,
    };
    if (this.cache) await this.cache.set(TOKEN_CACHE_KEY, tokens, TOKEN_TTL_SECONDS);
    this.logger.log('Refreshed Zalo OA access token');
    return tokens.accessToken;
  }
}
