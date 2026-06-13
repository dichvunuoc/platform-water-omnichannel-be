import { HandleTicketWebhookHandler } from './handle-ticket-webhook.handler';
import { HandleTicketWebhookCommand } from '../handle-ticket-webhook.command';
import type { ICacheService } from '@shared/caching/cache.interface';
import type { TicketWebhookPayload } from '../../dtos/ticket.dto';
import { DispatchNotificationCommand } from '@modules/communication/application/commands/dispatch-notification.command';
import { RecordSessionEventCommand } from '@modules/session/application/commands/record-session-event.command';

// Local mock interface — avoids importing IdempotencyService
// which has deep decorator chains that break test context
interface IdempotencyMock {
  getExisting: jest.Mock;
  store: jest.Mock;
}

describe('HandleTicketWebhookHandler', () => {
  let handler: HandleTicketWebhookHandler;
  let cacheService: jest.Mocked<ICacheService>;
  let idempotencyService: IdempotencyMock;
  let commandBus: { execute: jest.Mock };

  const validPayload: TicketWebhookPayload = {
    ticketId: 'TICK-001',
    trackingId: 'TK-2026-002',
    customerId: 'USR-001',
    oldStatus: 'assigned',
    newStatus: 'in_progress',
    updatedAt: '2026-06-10T11:00:00Z',
  };

  beforeEach(() => {
    cacheService = {
      deleteByPattern: jest.fn().mockResolvedValue(2),
    } as unknown as jest.Mocked<ICacheService>;

    idempotencyService = {
      getExisting: jest.fn().mockResolvedValue(null),
      store: jest.fn().mockResolvedValue(undefined),
    };

    commandBus = { execute: jest.fn().mockResolvedValue({ dispatched: true }) };

    handler = new HandleTicketWebhookHandler(cacheService, idempotencyService as any, commandBus as any);
  });

  // ── AC#3: Success flow ──────────────────────────────────────────────────────

  describe('successful ticket webhook', () => {
    it('should invalidate ticket cache via deleteByPattern', async () => {
      await handler.execute(new HandleTicketWebhookCommand(validPayload));

      expect(cacheService.deleteByPattern).toHaveBeenCalledWith('cache:v2:port:ticket:*');
    });

    it('should log correct status transition', async () => {
      const logSpy = jest.spyOn(handler['logger'], 'log');

      await handler.execute(new HandleTicketWebhookCommand(validPayload));

      const allLogs = logSpy.mock.calls.map(c => c[0]).join(' ');
      expect(allLogs).toContain('TK-2026-002');
      expect(allLogs).toContain('assigned');
      expect(allLogs).toContain('in_progress');
      expect(allLogs).toContain('USR-001');
    });

    it('should dispatch RecordSessionEventCommand for ticket_status_changed', async () => {
      await handler.execute(new HandleTicketWebhookCommand(validPayload));

      // commandBus is called twice: once for session event, once for notification
      const sessionEventCall = commandBus.execute.mock.calls.find(
        (call: any[]) => call[0] instanceof RecordSessionEventCommand,
      );
      expect(sessionEventCall).toBeDefined();
      const cmd = sessionEventCall![0];
      expect(cmd).toBeInstanceOf(RecordSessionEventCommand);
      expect(cmd.payload.userId).toBe('USR-001');
      expect(cmd.payload.eventType).toBe('ticket_status_changed');
      expect(cmd.payload.channel).toBe('web');
      expect(cmd.payload.content).toEqual(
        expect.objectContaining({ ticketId: 'TICK-001', trackingId: 'TK-2026-002' }),
      );
    });

    it('should return success result', async () => {
      const result = await handler.execute(new HandleTicketWebhookCommand(validPayload));

      expect(result).toEqual({
        processed: true,
        ticketId: 'TICK-001',
        status: 'in_progress',
      });
    });

    it('should store idempotency result', async () => {
      await handler.execute(new HandleTicketWebhookCommand(validPayload));

      expect(idempotencyService.store).toHaveBeenCalledWith(
        'TICK-001',
        expect.objectContaining({ processed: true, status: 'in_progress' }),
        'HandleTicketWebhook',
      );
    });

    it('should handle various status transitions', async () => {
      const transitions: Array<{ oldStatus: string; newStatus: string }> = [
        { oldStatus: 'submitted', newStatus: 'assigned' },
        { oldStatus: 'in_progress', newStatus: 'resolved' },
        { oldStatus: 'resolved', newStatus: 'closed' },
      ];

      for (const { oldStatus, newStatus } of transitions) {
        const payload = { ...validPayload, ticketId: `TICK-${newStatus}`, oldStatus: oldStatus as any, newStatus: newStatus as any };
        await handler.execute(new HandleTicketWebhookCommand(payload));
      }

      expect(cacheService.deleteByPattern).toHaveBeenCalledTimes(3);
    });

    // AC#6: Dispatch notification on ticket status change (Story 6.2)
    it('should dispatch DispatchNotificationCommand on status change', async () => {
      await handler.execute(new HandleTicketWebhookCommand(validPayload));

      expect(commandBus.execute).toHaveBeenCalledTimes(2);
      const notificationCall = commandBus.execute.mock.calls.find(
        (call: any[]) => call[0] instanceof DispatchNotificationCommand,
      );
      expect(notificationCall).toBeDefined();
      const callArg = notificationCall![0];
      expect(callArg).toBeInstanceOf(DispatchNotificationCommand);
      expect(callArg.payload.type).toBe('ticket_status_changed');
      expect(callArg.payload.isCritical).toBe(false);
      expect(callArg.payload.customerId).toBe('USR-001');
      expect(callArg.payload.ticketId).toBe('TICK-001');
      expect(callArg.payload.trackingId).toBe('TK-2026-002');
      expect(callArg.payload.oldStatus).toBe('assigned');
      expect(callArg.payload.newStatus).toBe('in_progress');
    });

    it('should NOT contain NOTIFICATION STUB in logs', async () => {
      const logSpy = jest.spyOn(handler['logger'], 'log');

      await handler.execute(new HandleTicketWebhookCommand(validPayload));

      const allLogs = logSpy.mock.calls.map(c => c[0]).join(' ');
      expect(allLogs).not.toContain('NOTIFICATION STUB');
    });
  });

  // ── Idempotency — duplicate webhook ──────────────────────────────────────────

  describe('duplicate webhook (idempotency)', () => {
    it('should return duplicate result without reprocessing', async () => {
      idempotencyService.getExisting.mockResolvedValue({
        result: { processed: true, ticketId: 'TICK-001', status: 'in_progress' },
        storedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        commandType: 'HandleTicketWebhook',
      });

      const result = await handler.execute(new HandleTicketWebhookCommand(validPayload));

      expect(result).toEqual({
        processed: false,
        ticketId: 'TICK-001',
        status: 'duplicate',
      });
    });

    it('should NOT invalidate cache on duplicate webhook', async () => {
      idempotencyService.getExisting.mockResolvedValue({
        result: { processed: true, ticketId: 'TICK-001', status: 'in_progress' },
        storedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        commandType: 'HandleTicketWebhook',
      });

      await handler.execute(new HandleTicketWebhookCommand(validPayload));

      expect(cacheService.deleteByPattern).not.toHaveBeenCalled();
    });

    it('should NOT store idempotency result again for duplicate', async () => {
      idempotencyService.getExisting.mockResolvedValue({
        result: { processed: true, ticketId: 'TICK-001', status: 'in_progress' },
        storedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        commandType: 'HandleTicketWebhook',
      });

      await handler.execute(new HandleTicketWebhookCommand(validPayload));

      expect(idempotencyService.store).not.toHaveBeenCalled();
    });

    it('should NOT dispatch notification on duplicate', async () => {
      idempotencyService.getExisting.mockResolvedValue({
        result: { processed: true, ticketId: 'TICK-001', status: 'in_progress' },
        storedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        commandType: 'HandleTicketWebhook',
      });

      await handler.execute(new HandleTicketWebhookCommand(validPayload));

      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });

  // ── Notification dispatch error resilience (Story 6.2 review fix) ───────

  describe('notification dispatch failure', () => {
    it('should still return success when notification dispatch throws', async () => {
      commandBus.execute.mockRejectedValue(new Error('Circuit breaker open'));

      const result = await handler.execute(new HandleTicketWebhookCommand(validPayload));

      expect(result.processed).toBe(true);
      expect(result.status).toBe('in_progress');
    });
  });
});
