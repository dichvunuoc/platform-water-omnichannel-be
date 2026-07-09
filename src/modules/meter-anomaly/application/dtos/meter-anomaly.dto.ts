import { z } from 'zod';

const AnomalyType = z.enum(['continuous_flow', 'backflow', 'no_flow', 'tamper']);
const Severity = z.enum(['low', 'medium', 'high']);

export const AnomalyAlertsResponseSchema = z.object({
  customerId: z.string(),
  alerts: z.array(
    z.object({
      alertId: z.string(),
      meterId: z.string(),
      type: AnomalyType,
      severity: Severity,
      detectedAt: z.string(),
    }),
  ),
});
export type AnomalyAlertsResponse = z.infer<typeof AnomalyAlertsResponseSchema>;

export const AnomalyDetailSchema = z.object({
  alertId: z.string(),
  meterId: z.string(),
  type: AnomalyType,
  severity: Severity,
  detectedAt: z.string(),
  description: z.string(),
  recommendedAction: z.string(),
});
export type AnomalyDetail = z.infer<typeof AnomalyDetailSchema>;
