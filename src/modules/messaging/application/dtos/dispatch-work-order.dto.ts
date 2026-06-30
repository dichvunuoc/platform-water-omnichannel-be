import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class DispatchWorkOrderDto {
  @IsString() @IsNotEmpty()
  agentId!: string;

  @IsString() @IsNotEmpty()
  incidentType!: string;

  @IsString() @IsNotEmpty()
  priority!: string;

  @IsString() @IsNotEmpty()
  address!: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  photoUrls?: string[];

  @IsOptional() @IsString()
  customerId?: string;
}
