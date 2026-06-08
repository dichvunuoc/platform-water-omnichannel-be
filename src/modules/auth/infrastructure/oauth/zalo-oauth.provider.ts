import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

/**
 * Zalo OAuth Provider
 *
 * Implements the Zalo OA OAuth 2.0 flow for customer authentication.
 *
 * Flow:
 * 1. Redirect: https://oauth.zaloapp.com/v4/permission
 *    ?app_id={ZALO_APP_ID}
 *    &redirect_uri={ZALO_REDIRECT_URI}
 *    &scope=phone_number          ← CRITICAL: request phone number scope
 *
 * 2. User authorizes → callback with `code`
 *
 * 3. Exchange code for access token:
 *    POST https://oauth.zaloapp.com/v4/access_token
 *
 * 4. Get user info:
 *    GET https://graph.zalo.me/v2.0/me?fields=id,name,picture,phone_number
 *
 * 5. CRITICAL: `phone_number` only returned if scope was granted + user consented
 *    - If available → check for existing user with that phone → merge or create (AC#2, AC#4)
 *    - If unavailable → create standalone user (merge later via manual linking)
 *
 * Environment variables:
 *   ZALO_APP_ID, ZALO_APP_SECRET, ZALO_REDIRECT_URI
 */

/**
 * Zalo OAuth configuration
 */
export interface ZaloOAuthConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

/**
 * Zalo user info response (from /me endpoint)
 */
export const ZaloUserInfoSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  picture: z
    .object({
      data: z
        .object({
          url: z.string(),
        })
        .optional(),
    })
    .optional(),
  phone_number: z.string().optional(), // Only present if phone_number scope granted
});

export type ZaloUserInfo = z.infer<typeof ZaloUserInfoSchema>;

/**
 * Zalo access token response
 */
export const ZaloTokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  token_type: z.string().optional(),
});

export type ZaloTokenResponse = z.infer<typeof ZaloTokenResponseSchema>;

/**
 * Zalo OAuth result — normalized output for the application layer
 */
export interface ZaloOAuthResult {
  zaloId: string;
  name: string | null;
  avatarUrl: string | null;
  phoneNumber: string | null; // null if phone_number scope not granted
  phoneScopeGranted: boolean;
}

@Injectable()
export class ZaloOAuthProvider {
  private readonly logger = new Logger(ZaloOAuthProvider.name);
  private readonly config: ZaloOAuthConfig;

  private readonly AUTHORIZATION_URL = 'https://oauth.zaloapp.com/v4/permission';
  private readonly TOKEN_URL = 'https://oauth.zaloapp.com/v4/access_token';
  private readonly USER_INFO_URL = 'https://graph.zalo.me/v2.0/me';

  constructor(private readonly configService: ConfigService) {
    this.config = {
      appId: this.configService.getOrThrow<string>('ZALO_APP_ID'),
      appSecret: this.configService.getOrThrow<string>('ZALO_APP_SECRET'),
      redirectUri: this.configService.getOrThrow<string>('ZALO_REDIRECT_URI'),
    };
  }

  /**
   * Generate the Zalo OAuth authorization URL.
   * Includes phone_number scope for cross-provider account linking.
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      app_id: this.config.appId,
      redirect_uri: this.config.redirectUri,
      scope: 'id,name,picture,phone_number',
      response_type: 'code',
    });

    if (state) {
      params.set('state', state);
    }

    return `${this.AUTHORIZATION_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token.
   */
  async exchangeCodeForToken(code: string): Promise<ZaloTokenResponse> {
    this.logger.log('Exchanging Zalo authorization code for token');

    const response = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        app_id: this.config.appId,
        app_secret: this.config.appSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      this.logger.error(`Zalo token exchange failed: ${response.status}`);
      throw new Error(`Zalo token exchange failed: ${response.status}`);
    }

    const data = await response.json();
    const parsed = ZaloTokenResponseSchema.safeParse(data);

    if (!parsed.success) {
      this.logger.error(`Invalid Zalo token response: ${parsed.error.message}`);
      throw new Error('Invalid Zalo token response');
    }

    return parsed.data;
  }

  /**
   * Get user info from Zalo using access token.
   *
   * CRITICAL: phone_number is only returned if:
   * 1. The app requested phone_number scope in the authorization URL
   * 2. The user explicitly consented to sharing their phone number
   *
   * If phone_number is not in the response, the user must be created as a standalone account.
   * Merging can be performed later via manual account linking.
   */
  async getUserInfo(accessToken: string): Promise<ZaloOAuthResult> {
    this.logger.log('Fetching Zalo user info');

    const fields = 'id,name,picture,phone_number';
    const response = await fetch(
      `${this.USER_INFO_URL}?fields=${fields}&access_token=${accessToken}`,
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!response.ok) {
      this.logger.error(`Zalo user info fetch failed: ${response.status}`);
      throw new Error(`Zalo user info fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const parsed = ZaloUserInfoSchema.safeParse(data);

    if (!parsed.success) {
      this.logger.error(`Invalid Zalo user info: ${parsed.error.message}`);
      throw new Error('Invalid Zalo user info response');
    }

    const userInfo = parsed.data;
    const phoneScopeGranted = !!userInfo.phone_number;

    if (!phoneScopeGranted) {
      this.logger.warn(
        'Zalo phone_number scope not granted — creating standalone user',
      );
    }

    return {
      zaloId: userInfo.id,
      name: userInfo.name ?? null,
      avatarUrl: userInfo.picture?.data?.url ?? null,
      phoneNumber: userInfo.phone_number ?? null,
      phoneScopeGranted,
    };
  }

  /**
   * Complete Zalo OAuth flow: exchange code → get user info.
   * Returns normalized result for the RegisterWithProvider command.
   */
  async handleCallback(code: string): Promise<ZaloOAuthResult> {
    const tokenResponse = await this.exchangeCodeForToken(code);
    return this.getUserInfo(tokenResponse.access_token);
  }
}
