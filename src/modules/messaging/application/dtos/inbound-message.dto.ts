import { IsEnum, IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';
import { ChannelEnum } from '../../domain';

/**
 * Inbound Message DTO
 *
 * Channel-agnostic normalized payload that every channel webhook normalizer
 * produces (FR4 — normalization). This is what the webhook controllers send to
 * the ReceiveInboundMessage command.
 */
export class InboundMessageDto {
  /** Source channel. */
  @IsEnum(ChannelEnum)
  channel!: ChannelEnum;

  /** Channel-side customer id (e.g. zalo_user_id, phone, email) — pre identity resolution. */
  @IsString()
  @IsNotEmpty()
  customerChannelId!: string;

  /** Channel-side message/event id — used as the idempotency key (FR3 dedup). */
  @IsString()
  @IsNotEmpty()
  externalMessageId!: string;

  /** Message text (may be empty for voice/call metadata events). */
  @IsOptional()
  @IsString()
  content?: string;

  /** Attachment refs (photo URLs, recording refs, etc.). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
