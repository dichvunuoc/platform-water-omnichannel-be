/**
 * Swagger-specific DTO classes for Auth endpoints.
 *
 * These classes exist solely for NestJS Swagger to generate OpenAPI schemas.
 * Zod schemas remain the source of truth for runtime validation.
 * Swagger classes mirror the Zod rules with examples and descriptions.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// =============================================================================
// Request DTOs
// =============================================================================

export class SwaggerRegisterPhoneDto {
  @ApiProperty({
    example: '0901234567',
    description: 'Vietnamese phone number (starts with 03|05|07|08|09, followed by 8 digits)',
  })
  phoneNumber: string;

  @ApiPropertyOptional({
    example: 'Nguyễn Văn A',
    description: 'Display name (1-255 characters)',
  })
  name?: string;
}

export class SwaggerVerifyOtpDto {
  @ApiProperty({
    example: '0901234567',
    description: 'Phone number that received the OTP',
  })
  phoneNumber: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP code',
  })
  code: string;
}

export class SwaggerRegisterProviderDto {
  @ApiProperty({
    enum: ['phone', 'zalo', 'google', 'facebook', 'apple'],
    example: 'zalo',
    description: 'OAuth provider type',
  })
  providerType: string;

  @ApiProperty({
    example: 'zalo-user-12345',
    description: 'Provider-specific user ID',
  })
  providerId: string;

  @ApiPropertyOptional({
    example: 'user@gmail.com',
    description: 'Email from OAuth provider',
  })
  email?: string;

  @ApiPropertyOptional({
    example: 'Nguyễn Văn A',
    description: 'Display name from OAuth provider',
  })
  name?: string;

  @ApiPropertyOptional({
    example: '0901234567',
    description: 'Phone number (only for Zalo with phone_number scope granted)',
  })
  phoneNumber?: string;
}

export class SwaggerLinkProviderDto {
  @ApiProperty({
    enum: ['phone', 'zalo', 'google', 'facebook', 'apple'],
    example: 'google',
    description: 'Provider type to link',
  })
  providerType: string;

  @ApiProperty({
    example: 'google-user-abc',
    description: 'Provider-specific user ID',
  })
  providerId: string;

  @ApiPropertyOptional({
    example: 'user@gmail.com',
    description: 'Email associated with the provider',
  })
  providerEmail?: string;
}

// =============================================================================
// Response DTOs
// =============================================================================

export class SwaggerProviderDto {
  @ApiProperty({ example: 'zalo', description: 'Provider type' })
  providerType: string;

  @ApiProperty({ example: 'zalo-user-12345', description: 'Provider user ID' })
  providerId: string;

  @ApiProperty({ example: true, description: 'Whether provider is verified' })
  isVerified: boolean;
}

export class SwaggerAuthResponseDto {
  @ApiProperty({ example: 'usr_01HXYZ123', description: 'Unique user ID' })
  userId: string;

  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Display name' })
  name: string | null;

  @ApiProperty({ example: 'user@gmail.com', description: 'Email address' })
  email: string | null;

  @ApiProperty({ example: '0901234567', description: 'Phone number' })
  phone: string | null;

  @ApiProperty({ example: 'customer', description: 'User role' })
  role: string;

  @ApiProperty({ example: 'active', description: 'Account status' })
  status: string;

  @ApiProperty({
    type: [SwaggerProviderDto],
    description: 'Linked authentication providers',
  })
  providers: SwaggerProviderDto[];
}

export class SwaggerVerifyOtpResponseDto extends SwaggerAuthResponseDto {
  @ApiProperty({ example: true, description: 'Whether this is a newly created user' })
  isNewUser: boolean;
}

export class SwaggerProviderCallbackResponseDto extends SwaggerAuthResponseDto {
  @ApiProperty({ example: true, description: 'Whether this is a newly created user' })
  isNewUser: boolean;

  @ApiProperty({
    required: false,
    example: 'phone',
    description: 'How accounts were merged (phone or email match)',
  })
  mergedVia?: string;
}

export class SwaggerLinkProviderResponseDto {
  @ApiProperty({ example: 'usr_01HXYZ123', description: 'User ID' })
  userId: string;

  @ApiProperty({ example: 'Provider linked successfully' })
  message: string;
}
