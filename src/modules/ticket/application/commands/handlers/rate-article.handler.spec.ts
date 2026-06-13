import { RateArticleHandler } from './rate-article.handler';
import { RateArticleCommand } from '../rate-article.command';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('RateArticleHandler', () => {
  let handler: RateArticleHandler;
  let portRegistry: any;

  const mockRatingResponse = {
    articleId: 'art-1',
    helpful: true,
    ratedAt: '2026-06-10T16:00:00Z',
  };

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new RateArticleHandler(portRegistry);
  });

  const TEST_CUSTOMER_ID = 'USR-SESSION-001';

  describe('execute — success', () => {
    it('should call PortRegistry with useCache: false', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockRatingResponse });

      const result = await handler.execute(new RateArticleCommand('art-1', TEST_CUSTOMER_ID, true));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'knowledge-base', 'rate-article',
        { articleId: 'art-1', customerId: TEST_CUSTOMER_ID, helpful: true, useCache: false },
      );
      expect(result.helpful).toBe(true);
    });

    it('should pass helpful: false', async () => {
      portRegistry.execute.mockResolvedValue({ data: { ...mockRatingResponse, helpful: false } });

      const result = await handler.execute(new RateArticleCommand('art-1', TEST_CUSTOMER_ID, false));

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'knowledge-base', 'rate-article',
        expect.objectContaining({ helpful: false }),
      );
      expect(result.helpful).toBe(false);
    });
  });

  describe('execute — null result', () => {
    it('should throw PortFallbackException when result.data is null', async () => {
      portRegistry.execute.mockResolvedValue({ data: null });

      await expect(
        handler.execute(new RateArticleCommand('art-1', TEST_CUSTOMER_ID, true)),
      ).rejects.toThrow(PortFallbackException);
    });
  });
});
