/**
 * Payment Webhook Controller (AC#1)
 *
 * Receives IPN (Instant Payment Notification) from Payment Service.
 * Guarded by InterServiceApiKeyGuard — static API key verification (FR72).
 * Returns 200 always — webhook acknowledgment.
 */

import { Controller, Post, Body, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { COMMAND_BUS_TOKEN } from '@core/constants/tokens';
import type { ICommandBus } from '@core/application';
import { InterServiceApiKeyGuard } from '@shared/security';
import { Public } from '@modules/auth/infrastructure/decorators/public.decorator';
import { HandlePaymentWebhookCommand } from '../../application/commands/handle-payment-webhook.command';
import { PaymentWebhookPayloadSchema } from '../../application/dtos/payment.dto';
import { ValidationException } from '@core/common';

/**
 * @Public() — Webhook receives calls from Payment Service via x-api-key,
 * not browser sessions. Must bypass global SessionAuthGuard.
 */
@Public()
@ApiTags('Webhooks — Payment')
@Controller('webhooks/payment')
@UseGuards(InterServiceApiKeyGuard) // AC#1: Static API key verification (FR72)
export class WebhookController {
  constructor(
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  /**
   * POST /webhooks/payment/ipn
   * Payment Service IPN (Instant Payment Notification) (AC#1)
   * Returns 200 always — webhook acknowledgment
   */
  @Post('ipn')
  @ApiOperation({ summary: 'Payment IPN webhook (internal service)' })
  @ApiHeader({ name: 'x-api-key', description: 'Inter-service static API key' })
  async handlePaymentIpn(@Body() body: Record<string, unknown>) {
    const validated = PaymentWebhookPayloadSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException('Invalid payment webhook payload');
    }

    // Always dispatch — handler manages idempotency internally
    await this.commandBus.execute(new HandlePaymentWebhookCommand(validated.data));

    return { received: true };
  }
}
