/**
 * Ticket Webhook Controller (AC#3 — FR44)
 *
 * Receives ticket status change notifications from Ticketing Service.
 * Guarded by InterServiceApiKeyGuard — static API key verification (FR72).
 * Returns 200 always — webhook acknowledgment.
 *
 * Pattern: Payment WebhookController (EXACT same structure).
 */

import { Controller, Post, Body, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { COMMAND_BUS_TOKEN } from '@core/constants/tokens';
import type { ICommandBus } from '@core/application';
import { InterServiceApiKeyGuard } from '@shared/security';
import { Public } from '@modules/auth/infrastructure/decorators/public.decorator';
import { HandleTicketWebhookCommand } from '../../application/commands/handle-ticket-webhook.command';
import { TicketWebhookPayloadSchema } from '../../application/dtos/ticket.dto';
import { ValidationException } from '@core/common';

/**
 * @Public() — Webhook receives calls from Ticketing Service via x-api-key,
 * not browser sessions. Must bypass global SessionAuthGuard.
 */
@Public()
@ApiTags('Webhooks — Ticket')
@Controller('webhooks/ticket')
@UseGuards(InterServiceApiKeyGuard) // AC#3: Static API key verification (FR72)
export class TicketWebhookController {
  constructor(
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  /**
   * POST /webhooks/ticket/status
   * Ticket status change webhook from Ticketing Service (AC#3)
   * Returns 200 always — webhook acknowledgment
   */
  @Post('status')
  @ApiOperation({ summary: 'Ticket status change webhook (internal service)' })
  @ApiHeader({ name: 'x-api-key', description: 'Inter-service static API key' })
  async handleTicketStatus(@Body() body: Record<string, unknown>) {
    const validated = TicketWebhookPayloadSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException('Invalid ticket webhook payload');
    }

    await this.commandBus.execute(new HandleTicketWebhookCommand(validated.data));

    return { received: true };
  }
}
