import { z } from 'zod';

export const CoverageResultSchema = z.object({
  address: z.string(),
  covered: z.boolean(),
  dma: z.string().nullable(),
  estimatedConnectionDays: z.number().int().nullable(),
});
export type CoverageResult = z.infer<typeof CoverageResultSchema>;

export const GetCustomerLocationResponseSchema = z.object({
  customerId: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  address: z.string(),
});
export type GetCustomerLocationResponse = z.infer<typeof GetCustomerLocationResponseSchema>;
