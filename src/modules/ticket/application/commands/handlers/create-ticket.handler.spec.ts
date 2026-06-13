import { CreateTicketHandler } from './create-ticket.handler';
import { CreateTicketCommand } from '../create-ticket.command';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('CreateTicketHandler', () => {
  let handler: CreateTicketHandler;
  let portRegistry: any;

  const mockTicketResponse = {
    trackingId: 'TK-2026-002',
    status: 'submitted',
    createdAt: '2026-06-10T09:30:00Z',
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    };
    handler = new CreateTicketHandler(portRegistry);
  });

  const TEST_CUSTOMER_ID = 'USR-SESSION-001';

  // ── Success path ───────────────────────────────────────────────────────────

  describe('execute — success', () => {
    it('should call PortRegistry with correct params including useCache: false', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockTicketResponse });

      const result = await handler.execute(
        new CreateTicketCommand(TEST_CUSTOMER_ID, 'water_outage', 'No water since morning'),
      );

      expect(portRegistry.execute).toHaveBeenCalledTimes(1);
      expect(portRegistry.execute).toHaveBeenCalledWith(
        'ticket',
        'create-ticket',
        expect.objectContaining({
          customerId: TEST_CUSTOMER_ID,
          type: 'water_outage',
          description: 'No water since morning',
          priority: 'normal',
          useCache: false,
        }),
      );
      expect(result.trackingId).toBe('TK-2026-002');
      expect(result.status).toBe('submitted');
    });

    it('should pass imageUrls when provided', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockTicketResponse });

      await handler.execute(
        new CreateTicketCommand(
          TEST_CUSTOMER_ID,
          'leak',
          'Pipe burst',
          ['https://storage.ioc.local/img1.jpg', 'https://storage.ioc.local/img2.jpg'],
        ),
      );

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'ticket',
        'create-ticket',
        expect.objectContaining({
          imageUrls: ['https://storage.ioc.local/img1.jpg', 'https://storage.ioc.local/img2.jpg'],
        }),
      );
    });

    it('should not include imageUrls in params when undefined', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockTicketResponse });

      await handler.execute(
        new CreateTicketCommand(TEST_CUSTOMER_ID, 'meter_issue', 'Meter broken'),
      );

      const callArgs = portRegistry.execute.mock.calls[0][2];
      expect(callArgs.imageUrls).toBeUndefined();
    });

    it('should handle each incident type', async () => {
      const types = ['water_outage', 'leak', 'water_quality', 'meter_issue', 'other'] as const;

      for (const type of types) {
        portRegistry.execute.mockResolvedValue({ data: { ...mockTicketResponse, trackingId: `TK-2026-${type}` } });

        const result = await handler.execute(
          new CreateTicketCommand(TEST_CUSTOMER_ID, type, `${type} issue`),
        );

        expect(result.trackingId).toBeDefined();
      }

      expect(portRegistry.execute).toHaveBeenCalledTimes(5);
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  describe('execute — null/undefined result', () => {
    it('should throw PortFallbackException when result.data is null', async () => {
      portRegistry.execute.mockResolvedValue({ data: null });

      await expect(
        handler.execute(new CreateTicketCommand(TEST_CUSTOMER_ID, 'water_outage', 'Issue')),
      ).rejects.toThrow(PortFallbackException);
    });

    it('should throw PortFallbackException when result is undefined', async () => {
      portRegistry.execute.mockResolvedValue(undefined);

      await expect(
        handler.execute(new CreateTicketCommand(TEST_CUSTOMER_ID, 'water_outage', 'Issue')),
      ).rejects.toThrow(PortFallbackException);
    });
  });
});
