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

export const MarketingPreferenceResultSchema = z.object({
  customerId: z.string(),
  channels: z.object({
    push: z.boolean(),
    email: z.boolean(),
    sms: z.boolean(),
    zalo: z.boolean(),
  }),
  updatedAt: z.string(),
});
export type MarketingPreferenceResult = z.infer<typeof MarketingPreferenceResultSchema>;

export const MarketingMessagesResponseSchema = z.object({
  customerId: z.string(),
  messages: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      body: z.string(),
      sentAt: z.string(),
      read: z.boolean(),
    }),
  ),
});
export type MarketingMessagesResponse = z.infer<typeof MarketingMessagesResponseSchema>;
