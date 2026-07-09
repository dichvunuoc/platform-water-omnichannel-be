import { z } from 'zod';

const LeakageStatus = z.enum(['detected', 'investigating', 'confirmed', 'resolved']);

export const LeakageAlertsResponseSchema = z.object({
  customerId: z.string(),
  alerts: z.array(
    z.object({
      alertId: z.string(),
      customerId: z.string(),
      suspectedLocation: z.string(),
      confidence: z.number().min(0).max(1),
      status: LeakageStatus,
      detectedAt: z.string(),
    }),
  ),
});
export type LeakageAlertsResponse = z.infer<typeof LeakageAlertsResponseSchema>;

export const LeakageDetailSchema = z.object({
  alertId: z.string(),
  customerId: z.string(),
  suspectedLocation: z.string(),
  confidence: z.number().min(0).max(1),
  status: LeakageStatus,
  detectedAt: z.string(),
  description: z.string(),
  estimatedLossM3: z.number(),
});
export type LeakageDetail = z.infer<typeof LeakageDetailSchema>;

export const ScheduleInspectionResultSchema = z.object({
  alertId: z.string(),
  inspectionId: z.string(),
  teamId: z.string(),
  scheduledAt: z.string(),
});
export type ScheduleInspectionResult = z.infer<typeof ScheduleInspectionResultSchema>;

export const InspectionResultSchema = z.object({
  inspectionId: z.string(),
  alertId: z.string(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']),
  findings: z.string(),
  confirmedLeak: z.boolean(),
  resolvedAt: z.string().nullable(),
});
export type InspectionResult = z.infer<typeof InspectionResultSchema>;
