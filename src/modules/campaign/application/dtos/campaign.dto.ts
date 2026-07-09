import { z } from 'zod';

export const CampaignSummarySchema = z.object({
  campaignId: z.string(),
  title: z.string(),
  audience: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
});

export const ActiveCampaignsResponseSchema = z.object({
  customerId: z.string(),
  campaigns: z.array(CampaignSummarySchema),
});
export type ActiveCampaignsResponse = z.infer<typeof ActiveCampaignsResponseSchema>;

export const CampaignDetailSchema = CampaignSummarySchema.extend({
  description: z.string(),
  termsUrl: z.string(),
});
export type CampaignDetail = z.infer<typeof CampaignDetailSchema>;
