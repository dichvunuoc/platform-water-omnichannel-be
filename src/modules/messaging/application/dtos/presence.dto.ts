import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { AgentStatus } from '../presence.service';

/**
 * Presence update DTO (FR16).
 */
export class UpdatePresenceDto {
  @IsEnum(AgentStatus)
  status!: AgentStatus;
}

/**
 * Close conversation DTO (FR18).
 */
export class CloseConversationDto {
  @IsString()
  @IsNotEmpty()
  agentId!: string;
}
