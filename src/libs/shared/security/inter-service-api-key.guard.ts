/**
 * Inter-Service API Key Guard (FR72)
 *
 * Validates static shared secret (`x-api-key` header) for internal webhooks.
 * Used by: Payment webhook, Ticket webhook, Notification webhook.
 *
 * This is a STATIC shared secret — NOT JWT (per FR72).
 * Zalo webhooks use HMAC SHA-256 via ZaloSignatureGuard (different guard).
 */

import { CanActivate, ExecutionContext, Injectable, Logger, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class InterServiceApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InterServiceApiKeyGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const expectedKey = process.env.INTER_SERVICE_API_KEY;

    if (!expectedKey) {
      this.logger.error('INTER_SERVICE_API_KEY env var not configured — rejecting all webhook requests');
      throw new ForbiddenException('Service configuration error');
    }

    if (!apiKey || typeof apiKey !== 'string') {
      this.logger.warn(`Missing x-api-key header from ${request.ip || 'unknown'}. Path: ${request.url}`);
      throw new ForbiddenException('Invalid API key');
    }

    // Timing-safe comparison — prevents timing attacks
    if (apiKey.length !== expectedKey.length || !crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(expectedKey))) {
      this.logger.warn(`Invalid API key from ${request.ip || 'unknown'}. Path: ${request.url}`);
      throw new ForbiddenException('Invalid API key');
    }

    return true;
  }
}
