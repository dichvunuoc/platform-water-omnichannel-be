/**
 * Knowledge Base DTOs — Zod Schemas + TypeScript Types
 *
 * AC#1: Categories (FR48)
 * AC#2: Article Search (FR47) — PURE PASS-THROUGH, no BFF search logic
 * AC#3: Article Detail (FR48)
 * AC#4: Article Rating (FR49)
 *
 * IMPORTANT: BFF does NOT implement search logic, Vietnamese processing,
 * or article filtering. All of that is downstream KB Service responsibility.
 */

import { z } from 'zod';

// =============================================================================
// AC#1: FAQ Categories (FR48)
// =============================================================================

export const KbCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  articleCount: z.number(),
});
export type KbCategory = z.infer<typeof KbCategorySchema>;

export const GetCategoriesResponseSchema = z.object({
  categories: z.array(KbCategorySchema),
});
export type GetCategoriesResponse = z.infer<typeof GetCategoriesResponseSchema>;

// =============================================================================
// AC#2: Article Search (FR47 — pure pass-through)
// =============================================================================

export const SearchArticlesQuerySchema = z.object({
  q: z.string().min(1).max(200),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type SearchArticlesQueryParams = z.infer<typeof SearchArticlesQuerySchema>;

export const KbArticleSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  category: z.string(),
  relevanceScore: z.number().optional(),
});
export type KbArticleSummary = z.infer<typeof KbArticleSummarySchema>;

export const SearchArticlesResponseSchema = z.object({
  articles: z.array(KbArticleSummarySchema),
  total: z.number(),
  query: z.string(),
});
export type SearchArticlesResponse = z.infer<typeof SearchArticlesResponseSchema>;

// =============================================================================
// AC#3: Article Detail (FR48)
// =============================================================================

export const KbArticleDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  category: z.string(),
  author: z.string(),
  updatedAt: z.string(),
});
export type KbArticleDetail = z.infer<typeof KbArticleDetailSchema>;

// =============================================================================
// AC#4: Article Rating (FR49)
// =============================================================================

export const RateArticleRequestSchema = z.object({
  helpful: z.boolean(),
});
export type RateArticleRequest = z.infer<typeof RateArticleRequestSchema>;

export const RateArticleResponseSchema = z.object({
  articleId: z.string(),
  helpful: z.boolean(),
  ratedAt: z.string(),
});
export type RateArticleResponse = z.infer<typeof RateArticleResponseSchema>;
