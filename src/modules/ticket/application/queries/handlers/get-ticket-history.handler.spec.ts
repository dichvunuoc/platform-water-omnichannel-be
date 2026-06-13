import { GetTicketHistoryHandler } from './get-ticket-history.handler';
import { GetTicketHistoryQuery } from '../get-ticket-history.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetTicketHistoryHandler', () => {
  let handler: GetTicketHistoryHandler;
  let portRegistry: any;

  const mockHistoryResponse = {
    tickets: [
      {
        trackingId: 'TK-2026-002',
        type: 'water_outage',
        status: 'in_progress',
        createdAt: '2026-06-10T09:30:00Z',
        updatedAt: '2026-06-10T11:00:00Z',
      },
      {
        trackingId: 'TK-2026-001',
        type: 'leak',
        status: 'closed',
        createdAt: '2026-05-20T14:00:00Z',
        updatedAt: '2026-05-22T09:00:00Z',
      },
    ],
    total: 2,
    page: 1,
    pageSize: 10,
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    };
    handler = new GetTicketHistoryHandler(portRegistry);
  });

  const TEST_CUSTOMER_ID = 'USR-SESSION-001';

  // ── Success path ───────────────────────────────────────────────────────────

  describe('execute — success', () => {
    it('should call PortRegistry with correct params for get-ticket-history', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockHistoryResponse });

      const result = await handler.execute(
        new GetTicketHistoryQuery(TEST_CUSTOMER_ID),
      );

      expect(portRegistry.execute).toHaveBeenCalledTimes(1);
      expect(portRegistry.execute).toHaveBeenCalledWith(
        'ticket',
        'get-ticket-history',
        { customerId: TEST_CUSTOMER_ID, status: undefined, page: undefined, pageSize: undefined },
      );
      expect(result.tickets).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should pass status filter to PortRegistry', async () => {
      portRegistry.execute.mockResolvedValue({ data: { ...mockHistoryResponse, tickets: [mockHistoryResponse.tickets[0]], total: 1 } });

      const result = await handler.execute(
        new GetTicketHistoryQuery(TEST_CUSTOMER_ID, 'in_progress'),
      );

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'ticket',
        'get-ticket-history',
        expect.objectContaining({ status: 'in_progress' }),
      );
      expect(result.tickets).toHaveLength(1);
    });

    it('should pass pagination params to PortRegistry', async () => {
      portRegistry.execute.mockResolvedValue({ data: { ...mockHistoryResponse, page: 2, pageSize: 5 } });

      const result = await handler.execute(
        new GetTicketHistoryQuery(TEST_CUSTOMER_ID, undefined, 2, 5),
      );

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'ticket',
        'get-ticket-history',
        { customerId: TEST_CUSTOMER_ID, status: undefined, page: 2, pageSize: 5 },
      );
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(5);
    });

    it('should pass all params together', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockHistoryResponse });

      await handler.execute(
        new GetTicketHistoryQuery(TEST_CUSTOMER_ID, 'closed', 1, 20),
      );

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'ticket',
        'get-ticket-history',
        { customerId: TEST_CUSTOMER_ID, status: 'closed', page: 1, pageSize: 20 },
      );
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  describe('execute — null/undefined result', () => {
    it('should throw PortFallbackException when result.data is null', async () => {
      portRegistry.execute.mockResolvedValue({ data: null });

      await expect(
        handler.execute(new GetTicketHistoryQuery(TEST_CUSTOMER_ID)),
      ).rejects.toThrow(PortFallbackException);
    });

    it('should throw PortFallbackException when result is undefined', async () => {
      portRegistry.execute.mockResolvedValue(undefined);

      await expect(
        handler.execute(new GetTicketHistoryQuery(TEST_CUSTOMER_ID)),
      ).rejects.toThrow(PortFallbackException);
    });
  });
});
