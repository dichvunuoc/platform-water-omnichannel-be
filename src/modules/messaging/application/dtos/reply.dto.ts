import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';

/**
 * Reply DTO — validates the agent's reply payload (FR11).
 */
export class ReplyDto {
  /** Agent ID (from auth, or explicit in body for MVP). */
  @IsString()
  @IsNotEmpty()
  agentId!: string;

  /** Reply text content. */
  @IsString()
  @IsNotEmpty()
  content!: string;

  /** Optional attachment URLs. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
