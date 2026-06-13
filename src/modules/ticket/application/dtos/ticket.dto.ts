/**
 * Ticket DTOs — Zod Schemas + TypeScript Types
 *
 * Story 5.1: AC#1 Incident Type, AC#2 Upload URL, AC#3/#4 Create Ticket
 * Story 5.2: AC#1 Ticket Status/Timeline, AC#2 Ticket History, AC#3 Webhook Payload
 */

import { z } from 'zod';

// =============================================================================
// AC#1: Incident Type Enum (FR41)
// =============================================================================

export const IncidentTypeSchema = z.enum([
  'water_outage',
  'leak',
  'water_quality',
  'meter_issue',
  'other',
]);
export type IncidentType = z.infer<typeof IncidentTypeSchema>;

// =============================================================================
// AC#1,#3,#4: Create Ticket Request (controller input)
// =============================================================================

export const CreateTicketRequestSchema = z.object({
  type: IncidentTypeSchema,
  description: z.string().min(1).max(2000),
  imageUrls: z.array(z.string().url()).max(5).optional(),
});
export type CreateTicketRequest = z.infer<typeof CreateTicketRequestSchema>;

// =============================================================================
// AC#3,#4: Create Ticket Response (port response)
// =============================================================================

export const TicketStatusEnum = z.enum([
  'submitted', 'assigned', 'in_progress', 'resolved', 'closed',
]);
export type TicketStatus = z.infer<typeof TicketStatusEnum>;

export const CreateTicketResponseSchema = z.object({
  trackingId: z.string().regex(/^TK-\d{4}-\d+$/, 'Invalid tracking ID format'),
  status: TicketStatusEnum,
  createdAt: z.string(),
});
export type CreateTicketResponse = z.infer<typeof CreateTicketResponseSchema>;

// =============================================================================
// AC#2: Get Upload URL Request (controller input)
// =============================================================================

export const GetUploadUrlRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});
export type GetUploadUrlRequest = z.infer<typeof GetUploadUrlRequestSchema>;

// =============================================================================
// AC#2: Get Upload URL Response (port response)
// =============================================================================

export const GetUploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  fileKey: z.string(),
  expiresAt: z.string(),
});
export type GetUploadUrlResponse = z.infer<typeof GetUploadUrlResponseSchema>;

// =============================================================================
// Story 5.2 — AC#1: Ticket Status & Timeline (FR43 — tracking detail)
// (TicketStatusEnum defined above — shared with CreateTicketResponseSchema)
// =============================================================================

export const TicketTimelineEntrySchema = z.object({
  status: TicketStatusEnum,
  timestamp: z.string(),
  description: z.string().optional(),
  actor: z.string().optional(),
});
export type TicketTimelineEntry = z.infer<typeof TicketTimelineEntrySchema>;

export const TicketStatusResponseSchema = z.object({
  trackingId: z.string(),
  status: TicketStatusEnum,
  timeline: z.array(TicketTimelineEntrySchema).min(1),
  eta: z.string().nullable(),
  assignedTeam: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TicketStatusResponse = z.infer<typeof TicketStatusResponseSchema>;

// =============================================================================
// Story 5.2 — AC#2: Ticket History (FR46 — list all tickets)
// =============================================================================

export const TicketSummarySchema = z.object({
  trackingId: z.string(),
  type: IncidentTypeSchema,
  status: TicketStatusEnum,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TicketSummary = z.infer<typeof TicketSummarySchema>;

export const TicketHistoryResponseSchema = z.object({
  tickets: z.array(TicketSummarySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type TicketHistoryResponse = z.infer<typeof TicketHistoryResponseSchema>;

export const TicketHistoryQuerySchema = z.object({
  status: TicketStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type TicketHistoryQuery = z.infer<typeof TicketHistoryQuerySchema>;

// =============================================================================
// Story 5.2 — AC#3: Ticket Webhook Payload (FR44 — status change)
// =============================================================================

export const TicketWebhookPayloadSchema = z.object({
  ticketId: z.string(),
  trackingId: z.string(),
  customerId: z.string(),
  oldStatus: TicketStatusEnum,
  newStatus: TicketStatusEnum,
  updatedAt: z.string(),
});
export type TicketWebhookPayload = z.infer<typeof TicketWebhookPayloadSchema>;

// =============================================================================
// Story 5.3 — AC#1,#2,#3: CSAT Feedback (FR45)
// =============================================================================

/** CSAT score: 1-5 stars */
export const CsatScoreSchema = z.number().int().min(1).max(5);
export type CsatScore = z.infer<typeof CsatScoreSchema>;

/** Low score threshold — scores below this trigger follow-up flagging */
export const CSAT_LOW_SCORE_THRESHOLD = 3;

/** Controller input: submit feedback request */
export const SubmitFeedbackRequestSchema = z.object({
  score: CsatScoreSchema,
  comment: z.string().max(1000).optional(),
});
export type SubmitFeedbackRequest = z.infer<typeof SubmitFeedbackRequestSchema>;

/** Port response: feedback submission result */
export const SubmitFeedbackResponseSchema = z.object({
  ticketId: z.string(),
  score: CsatScoreSchema,
  submittedAt: z.string(),
});
export type SubmitFeedbackResponse = z.infer<typeof SubmitFeedbackResponseSchema>;
