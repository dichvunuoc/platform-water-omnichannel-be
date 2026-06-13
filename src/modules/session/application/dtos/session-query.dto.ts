import { z } from 'zod';
import { SessionEventSchema, SessionMetadataSchema } from './session-event.dto';
import { ChannelTypeSchema } from '../../domain/events/session-event.types';

export const SessionEventsQuerySchema = z.object({
  from: z.coerce.number().int().optional(),       // Unix timestamp ms
  to: z.coerce.number().int().optional(),          // Unix timestamp ms
  channel: ChannelTypeSchema.optional(),           // Filter by channel
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});
export type SessionEventsQuery = z.infer<typeof SessionEventsQuerySchema>;

export const SessionEventsResponseSchema = z.object({
  sessionId: z.string().nullable(),
  events: z.array(SessionEventSchema),
  totalCount: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type SessionEventsResponse = z.infer<typeof SessionEventsResponseSchema>;

export const SessionDetailResponseSchema = z.object({
  session: SessionMetadataSchema.nullable(),
  recentEvents: z.array(SessionEventSchema),
});
export type SessionDetailResponse = z.infer<typeof SessionDetailResponseSchema>;
