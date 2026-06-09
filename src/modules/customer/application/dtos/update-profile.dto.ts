/**
 * Update Profile DTO — Zod Schema + TypeScript Type
 *
 * Request body schema for PUT /customers/profile (AC#3).
 * Only allows updating contact info — not identity data.
 * Requires at least one field to be present (no-op updates rejected).
 */

import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  contactAddress: z.string().min(1).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
