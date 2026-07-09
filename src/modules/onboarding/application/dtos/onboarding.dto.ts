import { z } from 'zod';

export const OnboardingStage = z.enum([
  'submitted',
  'site_survey',
  'contract',
  'installation',
  'meter_activation',
  'completed',
  'rejected',
]);

export const OnboardingStatusSchema = z.object({
  requestId: z.string(),
  customerId: z.string(),
  stage: OnboardingStage,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OnboardingStatus = z.infer<typeof OnboardingStatusSchema>;

export const CreateOnboardingResultSchema = z.object({
  requestId: z.string(),
  stage: z.enum(['submitted', 'site_survey']),
  createdAt: z.string(),
});
export type CreateOnboardingResult = z.infer<typeof CreateOnboardingResultSchema>;

export const SubmitDocumentsResultSchema = z.object({
  requestId: z.string(),
  stage: z.enum(['site_survey', 'contract']),
  uploadedDocumentKeys: z.array(z.string()),
  updatedAt: z.string(),
});
export type SubmitDocumentsResult = z.infer<typeof SubmitDocumentsResultSchema>;
