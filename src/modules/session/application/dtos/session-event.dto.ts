import { z } from 'zod';
import { SessionEventTypeSchema, ChannelTypeSchema } from '../../domain/events/session-event.types';

export const SessionEventSchema = z.object({
  id: z.string().uuid(),
  type: SessionEventTypeSchema,
  channel: ChannelTypeSchema,
  timestamp: z.string(),
  content: z.record(z.string(), z.unknown()),
});
export type SessionEvent = z.infer<typeof SessionEventSchema>;

export const SessionMetadataSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().min(1),
  channel: ChannelTypeSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  eventCount: z.number().int().nonnegative(),
});
export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;

export const RecordSessionEventPayloadSchema = z.object({
  userId: z.string().min(1),
  eventType: SessionEventTypeSchema,
  channel: ChannelTypeSchema,
  content: z.record(z.string(), z.unknown()),
});
export type RecordSessionEventPayload = z.infer<typeof RecordSessionEventPayloadSchema>;
