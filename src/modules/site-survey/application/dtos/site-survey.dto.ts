import { z } from 'zod';

export const SurveyResultSchema = z.object({
  surveyId: z.string(),
  customerId: z.string(),
  status: z.enum(['requested', 'scheduled', 'completed', 'cancelled']),
  scheduledAt: z.string().nullable(),
  result: z
    .object({ feasible: z.boolean(), notes: z.string() })
    .nullable(),
});
export type SurveyResult = z.infer<typeof SurveyResultSchema>;

export const CreateSurveyResultSchema = z.object({
  surveyId: z.string(),
  status: z.enum(['requested', 'scheduled']),
  scheduledAt: z.string().nullable(),
});
export type CreateSurveyResult = z.infer<typeof CreateSurveyResultSchema>;
