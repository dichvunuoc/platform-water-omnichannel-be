import { z } from 'zod';

const QualityStatus = z.enum(['safe', 'advisory', 'unsafe']);

export const QualityAtLocationSchema = z.object({
  location: z.string(),
  testedAt: z.string(),
  turbidity: z.number(),
  chlorine: z.number(),
  ph: z.number(),
  status: QualityStatus,
});
export type QualityAtLocation = z.infer<typeof QualityAtLocationSchema>;

export const QualityAlertSchema = z.object({
  alertId: z.string(),
  area: z.string(),
  parameter: z.string(),
  value: z.number(),
  limit: z.number(),
  issuedAt: z.string(),
  status: z.enum(['active', 'resolved']),
});
export type QualityAlert = z.infer<typeof QualityAlertSchema>;

export const QualityAlertsResponseSchema = z.object({
  alerts: z.array(QualityAlertSchema),
});
export type QualityAlertsResponse = z.infer<typeof QualityAlertsResponseSchema>;
