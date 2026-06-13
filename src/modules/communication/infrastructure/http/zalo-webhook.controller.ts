/**
 * Zalo Webhook Controller
 *
 * Receives inbound Zalo OA webhook callbacks.
 * Guarded by ZaloSignatureGuard — HMAC SHA-256 verification (FR71).
 *
 * Phase 2: Input adapters will add message processing, intent resolution, and command dispatch.
 * This story only ensures the endpoint is secured and responds correctly.
 */

import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { ZaloSignatureGuard } from '@shared/security';
import { Public } from '@modules/auth/infrastructure/decorators/public.decorator';

@Public()
@ApiTags('Webhooks — Zalo')
@Controller('webhooks/zalo')
@UseGuards(ZaloSignatureGuard) // AC#1: HMAC SHA-256 verification (FR71)
export class ZaloWebhookController {

  /**
   * POST /webhooks/zalo/callback
   * Zalo OA webhook callback (AC#1)
   *
   * Phase 2: Will process messages, resolve intent, dispatch commands.
   * This story: Verify signature, acknowledge receipt.
   */
  @Post('callback')
  @ApiOperation({ summary: 'Zalo OA webhook callback' })
  @ApiHeader({ name: 'X-ZECA-Signature', description: 'Zalo HMAC SHA-256 signature' })
  async handleZaloCallback(@Body() _body: Record<string, unknown>) {
    // Phase 2 input adapter will process the message payload here
    // This story only ensures the endpoint is secured
    return { received: true };
  }
}
