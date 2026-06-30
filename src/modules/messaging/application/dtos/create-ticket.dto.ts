import { IsOptional, IsString, IsBoolean, IsIn } from 'class-validator';
import type { TicketPriority } from '../../domain/contracts';

/**
 * Create Ticket Request DTO (FR19).
 */
export class CreateTicketDto {
  @IsOptional()
  @IsIn(['P0', 'P1', 'P2', 'P3'])
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Demo only: fast-forward SLA to 5 min for J3 demo. */
  @IsOptional()
  @IsBoolean()
  fastForwardSla?: boolean;
}
