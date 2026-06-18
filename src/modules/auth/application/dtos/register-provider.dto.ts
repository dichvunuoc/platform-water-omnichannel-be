import { z } from 'zod';

/**
 * OAuth Provider Registration Request DTO
 * Zod schema for validating OAuth provider registration input.
 */
export const RegisterProviderSchema = z.object({
  providerType: z.enum(['phone', 'zalo', 'google', 'facebook', 'apple']),
  providerId: z.string().min(1).max(255),
  email: z.string().email().optional(),
  name: z.string().min(1).max(255).optional(),
  phoneNumber: z.string().optional(), // Only for Zalo with phone_number scope
  /**
   * OAuth `state` value (opaque nonce). For the Zalo OA Account Linking flow,
   * this is the single-use nonce that maps back to the sender's zalo_user_id.
   * Ignored for non-Zalo providers.
   */
  state: z.string().min(1).max(512).optional(),
});

export type RegisterProviderDto = z.infer<typeof RegisterProviderSchema>;

/**
 * Link Provider Request DTO
 * Zod schema for linking additional provider to existing user.
 */
export const LinkProviderSchema = z.object({
  providerType: z.enum(['phone', 'zalo', 'google', 'facebook', 'apple']),
  providerId: z.string().min(1).max(255),
  providerEmail: z.string().email().optional(),
});

export type LinkProviderDto = z.infer<typeof LinkProviderSchema>;

/**
 * OTP Verification Request DTO
 */
export const VerifyOtpSchema = z.object({
  phoneNumber: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
});

export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;
