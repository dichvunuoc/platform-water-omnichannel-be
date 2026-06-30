import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { ICommandBus } from 'src/libs/core/application';
import { COMMAND_BUS_TOKEN } from 'src/libs/core/constants';
import { ChannelEnum } from '../../domain';
import { ReceiveInboundMessageCommand } from '../../application/commands';
import { InboundMessageDto } from '../../application/dtos';

/**
 * Inbound Webhook Controller
 *
 * The public ingress for partner channel webhooks (FR1/FR2, NFR4).
 *
 * Resilience design (NFR4 — ack within 200ms, independent of downstream):
 *   The handler only does a fast DB write + outbox; downstream consumers
 *   (realtime push, Ticketing, CSAT) receive via outbox→bus asynchronously.
 *
 * Per-channel raw-payload normalizers (Zalo/App/FB/email) translate their native
 * webhook body into the channel-agnostic {@link InboundMessageDto} (FR4) before
 * dispatching the command. (Normalizers live alongside this controller; routes
 * are per channel so partners hit their dedicated endpoint.)
 */
@Controller('webhooks')
export class InboundWebhookController {
  constructor(
    @Inject(COMMAND_BUS_TOKEN)
    private readonly commandBus: ICommandBus,
  ) {}

  /**
   * Generic channel webhook — accepts an already-normalized DTO.
   * (Channel-specific controllers below wrap their native payload → DTO.)
   */
  @Post('inbound')
  @HttpCode(HttpStatus.OK)
  async receiveNormalized(@Body() dto: InboundMessageDto): Promise<{
    ok: true;
    conversationId: string;
    messageId: string;
  }> {
    const result = await this.commandBus.execute(
      new ReceiveInboundMessageCommand(
        dto.channel,
        dto.customerChannelId,
        dto.externalMessageId,
        dto.content ?? '',
        dto.attachments ?? [],
      ),
    );
    return { ok: true, ...result };
  }

  /**
   * Zalo OA webhook (FR1) — normalize native Zalo payload → DTO → command.
   * Returns HTTP 200 immediately (NFR4).
   *
   * NOTE: the raw Zalo event shape is simplified for wave-1; a dedicated
   * ZaloNormalizer will map the full payload (message text, image URLs, sender id).
   */
  @Post('zalo')
  @HttpCode(HttpStatus.OK)
  async receiveZalo(@Body() raw: ZaloWebhookRaw) {
    const dto = zaloToDto(raw);
    const result = await this.commandBus.execute(
      new ReceiveInboundMessageCommand(
        dto.channel,
        dto.customerChannelId,
        dto.externalMessageId,
        dto.content ?? '',
        dto.attachments ?? [],
      ),
    );
    return { ok: true, ...result };
  }

  /**
   * App (mobile push) webhook — normalize → DTO → command (FR1/FR4).
   */
  @Post('app')
  @HttpCode(HttpStatus.OK)
  async receiveApp(@Body() raw: AppWebhookRaw) {
    const dto = appToDto(raw);
    const result = await this.commandBus.execute(
      new ReceiveInboundMessageCommand(
        dto.channel, dto.customerChannelId, dto.externalMessageId,
        dto.content ?? '', dto.attachments ?? [],
      ),
    );
    return { ok: true, ...result };
  }

  /**
   * Facebook Messenger webhook — normalize FB entry → DTO → command (FR1/FR4).
   */
  @Post('facebook')
  @HttpCode(HttpStatus.OK)
  async receiveFacebook(@Body() raw: FacebookWebhookRaw) {
    const dto = facebookToDto(raw);
    const result = await this.commandBus.execute(
      new ReceiveInboundMessageCommand(
        dto.channel, dto.customerChannelId, dto.externalMessageId,
        dto.content ?? '', dto.attachments ?? [],
      ),
    );
    return { ok: true, ...result };
  }

  /**
   * Email inbound webhook — normalize → DTO → command (FR1/FR4).
   */
  @Post('email')
  @HttpCode(HttpStatus.OK)
  async receiveEmail(@Body() raw: EmailWebhookRaw) {
    const dto = emailToDto(raw);
    const result = await this.commandBus.execute(
      new ReceiveInboundMessageCommand(
        dto.channel, dto.customerChannelId, dto.externalMessageId,
        dto.content ?? '', dto.attachments ?? [],
      ),
    );
    return { ok: true, ...result };
  }
}

// --- Native Zalo payload (simplified for wave-1) ---
interface ZaloWebhookRaw {
  event?: string;
  sender?: { id: string };
  message?: { msg_id: string; text?: string; attachments?: { url: string }[] };
  trackingId?: string;
}

function zaloToDto(raw: ZaloWebhookRaw): InboundMessageDto {
  const dto = new InboundMessageDto();
  dto.channel = ChannelEnum.ZALO;
  dto.customerChannelId = raw.sender?.id ?? 'unknown';
  dto.externalMessageId = raw.message?.msg_id ?? raw.trackingId ?? randomUUID();
  dto.content = raw.message?.text ?? '';
  dto.attachments = (raw.message?.attachments ?? []).map((a) => a.url);
  return dto;
}

// --- Native App (mobile push) payload ---
interface AppWebhookRaw {
  userId: string;
  messageId: string;
  text?: string;
  attachments?: { url: string }[];
}

function appToDto(raw: AppWebhookRaw): InboundMessageDto {
  const dto = new InboundMessageDto();
  dto.channel = ChannelEnum.APP;
  dto.customerChannelId = raw.userId ?? 'unknown';
  dto.externalMessageId = raw.messageId ?? randomUUID();
  dto.content = raw.text ?? '';
  dto.attachments = (raw.attachments ?? []).map((a) => a.url);
  return dto;
}

// --- Native Facebook Messenger payload ---
interface FacebookWebhookRaw {
  object?: string;
  entry?: Array<{
    messaging?: Array<{
      sender?: { id: string };
      message?: {
        mid: string;
        text?: string;
        attachments?: Array<{ type?: string; payload?: { url?: string } }>;
      };
    }>;
  }>;
}

function facebookToDto(raw: FacebookWebhookRaw): InboundMessageDto {
  const dto = new InboundMessageDto();
  dto.channel = ChannelEnum.FACEBOOK;
  const msg = raw.entry?.[0]?.messaging?.[0];
  dto.customerChannelId = msg?.sender?.id ?? 'unknown';
  dto.externalMessageId = msg?.message?.mid ?? randomUUID();
  dto.content = msg?.message?.text ?? '';
  dto.attachments = (msg?.message?.attachments ?? [])
    .map((a) => a.payload?.url)
    .filter((url): url is string => !!url);
  return dto;
}

// --- Native Email inbound payload ---
interface EmailWebhookRaw {
  from: string;
  messageId: string;
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  attachments?: { url: string }[];
}

function emailToDto(raw: EmailWebhookRaw): InboundMessageDto {
  const dto = new InboundMessageDto();
  dto.channel = ChannelEnum.EMAIL;
  dto.customerChannelId = raw.from ?? 'unknown';
  dto.externalMessageId = raw.messageId ?? randomUUID();
  dto.content = raw.textBody ?? raw.subject ?? '';
  dto.attachments = (raw.attachments ?? []).map((a) => a.url);
  return dto;
}
