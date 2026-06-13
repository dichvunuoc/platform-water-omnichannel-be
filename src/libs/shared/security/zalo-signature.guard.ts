/**
 * Zalo Signature Guard (FR71)
 *
 * HMAC SHA-256 verification for inbound Zalo OA webhooks.
 * Computes HMAC of raw request body using ZALOA_SECRET_KEY env var,
 * compares with X-ZECA-Signature header using timing-safe comparison.
 *
 * Used by: ZaloWebhookController (POST /webhooks/zalo/callback)
 * Internal webhooks use InterServiceApiKeyGuard (different guard).
 */

import { CanActivate, ExecutionContext, Injectable, Logger, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class ZaloSignatureGuard implements CanActivate {
  private readonly logger = new Logger(ZaloSignatureGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // 1. Get raw body — MUST use rawBody, NOT parsed body
    const rawBody = request.rawBody;
    if (!rawBody) {
      this.logger.error('No rawBody — fastify-raw-body not configured for this route');
      throw new ForbiddenException('Request processing error');
    }

    // 2. Get expected secret from env
    const secret = process.env.ZALOA_SECRET_KEY;
    if (!secret) {
      this.logger.error('ZALOA_SECRET_KEY env var not configured — rejecting all Zalo webhooks');
      throw new ForbiddenException('Service configuration error');
    }

    // 3. Get signature from header
    const signature = request.headers['x-zeca-signature'];
    if (!signature || typeof signature !== 'string') {
      this.logger.warn(`Missing X-ZECA-Signature header from ${request.ip || 'unknown'}. Path: ${request.url}`);
      throw new ForbiddenException('Missing signature');
    }

    // 4. Compute HMAC SHA-256 on raw body
    const computed = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // 5. Timing-safe comparison
    if (!this.timingSafeEqual(computed, signature)) {
      this.logger.warn(
        `Zalo webhook signature mismatch from ${request.ip || 'unknown'}. Path: ${request.url}`,
      );
      throw new ForbiddenException('Invalid signature');
    }

    return true;
  }

  /**
   * Timing-safe string comparison.
   * Returns false if lengths differ (does NOT reveal which).
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
