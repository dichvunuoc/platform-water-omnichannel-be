import { MockKnowledgeBaseAdapter } from './knowledge-base.port';
import {
  GetCategoriesResponseSchema,
  SearchArticlesResponseSchema,
  KbArticleDetailSchema,
  RateArticleResponseSchema,
  SearchArticlesQuerySchema,
  RateArticleRequestSchema,
  KbCategorySchema,
  KbArticleSummarySchema,
} from '../../application/dtos/knowledge-base.dto';

describe('MockKnowledgeBaseAdapter', () => {
  let adapter: MockKnowledgeBaseAdapter;

  beforeEach(() => {
    adapter = new MockKnowledgeBaseAdapter();
  });

  // ── AC#1: get-categories ────────────────────────────────────────────────────

  describe('execute - get-categories', () => {
    it('should read and validate get-categories.json mock data', async () => {
      const result = await adapter.execute('get-categories', {});

      expect(result).toBeDefined();
      const parsed = GetCategoriesResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.categories).toHaveLength(5);
        parsed.data.categories.forEach((cat) => {
          expect(cat.id).toBeDefined();
          expect(cat.name).toBeDefined();
          expect(cat.slug).toBeDefined();
          expect(cat.articleCount).toBeGreaterThanOrEqual(0);
        });
      }
    });

    it('should return Vietnamese category names', async () => {
      const result = await adapter.execute('get-categories', {});

      const parsed = GetCategoriesResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        const names = parsed.data.categories.map((c) => c.name);
        expect(names).toContain('Hóa đơn');
        expect(names).toContain('Sự cố');
        expect(names).toContain('Thanh toán');
      }
    });
  });

  // ── AC#2: search-articles ──────────────────────────────────────────────────

  describe('execute - search-articles', () => {
    it('should read and validate search-articles.json mock data', async () => {
      const result = await adapter.execute('search-articles', { q: 'hóa đơn' });

      expect(result).toBeDefined();
      const parsed = SearchArticlesResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.articles.length).toBeGreaterThan(0);
        expect(parsed.data.total).toBeGreaterThan(0);
        expect(parsed.data.query).toBeDefined();
      }
    });

    it('should return articles with relevance scores', async () => {
      const result = await adapter.execute('search-articles', { q: 'hóa đơn' });

      const parsed = SearchArticlesResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        parsed.data.articles.forEach((article) => {
          expect(article.id).toBeDefined();
          expect(article.title).toBeDefined();
          expect(article.summary).toBeDefined();
          expect(article.category).toBeDefined();
        });
      }
    });
  });

  // ── AC#3: get-article ──────────────────────────────────────────────────────

  describe('execute - get-article', () => {
    it('should read and validate get-article.json mock data', async () => {
      const result = await adapter.execute('get-article', { articleId: 'art-1' });

      expect(result).toBeDefined();
      const parsed = KbArticleDetailSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.id).toBe('art-1');
        expect(parsed.data.title).toBeDefined();
        expect(parsed.data.content).toBeDefined();
        expect(parsed.data.category).toBeDefined();
        expect(parsed.data.author).toBeDefined();
        expect(parsed.data.updatedAt).toBeDefined();
      }
    });
  });

  // ── AC#4: rate-article ─────────────────────────────────────────────────────

  describe('execute - rate-article', () => {
    it('should read and validate rate-article.json mock data', async () => {
      const result = await adapter.execute('rate-article', {
        articleId: 'art-1',
        customerId: 'USR-001',
        helpful: true,
      });

      expect(result).toBeDefined();
      const parsed = RateArticleResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.articleId).toBe('art-1');
        expect(parsed.data.helpful).toBe(true);
        expect(parsed.data.ratedAt).toBeDefined();
      }
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  describe('execute - missing method', () => {
    it('should throw for missing mock file', async () => {
      await expect(adapter.execute('nonexistent', {})).rejects.toThrow();
    });
  });

  // ── Schema validation: SearchArticlesQuerySchema ───────────────────────────

  describe('SearchArticlesQuerySchema', () => {
    it('should accept valid search query', () => {
      const result = SearchArticlesQuerySchema.safeParse({ q: 'hóa đơn' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.q).toBe('hóa đơn');
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(10);
      }
    });

    it('should accept Vietnamese without diacritics', () => {
      const result = SearchArticlesQuerySchema.safeParse({ q: 'hoa don' });
      expect(result.success).toBe(true);
    });

    it('should accept category filter', () => {
      const result = SearchArticlesQuerySchema.safeParse({ q: 'test', category: 'thanh-toan' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe('thanh-toan');
      }
    });

    it('should reject missing query', () => {
      expect(SearchArticlesQuerySchema.safeParse({}).success).toBe(false);
    });

    it('should reject empty query', () => {
      expect(SearchArticlesQuerySchema.safeParse({ q: '' }).success).toBe(false);
    });

    it('should reject query exceeding 200 chars', () => {
      expect(SearchArticlesQuerySchema.safeParse({ q: 'A'.repeat(201) }).success).toBe(false);
    });
  });

  // ── Schema validation: RateArticleRequestSchema ────────────────────────────

  describe('RateArticleRequestSchema', () => {
    it('should accept helpful: true', () => {
      const result = RateArticleRequestSchema.safeParse({ helpful: true });
      expect(result.success).toBe(true);
    });

    it('should accept helpful: false', () => {
      const result = RateArticleRequestSchema.safeParse({ helpful: false });
      expect(result.success).toBe(true);
    });

    it('should reject missing helpful', () => {
      expect(RateArticleRequestSchema.safeParse({}).success).toBe(false);
    });

    it('should reject string "yes"', () => {
      expect(RateArticleRequestSchema.safeParse({ helpful: 'yes' }).success).toBe(false);
    });
  });
});
