import { SessionController } from './session.controller';
import { ValidationException } from '@core/common';

describe('SessionController', () => {
  let controller: SessionController;
  let queryBus: { execute: jest.Mock };
  let commandBus: { execute: jest.Mock };

  beforeEach(() => {
    queryBus = { execute: jest.fn() };
    commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    controller = new SessionController(queryBus as any, commandBus as any);
  });

  // ── GET /sessions/me ─────────────────────────────────────────────────────────

  describe('getSessionDetail', () => {
    it('should dispatch EnsureSessionCommand and return session detail', async () => {
      const mockDetail = { session: { userId: 'USR-001' }, recentEvents: [] };
      commandBus.execute.mockResolvedValue(undefined);
      queryBus.execute.mockResolvedValue(mockDetail);

      const result = await controller.getSessionDetail('USR-001', 'web');

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const cmd = commandBus.execute.mock.calls[0][0];
      expect(cmd.constructor.name).toBe('EnsureSessionCommand');
      expect(cmd.userId).toBe('USR-001');
      expect(cmd.channel).toBe('web');

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockDetail);
    });

    it('should default channel to web when not provided', async () => {
      queryBus.execute.mockResolvedValue({ session: null, recentEvents: [] });

      await controller.getSessionDetail('USR-001');

      const cmd = commandBus.execute.mock.calls[0][0];
      expect(cmd.channel).toBe('web');
    });

    it('should throw ValidationException for invalid channel', async () => {
      await expect(
        controller.getSessionDetail('USR-001', 'telegram'),
      ).rejects.toThrow(ValidationException);
    });
  });

  // ── GET /sessions/me/events ──────────────────────────────────────────────────

  describe('getSessionEvents', () => {
    it('should validate query params and dispatch query', async () => {
      const mockResponse = { events: [], totalCount: 0, page: 1, pageSize: 20, sessionId: null };
      queryBus.execute.mockResolvedValue(mockResponse);

      const result = await controller.getSessionEvents('USR-001', { page: '1', pageSize: '10' });

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      const query = queryBus.execute.mock.calls[0][0];
      expect(query.constructor.name).toBe('GetSessionEventsQuery');
      expect(query.userId).toBe('USR-001');
      expect(query.params.page).toBe(1);
      expect(query.params.pageSize).toBe(10);
      expect(result).toEqual(mockResponse);
    });

    it('should throw ValidationException for invalid query params', async () => {
      await expect(
        controller.getSessionEvents('USR-001', { pageSize: '999' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should accept empty query params with defaults', async () => {
      queryBus.execute.mockResolvedValue({ events: [], totalCount: 0, page: 1, pageSize: 20, sessionId: null });

      await controller.getSessionEvents('USR-001', {});

      const query = queryBus.execute.mock.calls[0][0];
      expect(query.params.page).toBe(1);
      expect(query.params.pageSize).toBe(20);
    });
  });
});
