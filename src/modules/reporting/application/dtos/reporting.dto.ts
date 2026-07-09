import { z } from 'zod';

export const ConsumptionReportSchema = z.object({
  customerId: z.string(),
  period: z.string(),
  totalM3: z.number(),
  amount: z.number(),
  comparisonPercent: z.number(),
});
export type ConsumptionReport = z.infer<typeof ConsumptionReportSchema>;

export const ComparisonReportSchema = z.object({
  customerId: z.string(),
  comparisonType: z.enum(['previous_period', 'same_period_last_year', 'area_average']),
  current: z.number(),
  previous: z.number(),
  changePercent: z.number(),
});
export type ComparisonReport = z.infer<typeof ComparisonReportSchema>;

export const SavingsTipSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  potentialSavingM3: z.number(),
  potentialSavingVnd: z.number(),
});
export type SavingsTip = z.infer<typeof SavingsTipSchema>;

export const GetSavingsTipsResponseSchema = z.object({
  customerId: z.string(),
  tips: z.array(SavingsTipSchema),
});
export type GetSavingsTipsResponse = z.infer<typeof GetSavingsTipsResponseSchema>;

export const DownloadReportResultSchema = z.object({
  downloadUrl: z.string(),
  format: z.string(),
  expiresAt: z.string(),
});
export type DownloadReportResult = z.infer<typeof DownloadReportResultSchema>;
