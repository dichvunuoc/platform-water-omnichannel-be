import { IsOptional, IsString, IsIn } from 'class-validator';
import type { TicketPriorityEnum } from '../../domain';

export class CreateTicketDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsIn(['P0', 'P1', 'P2', 'P3'])
  priority?: TicketPriorityEnum;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
