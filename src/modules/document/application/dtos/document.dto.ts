/**
 * Document DTOs — Zod schemas + TypeScript types for the document port.
 *
 * Methods: get-upload-url, get-download-url, get-list.
 * Cache tier: transaction (NO CACHE) — presigned URLs are one-time use.
 */

import { z } from 'zod';

// ── get-upload-url ──────────────────────────────────────────────────────────

export const GetUploadUrlRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
});
export type GetUploadUrlRequest = z.infer<typeof GetUploadUrlRequestSchema>;

export const GetUploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  fileKey: z.string(),
  expiresAt: z.string(),
});
export type GetUploadUrlResponse = z.infer<typeof GetUploadUrlResponseSchema>;

// ── get-download-url ─────────────────────────────────────────────────────────

export const GetDownloadUrlRequestSchema = z.object({
  fileKey: z.string().min(1),
});
export type GetDownloadUrlRequest = z.infer<typeof GetDownloadUrlRequestSchema>;

export const GetDownloadUrlResponseSchema = z.object({
  downloadUrl: z.string().url(),
  fileKey: z.string(),
  expiresAt: z.string(),
});
export type GetDownloadUrlResponse = z.infer<typeof GetDownloadUrlResponseSchema>;

// ── get-list ──────────────────────────────────────────────────────────────────

export const DocumentListItemSchema = z.object({
  fileKey: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  uploadedAt: z.string(),
});
export type DocumentListItem = z.infer<typeof DocumentListItemSchema>;

export const DocumentListResponseSchema = z.object({
  documents: z.array(DocumentListItemSchema),
  total: z.number().int().nonnegative(),
});
export type DocumentListResponse = z.infer<typeof DocumentListResponseSchema>;
