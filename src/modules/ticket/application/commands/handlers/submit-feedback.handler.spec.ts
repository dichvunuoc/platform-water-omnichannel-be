import { SubmitFeedbackHandler } from './submit-feedback.handler';
import { SubmitFeedbackCommand } from '../submit-feedback.command';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('SubmitFeedbackHandler', () => {
  let handler: SubmitFeedbackHandler;
  let portRegistry: any;

  const mockFeedbackResponse = {
    ticketId: 'TK-2026-002',
    score: 4,
    submittedAt: '2026-06-10T15:30:00Z',
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    };
    handler = new SubmitFeedbackHandler(portRegistry);
  });

  const TEST_CUSTOMER_ID = 'USR-SESSION-001';
  const TEST_TICKET_ID = 'TK-2026-002';

  // ── Success path ───────────────────────────────────────────────────────────

  describe('execute — success', () => {
    it('should call PortRegistry with correct params including useCache: false', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockFeedbackResponse });

      const result = await handler.execute(
        new SubmitFeedbackCommand(TEST_TICKET_ID, TEST_CUSTOMER_ID, 4),
      );

      expect(portRegistry.execute).toHaveBeenCalledTimes(1);
      expect(portRegistry.execute).toHaveBeenCalledWith(
        'ticket',
        'submit-feedback',
        expect.objectContaining({
          ticketId: TEST_TICKET_ID,
          customerId: TEST_CUSTOMER_ID,
          score: 4,
          comment: undefined,
          useCache: false,
        }),
      );
      expect(result.ticketId).toBe('TK-2026-002');
      expect(result.score).toBe(4);
    });

    it('should pass comment when provided', async () => {
      portRegistry.execute.mockResolvedValue({ data: { ...mockFeedbackResponse, score: 5 } });

      await handler.execute(
        new SubmitFeedbackCommand(TEST_TICKET_ID, TEST_CUSTOMER_ID, 5, 'Great service!'),
      );

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'ticket',
        'submit-feedback',
        expect.objectContaining({
          comment: 'Great service!',
        }),
      );
    });

    it('should not include comment in params when undefined', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockFeedbackResponse });

      await handler.execute(
        new SubmitFeedbackCommand(TEST_TICKET_ID, TEST_CUSTOMER_ID, 4),
      );

      const callArgs = portRegistry.execute.mock.calls[0][2];
      expect(callArgs.comment).toBeUndefined();
    });
  });

  // ── AC#3: Low score flagging ──────────────────────────────────────────────

  describe('execute — low score flagging (AC#3)', () => {
    it('should flag low score (score < 3) with warning log', async () => {
      portRegistry.execute.mockResolvedValue({ data: { ...mockFeedbackResponse, score: 2 } });

      const warnSpy = jest.spyOn(handler['logger'], 'warn');

      await handler.execute(
        new SubmitFeedbackCommand(TEST_TICKET_ID, TEST_CUSTOMER_ID, 2),
      );

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const warnMsg = warnSpy.mock.calls[0][0];
      expect(warnMsg).toContain('Low CSAT alert');
      expect(warnMsg).toContain(TEST_TICKET_ID);
      expect(warnMsg).toContain('2/5');
    });

    it('should flag score = 1 (minimum)', async () => {
      portRegistry.execute.mockResolvedValue({ data: { ...mockFeedbackResponse, score: 1 } });

      const warnSpy = jest.spyOn(handler['logger'], 'warn');

      await handler.execute(
        new SubmitFeedbackCommand(TEST_TICKET_ID, TEST_CUSTOMER_ID, 1),
      );

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('1/5');
    });

    it('should NOT flag score = 3 (boundary — at threshold)', async () => {
      portRegistry.execute.mockResolvedValue({ data: { ...mockFeedbackResponse, score: 3 } });

      const warnSpy = jest.spyOn(handler['logger'], 'warn');

      await handler.execute(
        new SubmitFeedbackCommand(TEST_TICKET_ID, TEST_CUSTOMER_ID, 3),
      );

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should NOT flag score = 4', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockFeedbackResponse });

      const warnSpy = jest.spyOn(handler['logger'], 'warn');

      await handler.execute(
        new SubmitFeedbackCommand(TEST_TICKET_ID, TEST_CUSTOMER_ID, 4),
      );

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should NOT flag score = 5', async () => {
      portRegistry.execute.mockResolvedValue({ data: { ...mockFeedbackResponse, score: 5 } });

      const warnSpy = jest.spyOn(handler['logger'], 'warn');

      await handler.execute(
        new SubmitFeedbackCommand(TEST_TICKET_ID, TEST_CUSTOMER_ID, 5),
      );

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should still return result even when flagging low score', async () => {
      portRegistry.execute.mockResolvedValue({ data: { ...mockFeedbackResponse, score: 1 } });

      const result = await handler.execute(
        new SubmitFeedbackCommand(TEST_TICKET_ID, TEST_CUSTOMER_ID, 1),
      );

      expect(result.score).toBe(1);
      expect(result.ticketId).toBe('TK-2026-002');
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  describe('execute — null/undefined result', () => {
    it('should throw PortFallbackException when result.data is null', async () => {
      portRegistry.execute.mockResolvedValue({ data: null });

      await expect(
        handler.execute(new SubmitFeedbackCommand(TEST_TICKET_ID, TEST_CUSTOMER_ID, 3)),
      ).rejects.toThrow(PortFallbackException);
    });

    it('should throw PortFallbackException when result is undefined', async () => {
      portRegistry.execute.mockResolvedValue(undefined);

      await expect(
        handler.execute(new SubmitFeedbackCommand(TEST_TICKET_ID, TEST_CUSTOMER_ID, 3)),
      ).rejects.toThrow(PortFallbackException);
    });
  });
});
