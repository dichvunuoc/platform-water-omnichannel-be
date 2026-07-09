/**
 * Zalo OA Client — sends the registration/login OTP to a customer via a
 * Zalo Official Account ZNS (Zalo Notification Message) template.
 *
 * Used by better-auth's phoneNumber plugin `sendOTP` so that "đăng ký/đăng nhập
 * bằng SĐT → nhận mã qua tin nhắn Zalo" (Pc, 2026-07-06). Falls back to logging
 * the OTP when the OA is not configured (dev) so the app runs without a live OA.
 *
 * Zalo OA auth: a long-lived refresh token (ZALO_OA_REFRESH_TOKEN) is exchanged
 * for a short-lived access token at https://oauth.zaloapp.com/v4/oa/access_token.
 * The access token is cached in-memory until its `expires_in` elapses.
 *
 * NOTE: the exact ZNS template payload (template_id + template_data mapping) is
 * configured via env (ZALO_OA_OTP_TEMPLATE_ID) so it can be set to the OA's
 * approved "OTP" template without a code change.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OaAccessToken {
  value: string;
  expiresAt: number; // epoch ms
}

@Injectable()
export class ZaloOaClient {
  private readonly logger = new Logger(ZaloOaClient.name);
  private token: OaAccessToken | null = null;

  private readonly appId: string;
  private readonly appSecret: string;
  private readonly refreshToken: string;
  private readonly otpTemplateId: string;
  private readonly oaBaseUrl: string;
  /** True when the OA is configured — when false, sendOtp() logs and returns. */
  readonly configured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.appId = this.configService.get<string>('ZALO_OA_ID', '');
    this.appSecret = this.configService.get<string>('ZALO_OA_APP_SECRET', '');
    this.refreshToken = this.configService.get<string>('ZALO_OA_REFRESH_TOKEN', '');
    this.otpTemplateId = this.configService.get<string>('ZALO_OA_OTP_TEMPLATE_ID', '');
    this.oaBaseUrl = this.configService.get<string>(
      'ZALO_OA_BASE_URL',
      'https://openapi.zaloapp.com',
    );
    this.configured = !!(this.appId && this.appSecret && this.refreshToken);
  }

  /**
   * Send the OTP code to `phone` via the OA's OTP ZNS template.
   * No-ops (with a dev log) when the OA is not configured.
   */
  async sendOtp(phone: string, code: string): Promise<void> {
    if (!this.configured || !this.otpTemplateId) {
      // Dev / unconfigured fallback — never block registration on the OA
      this.logger.log(
        `[DEV] ZNS OTP for ${phone.slice(-4).padStart(phone.length, '*')}: ${code}`,
      );
      return;
    }

    const accessToken = await this.getAccessToken();
    // Zalo OA "message by phone" template API (Customer Care / ZNS).
    // Template params are OA-specific; we expose the OTP via the standard name.
    const body = {
      recipient: { phone_number: phone },
      message: {
        template_id: this.otpTemplateId,
        template_data: { otp: code },
      },
    };

    const res = await fetch(`${this.oaBaseUrl}/v3.0/oa/message/phonenumber`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: accessToken,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(
        `Zalo OA OTP send failed (${res.status}) for ${phone.slice(-4).padStart(phone.length, '*')}: ${text}`,
      );
      return; // swallow — better-auth will still have issued the code; user can retry
    }
  }

  /**
   * Get a valid OA access token, refreshing (and caching) when absent/expired.
   * Uses the long-lived refresh token grant.
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.token && this.token.expiresAt > now + 60_000) {
      return this.token.value;
    }

    const res = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        app_id: this.appId,
        secret: this.appSecret,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Zalo OA token refresh failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = {
      value: data.access_token,
      expiresAt: now + (data.expires_in ?? 3600) * 1000,
    };
    return this.token.value;
  }
}
