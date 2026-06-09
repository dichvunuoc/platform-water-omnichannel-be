/**
 * Customer Profile DTOs — Zod Schemas + TypeScript Types
 *
 * Defines the normalized response shapes for customer profile port calls.
 * AC: #1 (profile), #2 (timeline), #4 (related accounts)
 */

import { z } from 'zod';

// ── Customer Profile (AC#1) ─────────────────────────────────────────────────

export const CustomerProfileSchema = z.object({
  customerId: z.string(),
  fullName: z.string(),
  classification: z.enum(['sinh_hoat', 'san_xuat', 'hanh_chinh']),
  address: z.object({
    street: z.string(),
    ward: z.string(),
    district: z.string(),
    city: z.string(),
    fullAddress: z.string(),
  }),
  contactInfo: z.object({
    phone: z.string().nullable(),
    email: z.string().nullable(),
    contactAddress: z.string().nullable(),
  }),
  status: z.enum(['active', 'inactive', 'suspended']),
});

export type CustomerProfileResponse = z.infer<typeof CustomerProfileSchema>;

// ── Timeline Entry & Response (AC#2) ────────────────────────────────────────

export const TimelineEntrySchema = z.object({
  eventType: z.string(),
  timestamp: z.string(),
  summary: z.string(),
  channel: z.enum(['zalo', 'hotline', 'counter', 'web']).nullable(),
  referenceId: z.string().nullable(),
});

export const TimelineResponseSchema = z.object({
  entries: z.array(TimelineEntrySchema),
  totalCount: z.number(),
});

export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;
export type TimelineResponse = z.infer<typeof TimelineResponseSchema>;

// ── Related Accounts (AC#4) ─────────────────────────────────────────────────

export const RelatedAccountSchema = z.object({
  customerId: z.string(),
  name: z.string(),
  relationshipType: z.string(), // e.g. 'parent_kcn', 'member_factory', 'auxiliary_contact'
  address: z.string().nullable(),
  contactInfo: z.record(z.string(), z.string().nullable()),
});

export const RelatedAccountsResponseSchema = z.object({
  accounts: z.array(RelatedAccountSchema),
});

export type RelatedAccount = z.infer<typeof RelatedAccountSchema>;
export type RelatedAccountsResponse = z.infer<typeof RelatedAccountsResponseSchema>;

// ── Update Profile Response (AC#3) ──────────────────────────────────────────

export const UpdateProfileResponseSchema = z.object({
  customerId: z.string(),
  updatedFields: z.array(z.string()),
  updatedAt: z.string(),
});

export type UpdateProfileResponse = z.infer<typeof UpdateProfileResponseSchema>;
