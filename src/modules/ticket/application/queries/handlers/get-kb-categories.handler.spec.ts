import { GetKbCategoriesHandler } from './get-kb-categories.handler';
import { GetKbCategoriesQuery } from '../get-kb-categories.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetKbCategoriesHandler', () => {
  let handler: GetKbCategoriesHandler;
  let portRegistry: any;

  const mockCategoriesResponse = {
    categories: [
      { id: 'cat-1', name: 'Hóa đơn', slug: 'hoa-don', articleCount: 8 },
      { id: 'cat-2', name: 'Sự cố', slug: 'su-co', articleCount: 12 },
    ],
  };

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetKbCategoriesHandler(portRegistry);
  });

  describe('execute — success', () => {
    it('should call PortRegistry with knowledge-base port', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockCategoriesResponse });

      const result = await handler.execute(new GetKbCategoriesQuery());

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'knowledge-base', 'get-categories', {},
      );
      expect(result.categories).toHaveLength(2);
    });
  });

  describe('execute — null result', () => {
    it('should throw PortFallbackException when result.data is null', async () => {
      portRegistry.execute.mockResolvedValue({ data: null });

      await expect(handler.execute(new GetKbCategoriesQuery())).rejects.toThrow(PortFallbackException);
    });
  });
});
