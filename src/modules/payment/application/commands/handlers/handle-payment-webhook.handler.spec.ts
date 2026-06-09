import { HandlePaymentWebhookHandler } from './handle-payment-webhook.handler';
import { HandlePaymentWebhookCommand } from '../handle-payment-webhook.command';
import type { ICacheService } from '@shared/caching/cache.interface';
import type { PaymentWebhookPayload } from '../../dtos/payment.dto';

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

    handler = new HandlePaymentWebhookHandler(cacheService, idempotencyService as any);
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

    it('should log session event stub and notification stub', async () => {
      const logSpy = jest.spyOn(handler['logger'], 'log');

      await handler.execute(new HandlePaymentWebhookCommand(successPayload));

      const allLogs = logSpy.mock.calls.map(c => c[0]).join(' ');
      expect(allLogs).toContain('SESSION EVENT STUB');
      expect(allLogs).toContain('NOTIFICATION STUB');
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
  });
});
