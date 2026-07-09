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

export const NearbyIncidentSchema = z.object({
  id: z.string(),
  type: z.string(),
  address: z.string(),
  status: z.enum(['reported', 'in_progress', 'resolved']),
  distanceMeters: z.number(),
  updatedAt: z.string(),
});
export type NearbyIncident = z.infer<typeof NearbyIncidentSchema>;

export const GetNearbyIncidentsResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  incidents: z.array(NearbyIncidentSchema),
});
export type GetNearbyIncidentsResponse = z.infer<typeof GetNearbyIncidentsResponseSchema>;
