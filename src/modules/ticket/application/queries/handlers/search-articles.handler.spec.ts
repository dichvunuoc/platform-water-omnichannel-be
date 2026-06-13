import { SearchArticlesHandler } from './search-articles.handler';
import { SearchArticlesQuery } from '../search-articles.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('SearchArticlesHandler', () => {
  let handler: SearchArticlesHandler;
  let portRegistry: any;

  const mockSearchResponse = {
    articles: [
      { id: 'art-1', title: 'Hóa đơn', summary: 'Test', category: 'hoa-don', relevanceScore: 0.95 },
    ],
    total: 1,
    query: 'hóa đơn',
  };

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new SearchArticlesHandler(portRegistry);
  });

  describe('execute — success', () => {
    it('should call PortRegistry with query params', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockSearchResponse });

      const result = await handler.execute(new SearchArticlesQuery('hóa đơn'));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'knowledge-base', 'search-articles',
        { q: 'hóa đơn', category: undefined, page: undefined, pageSize: undefined },
      );
      expect(result.articles).toHaveLength(1);
    });

    it('should pass Vietnamese query unchanged (pure pass-through)', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockSearchResponse });

      await handler.execute(new SearchArticlesQuery('hoa don'));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'knowledge-base', 'search-articles',
        expect.objectContaining({ q: 'hoa don' }),
      );
    });

    it('should pass category filter', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockSearchResponse });

      await handler.execute(new SearchArticlesQuery('test', 'thanh-toan'));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'knowledge-base', 'search-articles',
        expect.objectContaining({ category: 'thanh-toan' }),
      );
    });

    it('should pass pagination params', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockSearchResponse });

      await handler.execute(new SearchArticlesQuery('test', undefined, 2, 5));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'knowledge-base', 'search-articles',
        expect.objectContaining({ page: 2, pageSize: 5 }),
      );
    });
  });

  describe('execute — null result', () => {
    it('should throw PortFallbackException when result.data is null', async () => {
      portRegistry.execute.mockResolvedValue({ data: null });

      await expect(handler.execute(new SearchArticlesQuery('test'))).rejects.toThrow(PortFallbackException);
    });
  });
});
