import { HandlePaymentWebhookHandler } from './handle-payment-webhook.handler';
import { HandlePaymentWebhookCommand } from '../handle-payment-webhook.command';
import type { ICacheService } from '@shared/caching/cache.interface';
import type { PaymentWebhookPayload } from '../../dtos/payment.dto';
import { DispatchNotificationCommand } from '@modules/communication/application/commands/dispatch-notification.command';
import { RecordSessionEventCommand } from '@modules/session/application/commands/record-session-event.command';

// Local mock interface — avoids importing IdempotencyService
// which has deep decorator chains that break test context
interface IdempotencyMock {
  getExisting: jest.Mock;
  store: jest.Mock;
}

describe('HandlePaymentWebhookHandler', () => {
  let handler: HandlePaymentWebhookHandler;
  let cacheService: jest.Mocked<ICacheService>;
  let idempotencyService: IdempotencyMock;
  let commandBus: { execute: jest.Mock };

  const successPayload: PaymentWebhookPayload = {
    paymentId: 'PAY-2026-001',
    invoiceId: 'INV-2026-001',
    customerId: 'USR-001',
    amount: 123273,
    status: 'success',
    timestamp: '2026-06-09T10:00:00Z',
  };

  const failedPayload: PaymentWebhookPayload = {
    ...successPayload,
    status: 'failed',
  };

  beforeEach(() => {
    cacheService = {
      deleteByPattern: jest.fn().mockResolvedValue(3),
    } as unknown as jest.Mocked<ICacheService>;

    idempotencyService = {
      getExisting: jest.fn().mockResolvedValue(null),
      store: jest.fn().mockResolvedValue(undefined),
    };

    commandBus = { execute: jest.fn().mockResolvedValue({ dispatched: true }) };

    handler = new HandlePaymentWebhookHandler(cacheService, idempotencyService as any, commandBus as any);
  });

  // ── AC#2: Success flow ──────────────────────────────────────────────────────

  describe('successful payment webhook', () => {
    it('should invalidate invoice cache via deleteByPattern', async () => {
      await handler.execute(new HandlePaymentWebhookCommand(successPayload));

      expect(cacheService.deleteByPattern).toHaveBeenCalledWith('cache:v2:port:invoice:*');
    });

    it('should also invalidate debt cache (AC#4 — Story 4.5)', async () => {
      await handler.execute(new HandlePaymentWebhookCommand(successPayload));

      expect(cacheService.deleteByPattern).toHaveBeenCalledWith('cache:v2:port:debt:*');
    });

    it('should return success result', async () => {
      const result = await handler.execute(new HandlePaymentWebhookCommand(successPayload));

      expect(result).toEqual({
        processed: true,
        paymentId: 'PAY-2026-001',
        status: 'success',
      });
    });

    it('should store idempotency result', async () => {
      await handler.execute(new HandlePaymentWebhookCommand(successPayload));

      expect(idempotencyService.store).toHaveBeenCalledWith(
        'PAY-2026-001',
        expect.objectContaining({ processed: true, status: 'success' }),
        'HandlePaymentWebhook',
      );
    });

    it('should dispatch RecordSessionEventCommand for payment_completed', async () => {
      await handler.execute(new HandlePaymentWebhookCommand(successPayload));

      // commandBus is called twice: once for session event, once for notification
      const sessionEventCall = commandBus.execute.mock.calls.find(
        (call: any[]) => call[0] instanceof RecordSessionEventCommand,
      );
      expect(sessionEventCall).toBeDefined();
      const cmd = sessionEventCall![0];
      expect(cmd).toBeInstanceOf(RecordSessionEventCommand);
      expect(cmd.payload.userId).toBe('USR-001');
      expect(cmd.payload.eventType).toBe('payment_completed');
      expect(cmd.payload.channel).toBe('web');
    });

    // AC#5: Dispatch notification on success (Story 6.2)
    it('should dispatch DispatchNotificationCommand on success', async () => {
      await handler.execute(new HandlePaymentWebhookCommand(successPayload));

      expect(commandBus.execute).toHaveBeenCalledTimes(2);
      const notificationCall = commandBus.execute.mock.calls.find(
        (call: any[]) => call[0] instanceof DispatchNotificationCommand,
      );
      expect(notificationCall).toBeDefined();
      const callArg = notificationCall![0];
      expect(callArg).toBeInstanceOf(DispatchNotificationCommand);
      expect(callArg.payload.type).toBe('payment_completed');
      expect(callArg.payload.isCritical).toBe(true);
      expect(callArg.payload.customerId).toBe('USR-001');
      expect(callArg.payload.invoiceId).toBe('INV-2026-001');
      expect(callArg.payload.amount).toBe(123273);
    });

    it('should NOT contain NOTIFICATION STUB on success', async () => {
      const logSpy = jest.spyOn(handler['logger'], 'log');

      await handler.execute(new HandlePaymentWebhookCommand(successPayload));

      const allLogs = logSpy.mock.calls.map(c => c[0]).join(' ');
      expect(allLogs).not.toContain('NOTIFICATION STUB');
    });
  });

  // ── AC#3: Failed flow ───────────────────────────────────────────────────────

  describe('failed payment webhook', () => {
    it('should NOT invalidate cache on failed payment', async () => {
      await handler.execute(new HandlePaymentWebhookCommand(failedPayload));

      expect(cacheService.deleteByPattern).not.toHaveBeenCalled();
    });

    it('should return failed result', async () => {
      const result = await handler.execute(new HandlePaymentWebhookCommand(failedPayload));

      expect(result).toEqual({
        processed: true,
        paymentId: 'PAY-2026-001',
        status: 'failed',
      });
    });

    it('should store idempotency result for failed payment', async () => {
      await handler.execute(new HandlePaymentWebhookCommand(failedPayload));

      expect(idempotencyService.store).toHaveBeenCalledWith(
        'PAY-2026-001',
        expect.objectContaining({ processed: true, status: 'failed' }),
        'HandlePaymentWebhook',
      );
    });

    it('should log failure with PII redacted', async () => {
      const warnSpy = jest.spyOn(handler['logger'], 'warn');

      await handler.execute(new HandlePaymentWebhookCommand(failedPayload));

      const warnMsg = warnSpy.mock.calls[0][0];
      expect(warnMsg).toContain('Payment failed');
      expect(warnMsg).toContain('[REDACTED]');
    });

    // AC#5: Dispatch notification on failure (Story 6.2)
    it('should dispatch DispatchNotificationCommand on failure', async () => {
      await handler.execute(new HandlePaymentWebhookCommand(failedPayload));

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const callArg = commandBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(DispatchNotificationCommand);
      expect(callArg.payload.type).toBe('payment_failed');
      expect(callArg.payload.isCritical).toBe(true);
      expect(callArg.payload.customerId).toBe('USR-001');
    });

    it('should NOT contain NOTIFICATION STUB on failure', async () => {
      const logSpy = jest.spyOn(handler['logger'], 'log');

      await handler.execute(new HandlePaymentWebhookCommand(failedPayload));

      const allLogs = logSpy.mock.calls.map(c => c[0]).join(' ');
      expect(allLogs).not.toContain('NOTIFICATION STUB');
    });
  });

  // ── AC#4: Idempotency — duplicate webhook ────────────────────────────────────

  describe('duplicate webhook (idempotency)', () => {
    it('should return duplicate result without reprocessing', async () => {
      idempotencyService.getExisting.mockResolvedValue({
        result: { processed: true, paymentId: 'PAY-2026-001', status: 'success' },
        storedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        commandType: 'HandlePaymentWebhook',
      });

      const result = await handler.execute(new HandlePaymentWebhookCommand(successPayload));

      expect(result).toEqual({
        processed: false,
        paymentId: 'PAY-2026-001',
        status: 'duplicate',
      });
    });

    it('should NOT invalidate cache on duplicate webhook', async () => {
      idempotencyService.getExisting.mockResolvedValue({
        result: { processed: true, paymentId: 'PAY-2026-001', status: 'success' },
        storedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        commandType: 'HandlePaymentWebhook',
      });

      await handler.execute(new HandlePaymentWebhookCommand(successPayload));

      expect(cacheService.deleteByPattern).not.toHaveBeenCalled();
    });

    it('should NOT store idempotency result again for duplicate', async () => {
      idempotencyService.getExisting.mockResolvedValue({
        result: { processed: true, paymentId: 'PAY-2026-001', status: 'success' },
        storedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        commandType: 'HandlePaymentWebhook',
      });

      await handler.execute(new HandlePaymentWebhookCommand(successPayload));

      expect(idempotencyService.store).not.toHaveBeenCalled();
    });

    it('should NOT dispatch notification on duplicate', async () => {
      idempotencyService.getExisting.mockResolvedValue({
        result: { processed: true, paymentId: 'PAY-2026-001', status: 'success' },
        storedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        commandType: 'HandlePaymentWebhook',
      });

      await handler.execute(new HandlePaymentWebhookCommand(successPayload));

      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });

  // ── Notification dispatch error resilience (Story 6.2 review fix) ───────

  describe('notification dispatch failure', () => {
    it('should still return success when notification dispatch throws', async () => {
      commandBus.execute.mockRejectedValue(new Error('Circuit breaker open'));

      const result = await handler.execute(new HandlePaymentWebhookCommand(successPayload));

      expect(result.processed).toBe(true);
      expect(result.status).toBe('success');
    });

    it('should still return failed when notification dispatch throws on failure', async () => {
      commandBus.execute.mockRejectedValue(new Error('Circuit breaker open'));

      const result = await handler.execute(new HandlePaymentWebhookCommand(failedPayload));

      expect(result.processed).toBe(true);
      expect(result.status).toBe('failed');
    });
  });
});
