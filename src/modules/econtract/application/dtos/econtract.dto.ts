import { z } from 'zod';

export const EcontractResponseSchema = z.object({
  dossierId: z.string(),
  customerId: z.string(),
  status: z.enum(['draft', 'pending_signature', 'signed', 'expired']),
  downloadUrl: z.string().nullable(),
  signedAt: z.string().nullable(),
});
export type EcontractResponse = z.infer<typeof EcontractResponseSchema>;

export const SignContractResultSchema = z.object({
  dossierId: z.string(),
  status: z.enum(['signed', 'failed']),
  signedAt: z.string(),
});
export type SignContractResult = z.infer<typeof SignContractResultSchema>;
