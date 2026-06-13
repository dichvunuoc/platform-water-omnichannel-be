import { KnowledgeBaseController } from './knowledge-base.controller';
import { ValidationException } from '@core/common';
import { GetKbCategoriesQuery } from '../../application/queries/get-kb-categories.query';
import { SearchArticlesQuery } from '../../application/queries/search-articles.query';
import { GetArticleQuery } from '../../application/queries/get-article.query';
import { RateArticleCommand } from '../../application/commands/rate-article.command';

function mockBuses() {
  return { commandBus: { execute: jest.fn() }, queryBus: { execute: jest.fn() } };
}

describe('KnowledgeBaseController', () => {
  let controller: KnowledgeBaseController;
  let buses: ReturnType<typeof mockBuses>;

  const TEST_USER_ID = 'USR-SESSION-001';

  const mockCategoriesResponse = {
    categories: [
      { id: 'cat-1', name: 'Hóa đơn', slug: 'hoa-don', articleCount: 8 },
    ],
  };

  const mockSearchResponse = {
    articles: [
      { id: 'art-1', title: 'Test', summary: 'Summary', category: 'hoa-don', relevanceScore: 0.9 },
    ],
    total: 1,
    query: 'hóa đơn',
  };

  const mockArticleResponse = {
    id: 'art-1',
    title: 'Test Article',
    content: 'Content',
    category: 'hoa-don',
    author: 'Ban CSKH',
    updatedAt: '2026-05-15T10:00:00Z',
  };

  const mockRatingResponse = {
    articleId: 'art-1',
    helpful: true,
    ratedAt: '2026-06-10T16:00:00Z',
  };

  beforeEach(() => {
    buses = mockBuses();
    controller = new KnowledgeBaseController(buses.queryBus as any, buses.commandBus as any);
  });

  // ── GET /knowledge-base/categories (AC#1) ──────────────────────────────────

  describe('GET /knowledge-base/categories', () => {
    it('should dispatch GetKbCategoriesQuery and return categories', async () => {
      buses.queryBus.execute.mockResolvedValue(mockCategoriesResponse);

      const result = await controller.getCategories();

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetKbCategoriesQuery);
      expect(result.categories).toHaveLength(1);
    });
  });

  // ── GET /knowledge-base/search (AC#2) ──────────────────────────────────────

  describe('GET /knowledge-base/search', () => {
    it('should dispatch SearchArticlesQuery with query params', async () => {
      buses.queryBus.execute.mockResolvedValue(mockSearchResponse);

      const result = await controller.searchArticles({ q: 'hóa đơn' });

      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(SearchArticlesQuery);
      expect(callArg.query).toBe('hóa đơn');
      expect(result.articles).toHaveLength(1);
    });

    it('should pass Vietnamese query without diacritics unchanged', async () => {
      buses.queryBus.execute.mockResolvedValue(mockSearchResponse);

      await controller.searchArticles({ q: 'hoa don' });

      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg.query).toBe('hoa don');
    });

    it('should pass category filter', async () => {
      buses.queryBus.execute.mockResolvedValue(mockSearchResponse);

      await controller.searchArticles({ q: 'test', category: 'thanh-toan' });

      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg.category).toBe('thanh-toan');
    });

    it('should pass pagination params', async () => {
      buses.queryBus.execute.mockResolvedValue(mockSearchResponse);

      await controller.searchArticles({ q: 'test', page: '2', pageSize: '5' });

      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg.page).toBe(2);
      expect(callArg.pageSize).toBe(5);
    });

    it('should apply defaults when no pagination provided', async () => {
      buses.queryBus.execute.mockResolvedValue(mockSearchResponse);

      await controller.searchArticles({ q: 'test' });

      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg.page).toBe(1);
      expect(callArg.pageSize).toBe(10);
    });
  });

  // ── GET /knowledge-base/articles/:articleId (AC#3) ─────────────────────────

  describe('GET /knowledge-base/articles/:articleId', () => {
    it('should dispatch GetArticleQuery and return article detail', async () => {
      buses.queryBus.execute.mockResolvedValue(mockArticleResponse);

      const result = await controller.getArticle('art-1');

      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetArticleQuery);
      expect(callArg.articleId).toBe('art-1');
      expect(result.id).toBe('art-1');
    });

    it('should throw ValidationException for empty articleId', async () => {
      await expect(controller.getArticle('')).rejects.toThrow(ValidationException);
    });
  });

  // ── POST /knowledge-base/articles/:articleId/rate (AC#4) ───────────────────

  describe('POST /knowledge-base/articles/:articleId/rate', () => {
    it('should dispatch RateArticleCommand and return result', async () => {
      buses.commandBus.execute.mockResolvedValue(mockRatingResponse);

      const result = await controller.rateArticle(TEST_USER_ID, 'art-1', { helpful: true });

      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(RateArticleCommand);
      expect(callArg.articleId).toBe('art-1');
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.helpful).toBe(true);
      expect(result.helpful).toBe(true);
    });

    it('should pass helpful: false', async () => {
      buses.commandBus.execute.mockResolvedValue({ ...mockRatingResponse, helpful: false });

      await controller.rateArticle(TEST_USER_ID, 'art-1', { helpful: false });

      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg.helpful).toBe(false);
    });
  });

  // ── Body validation — search ───────────────────────────────────────────────

  describe('Body validation — search', () => {
    it('should throw ValidationException for missing q', async () => {
      await expect(controller.searchArticles({})).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for empty q', async () => {
      await expect(controller.searchArticles({ q: '' })).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for q exceeding 200 chars', async () => {
      await expect(
        controller.searchArticles({ q: 'A'.repeat(201) }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for non-numeric page', async () => {
      await expect(
        controller.searchArticles({ q: 'test', page: 'abc' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for non-numeric pageSize', async () => {
      await expect(
        controller.searchArticles({ q: 'test', pageSize: 'xyz' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for pageSize exceeding 50', async () => {
      await expect(
        controller.searchArticles({ q: 'test', pageSize: 51 }),
      ).rejects.toThrow(ValidationException);
    });
  });

  // ── Body validation — rate ─────────────────────────────────────────────────

  describe('Body validation — rate', () => {
    it('should throw ValidationException for missing helpful', async () => {
      await expect(
        controller.rateArticle(TEST_USER_ID, 'art-1', {}),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for helpful: "yes"', async () => {
      await expect(
        controller.rateArticle(TEST_USER_ID, 'art-1', { helpful: 'yes' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for empty articleId on rate', async () => {
      await expect(
        controller.rateArticle(TEST_USER_ID, '', { helpful: true }),
      ).rejects.toThrow(ValidationException);
    });
  });

  // ── CQRS class type verification ───────────────────────────────────────────

  describe('CQRS class types', () => {
    it('should dispatch GetKbCategoriesQuery', async () => {
      buses.queryBus.execute.mockResolvedValue(mockCategoriesResponse);
      await controller.getCategories();
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetKbCategoriesQuery);
    });

    it('should dispatch SearchArticlesQuery', async () => {
      buses.queryBus.execute.mockResolvedValue(mockSearchResponse);
      await controller.searchArticles({ q: 'test' });
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(SearchArticlesQuery);
    });

    it('should dispatch GetArticleQuery', async () => {
      buses.queryBus.execute.mockResolvedValue(mockArticleResponse);
      await controller.getArticle('art-1');
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetArticleQuery);
    });

    it('should dispatch RateArticleCommand', async () => {
      buses.commandBus.execute.mockResolvedValue(mockRatingResponse);
      await controller.rateArticle(TEST_USER_ID, 'art-1', { helpful: true });
      expect(buses.commandBus.execute.mock.calls[0][0]).toBeInstanceOf(RateArticleCommand);
    });
  });

  // ── Auth guard verification ────────────────────────────────────────────────

  describe('Auth protection', () => {
    it('should use ApiBearerAuth decorator for Swagger', () => {
      const metadata = Reflect.getMetadata('swagger/apiSecurity', KnowledgeBaseController);
      expect(metadata).toBeDefined();
    });
  });
});
