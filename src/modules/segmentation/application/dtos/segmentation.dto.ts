import { z } from 'zod';

export const SegmentSchema = z.object({
  customerType: z.enum(['sinh_hoat', 'san_xuat', 'hanh_chinh', 'dich_vu', 'kcn']),
  valueSegment: z.enum(['VIP', 'large', 'medium', 'small']),
  area: z.string(),
  behaviorTags: z.array(z.string()),
});
export type Segment = z.infer<typeof SegmentSchema>;

export const GetSegmentsResponseSchema = z.object({
  customerId: z.string(),
  segment: SegmentSchema,
});
export type GetSegmentsResponse = z.infer<typeof GetSegmentsResponseSchema>;

export const CheckEligibilityResponseSchema = z.object({
  customerId: z.string(),
  campaignId: z.string(),
  eligible: z.boolean(),
  reasons: z.array(z.string()),
});
export type CheckEligibilityResponse = z.infer<typeof CheckEligibilityResponseSchema>;
