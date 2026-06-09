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

export const InvoiceListItemSchema = z.object({
  invoiceId: z.string(),
  contractId: z.string(),
  period: z.string(),
  totalAmount: z.number().nonnegative(),
  paymentStatus: z.enum(['paid', 'unpaid', 'overdue', 'cancelled']),
  issueDate: z.string(),
  dueDate: z.string().optional(),
});

export const InvoiceGetListSchema = z.object({
  invoices: z.array(InvoiceListItemSchema),
  totalCount: z.number(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number(),
});

export const InvoiceGetByIdSchema = z.object({
  invoiceId: z.string(),
  contractId: z.string(),
  period: z.string(),
  lineItems: z.array(z.object({
    description: z.string(),
    volume: z.number().nonnegative(),
    unitPrice: z.number().nonnegative(),
    amount: z.number().nonnegative(),
  })),
  subtotal: z.number().nonnegative(),
  fees: z.array(z.object({
    feeName: z.string(),
    amount: z.number().nonnegative(),
  })),
  totalAmount: z.number().nonnegative(),
  paymentStatus: z.enum(['paid', 'unpaid', 'overdue', 'cancelled']),
  cqtCode: z.string().nullable(),
  lookupCode: z.string().nullable(),
  issueDate: z.string(),
  dueDate: z.string().optional(),
});

export const InvoiceGetPdfSchema = z.object({
  invoiceId: z.string(),
  pdfUrl: z.string().url(),
  cqtCode: z.string(),
  lookupCode: z.string(),
  digitalSignature: z.string(),
});

// =============================================================================
// Schema Registry — maps port names + methods to Zod schemas
// =============================================================================

export const MOCK_SCHEMAS: Record<string, Record<string, z.ZodType<unknown>>> = {
  invoice: {
    'get-list': InvoiceGetListSchema,
    'get-by-id': InvoiceGetByIdSchema,
    'get-pdf': InvoiceGetPdfSchema,
  },
};
