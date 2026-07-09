import { z } from 'zod';

export const ClickToCallResultSchema = z.object({
  callId: z.string(),
  status: z.enum(['initiated', 'connecting', 'failed']),
  phoneNumber: z.string(),
});
export type ClickToCallResult = z.infer<typeof ClickToCallResultSchema>;

export const CallHistorySchema = z.object({
  customerId: z.string(),
  calls: z.array(
    z.object({
      callId: z.string(),
      startedAt: z.string(),
      durationSec: z.number().int().nonnegative(),
      outcome: z.enum(['completed', 'missed', 'voicemail']),
    }),
  ),
});
export type CallHistory = z.infer<typeof CallHistorySchema>;
