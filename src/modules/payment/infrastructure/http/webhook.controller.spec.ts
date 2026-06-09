import { WebhookController } from './webhook.controller';
import { ValidationException } from '@core/common';
import { HandlePaymentWebhookCommand } from '../../application/commands/handle-payment-webhook.command';
import { InterServiceApiKeyGuard } from '@shared/security';
import { UseGuards } from '@nestjs/common';

function mockBuses() {
  return { commandBus: { execute: jest.fn() }, queryBus: { execute: jest.fn() } };
}

describe('WebhookController', () => {
  let controller: WebhookController;
  let buses: ReturnType<typeof mockBuses>;

  const validPayload = {
    paymentId: 'PAY-2026-001',
    invoiceId: 'INV-2026-001',
    customerId: 'USR-001',
    amount: 123273,
    status: 'success',
    timestamp: '2026-06-09T10:00:00Z',
  };

  beforeEach(() => {
    buses = mockBuses();
    controller = new WebhookController(buses.commandBus as any);
  });

  // ── POST /webhooks/payment/ipn (AC#1) ───────────────────────────────────────

  describe('POST /webhooks/payment/ipn', () => {
    it('should return { received: true } on valid payload', async () => {
      buses.commandBus.execute.mockResolvedValue({ processed: true, paymentId: 'PAY-2026-001', status: 'success' });

      const result = await controller.handlePaymentIpn(validPayload);

      expect(result).toEqual({ received: true });
    });

    it('should dispatch HandlePaymentWebhookCommand', async () => {
      buses.commandBus.execute.mockResolvedValue({ processed: true, paymentId: 'PAY-2026-001', status: 'success' });

      await controller.handlePaymentIpn(validPayload);

      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(HandlePaymentWebhookCommand);
      expect(callArg.payload.paymentId).toBe('PAY-2026-001');
    });

    it('should throw ValidationException for missing paymentId', async () => {
      await expect(
        controller.handlePaymentIpn({ ...validPayload, paymentId: undefined }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for invalid status', async () => {
      await expect(
        controller.handlePaymentIpn({ ...validPayload, status: 'pending' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for missing amount', async () => {
      await expect(
        controller.handlePaymentIpn({ ...validPayload, amount: undefined }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for empty body', async () => {
      await expect(
        controller.handlePaymentIpn({}),
      ).rejects.toThrow(ValidationException);
    });

    it('should accept failed status', async () => {
      buses.commandBus.execute.mockResolvedValue({ processed: true, paymentId: 'PAY-2026-001', status: 'failed' });

      const result = await controller.handlePaymentIpn({ ...validPayload, status: 'failed' });
      expect(result).toEqual({ received: true });
    });
  });

  // ── Guard verification (AC#1 — InterServiceApiKeyGuard) ──────────────────────

  describe('Auth protection', () => {
    it('should have @UseGuards(InterServiceApiKeyGuard) decorator', () => {
      const guards = Reflect.getMetadata('__guards__', WebhookController);
      expect(guards).toBeDefined();
      expect(guards.some((g: any) => g === InterServiceApiKeyGuard)).toBe(true);
    });
  });
});
