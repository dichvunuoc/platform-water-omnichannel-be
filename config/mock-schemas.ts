/**
 * Shared Zod Schemas for Mock Data Validation
 *
 * Schemas used by MockAdapterBase to validate mock JSON files
 * against expected response shapes.
 *
 * AC: #6 — Contract Validation Gate (Fail-to-Start)
 */

import { z } from 'zod';

// =============================================================================
// Invoice Schemas
// =============================================================================

export const InvoiceItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number().nonnegative(),
  amount: z.number().nonnegative(),
});

export const InvoiceSchema = z.object({
  id: z.string(),
  contractId: z.string(),
  customerId: z.string(),
  period: z.string(),
  issueDate: z.string(),
  dueDate: z.string(),
  totalAmount: z.number().nonnegative(),
  currency: z.string(),
  status: z.enum(['paid', 'unpaid', 'overdue', 'cancelled']),
  paidDate: z.string().optional(),
  waterUsage: z.number().nonnegative(),
  items: z.array(InvoiceItemSchema),
});

export const PaginationSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export const InvoiceGetListSchema = z.object({
  data: z.array(InvoiceSchema),
  pagination: PaginationSchema,
});

// =============================================================================
// Schema Registry — maps port names + methods to Zod schemas
// =============================================================================

export const MOCK_SCHEMAS: Record<string, Record<string, z.ZodType<unknown>>> = {
  invoice: {
    'get-list': InvoiceGetListSchema,
  },
};
