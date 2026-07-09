import { z } from 'zod';

export const TeamEtaSchema = z.object({
  ticketId: z.string(),
  teamId: z.string(),
  etaMinutes: z.number().int().nonnegative(),
  status: z.enum(['assigned', 'en_route', 'on_site', 'completed']),
});
export type TeamEta = z.infer<typeof TeamEtaSchema>;

export const TeamLocationSchema = z.object({
  ticketId: z.string(),
  teamId: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  updatedAt: z.string(),
});
export type TeamLocation = z.infer<typeof TeamLocationSchema>;
