import { GetTicketStatusHandler } from './get-ticket-status.handler';
import { GetTicketStatusQuery } from '../get-ticket-status.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetTicketStatusHandler', () => {
  let handler: GetTicketStatusHandler;
  let portRegistry: any;

  const mockStatusResponse = {
    trackingId: 'TK-2026-002',
    status: 'in_progress',
    timeline: [
      { status: 'submitted', timestamp: '2026-06-10T09:30:00Z', description: 'Incident reported by customer' },
      { status: 'assigned', timestamp: '2026-06-10T10:15:00Z', description: 'Assigned to technical team', actor: 'Đội kỹ thuật A' },
      { status: 'in_progress', timestamp: '2026-06-10T11:00:00Z', description: 'Team is investigating the issue', actor: 'Đội kỹ thuật A' },
    ],
    eta: '2026-06-10T17:00:00Z',
    assignedTeam: 'Đội kỹ thuật A',
    createdAt: '2026-06-10T09:30:00Z',
    updatedAt: '2026-06-10T11:00:00Z',
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    };
    handler = new GetTicketStatusHandler(portRegistry);
  });

  const TEST_TICKET_ID = 'TK-2026-002';

  // ── Success path ───────────────────────────────────────────────────────────

  describe('execute — success', () => {
    it('should call PortRegistry with correct params for get-ticket-status', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockStatusResponse });

      const result = await handler.execute(new GetTicketStatusQuery(TEST_TICKET_ID));

      expect(portRegistry.execute).toHaveBeenCalledTimes(1);
      expect(portRegistry.execute).toHaveBeenCalledWith(
        'ticket',
        'get-ticket-status',
        { ticketId: TEST_TICKET_ID },
      );
      expect(result.trackingId).toBe('TK-2026-002');
      expect(result.status).toBe('in_progress');
    });

    it('should return full timeline with entries', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockStatusResponse });

      const result = await handler.execute(new GetTicketStatusQuery(TEST_TICKET_ID));

      expect(result.timeline).toHaveLength(3);
      expect(result.timeline[0].status).toBe('submitted');
      expect(result.timeline[2].status).toBe('in_progress');
      expect(result.timeline[2].actor).toBe('Đội kỹ thuật A');
    });

    it('should return ETA and assigned team', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockStatusResponse });

      const result = await handler.execute(new GetTicketStatusQuery(TEST_TICKET_ID));

      expect(result.eta).toBe('2026-06-10T17:00:00Z');
      expect(result.assignedTeam).toBe('Đội kỹ thuật A');
    });

    it('should handle nullable ETA and assignedTeam', async () => {
      const noEtaResponse = {
        ...mockStatusResponse,
        eta: null,
        assignedTeam: null,
      };
      portRegistry.execute.mockResolvedValue({ data: noEtaResponse });

      const result = await handler.execute(new GetTicketStatusQuery(TEST_TICKET_ID));

      expect(result.eta).toBeNull();
      expect(result.assignedTeam).toBeNull();
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  describe('execute — null/undefined result', () => {
    it('should throw PortFallbackException when result.data is null', async () => {
      portRegistry.execute.mockResolvedValue({ data: null });

      await expect(
        handler.execute(new GetTicketStatusQuery(TEST_TICKET_ID)),
      ).rejects.toThrow(PortFallbackException);
    });

    it('should throw PortFallbackException when result is undefined', async () => {
      portRegistry.execute.mockResolvedValue(undefined);

      await expect(
        handler.execute(new GetTicketStatusQuery(TEST_TICKET_ID)),
      ).rejects.toThrow(PortFallbackException);
    });
  });
});
