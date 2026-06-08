import { z } from 'zod';

/**
 * Phone Registration Request DTO
 * Zod schema for validating phone registration input.
 */
export const RegisterPhoneSchema = z.object({
  phoneNumber: z
    .string()
    .regex(
      /^(0[3|5|7|8|9])+([0-9]{8})$/,
      'Invalid Vietnamese phone number format',
    ),
  name: z.string().min(1).max(255).optional(),
});

export type RegisterPhoneDto = z.infer<typeof RegisterPhoneSchema>;
