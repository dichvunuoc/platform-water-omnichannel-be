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
