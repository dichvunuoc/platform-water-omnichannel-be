import { GetArticleHandler } from './get-article.handler';
import { GetArticleQuery } from '../get-article.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetArticleHandler', () => {
  let handler: GetArticleHandler;
  let portRegistry: any;

  const mockArticleResponse = {
    id: 'art-1',
    title: 'Hướng dẫn thanh toán',
    content: '## Content here',
    category: 'thanh-toan',
    author: 'Ban CSKH',
    updatedAt: '2026-05-15T10:00:00Z',
  };

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetArticleHandler(portRegistry);
  });

  describe('execute — success', () => {
    it('should call PortRegistry with articleId', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockArticleResponse });

      const result = await handler.execute(new GetArticleQuery('art-1'));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'knowledge-base', 'get-article',
        { articleId: 'art-1' },
      );
      expect(result.id).toBe('art-1');
      expect(result.title).toBe('Hướng dẫn thanh toán');
    });

    it('should pass any articleId to port without validation', async () => {
      portRegistry.execute.mockResolvedValue({ data: { ...mockArticleResponse, id: 'art-999' } });

      const result = await handler.execute(new GetArticleQuery('art-999'));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'knowledge-base', 'get-article',
        { articleId: 'art-999' },
      );
      expect(result.id).toBe('art-999');
    });

    it('should return all article detail fields', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockArticleResponse });

      const result = await handler.execute(new GetArticleQuery('art-1'));

      expect(result).toEqual({
        id: 'art-1',
        title: 'Hướng dẫn thanh toán',
        content: '## Content here',
        category: 'thanh-toan',
        author: 'Ban CSKH',
        updatedAt: '2026-05-15T10:00:00Z',
      });
    });
  });

  describe('execute — null result', () => {
    it('should throw PortFallbackException when result.data is null', async () => {
      portRegistry.execute.mockResolvedValue({ data: null });

      await expect(handler.execute(new GetArticleQuery('art-1'))).rejects.toThrow(PortFallbackException);
    });
  });
});
