import { z } from 'zod';

export const SessionEventTypeSchema = z.enum([
  'zalo_message_received',
  'call_started',
  'call_completed',
  'ticket_created',
  'ticket_status_changed',
  'payment_completed',
  'payment_failed',
  'notification_sent',
  'invoice_viewed',
  'alert_acknowledged',
  'session_started',
  'session_continued',
]);
export type SessionEventType = z.infer<typeof SessionEventTypeSchema>;

export const ChannelTypeSchema = z.enum(['zalo', 'web', 'hotline', 'counter']);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;
